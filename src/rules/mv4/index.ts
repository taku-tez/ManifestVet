import { Rule, RuleContext, Violation } from "../types";

// ---------------------------------------------------------------------------
// Pod-bearing resource kinds
// ---------------------------------------------------------------------------
const POD_BEARING_KINDS = [
  "Pod",
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Job",
  "CronJob",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPodBearing(resource: RuleContext["resource"]): boolean {
  return POD_BEARING_KINDS.includes(resource.kind as string);
}

/**
 * Returns the pod-level spec for a resource.
 *   Pod        -> spec
 *   All others -> spec.template.spec
 */
function getPodSpec(resource: RuleContext["resource"]): any | undefined {
  if (!resource.spec) return undefined;
  if (resource.kind === "Pod") {
    return resource.spec;
  }
  return resource.spec?.template?.spec;
}

interface ContainerInfo {
  container: any;
  index: number;
  prefix: string;
}

/**
 * Extracts all containers (regular + init) from pod-bearing resources.
 * Returns an array of { container, index, prefix } where prefix is
 * "containers" or "initContainers".
 */
function getContainers(resource: RuleContext["resource"]): ContainerInfo[] {
  const podSpec = getPodSpec(resource);
  if (!podSpec) return [];

  const result: ContainerInfo[] = [];

  const containers: any[] = podSpec.containers ?? [];
  containers.forEach((c: any, i: number) => {
    result.push({ container: c, index: i, prefix: "containers" });
  });

  const initContainers: any[] = podSpec.initContainers ?? [];
  initContainers.forEach((c: any, i: number) => {
    result.push({ container: c, index: i, prefix: "initContainers" });
  });

  return result;
}

/**
 * Build the dotted path to a container inside the manifest.
 *   Pod        -> spec.<prefix>[<index>]
 *   All others -> spec.template.spec.<prefix>[<index>]
 */
function containerPath(
  resource: RuleContext["resource"],
  prefix: string,
  index: number,
  suffix?: string,
): string {
  const base =
    resource.kind === "Pod"
      ? `spec.${prefix}[${index}]`
      : `spec.template.spec.${prefix}[${index}]`;
  return suffix ? `${base}.${suffix}` : base;
}

/**
 * Build the dotted path to the pod spec level.
 */
function podSpecPath(resource: RuleContext["resource"], suffix?: string): string {
  const base = resource.kind === "Pod" ? "spec" : "spec.template.spec";
  return suffix ? `${base}.${suffix}` : base;
}

/**
 * Checks whether an image reference uses the "latest" tag or has no tag at all.
 * Returns true if the image is unpinned (no ":" at all, or ends with ":latest").
 */
function isLatestOrUntagged(image: string): boolean {
  if (!image) return true;

  // If the image contains a digest, the tag portion is before the "@"
  // but for this check we focus purely on the tag part.
  // An image with @sha256: could still have :latest before it, but
  // we check the raw string for the tag portion.

  // Strip any digest portion for tag analysis
  const withoutDigest = image.split("@")[0];

  // No colon at all means no tag
  if (!withoutDigest.includes(":")) return true;

  // Extract tag: everything after the last ":"
  const tag = withoutDigest.split(":").pop() ?? "";
  return tag === "latest";
}

/**
 * Checks whether an image reference contains a sha256 digest.
 */
function hasDigest(image: string): boolean {
  if (!image) return false;
  return image.includes("@sha256:");
}

/**
 * Checks whether an image reference appears to target a private registry.
 * A private registry is identified by the presence of a "." before the first "/",
 * which covers patterns like gcr.io/..., *.azurecr.io/..., *.ecr.aws/..., etc.
 */
function isPrivateRegistry(image: string): boolean {
  if (!image) return false;

  const slashIndex = image.indexOf("/");
  if (slashIndex === -1) {
    // No slash means it is a Docker Hub short name (e.g. "nginx") - not private
    return false;
  }

  const registry = image.substring(0, slashIndex);
  return registry.includes(".");
}

// ---------------------------------------------------------------------------
// MV4001 - Image tag is "latest" or missing
// ---------------------------------------------------------------------------
const mv4001: Rule = {
  id: "MV4001",
  severity: "error",
  description:
    'Container image tag is "latest" or missing. Images should be pinned to a specific version tag for reproducibility and security.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const image: string = container.image ?? "";

      if (isLatestOrUntagged(image)) {
        violations.push({
          rule: "MV4001",
          severity: "error",
          message: `Container "${container.name ?? index}" uses image "${image}" which has no tag or uses the "latest" tag.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "image"),
          fix: "Pin the image to a specific version tag (e.g. myimage:1.2.3).",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV4002 - Image has no digest (sha256)
// ---------------------------------------------------------------------------
const mv4002: Rule = {
  id: "MV4002",
  severity: "info",
  description:
    "Container image does not use a sha256 digest. Using a digest ensures the exact image content is deployed.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const image: string = container.image ?? "";

      if (!hasDigest(image)) {
        violations.push({
          rule: "MV4002",
          severity: "info",
          message: `Container "${container.name ?? index}" uses image "${image}" without a sha256 digest.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "image"),
          fix: "Pin the image using a digest (e.g. myimage@sha256:abc123...).",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV4003 - imagePullPolicy is "Never"
// ---------------------------------------------------------------------------
const mv4003: Rule = {
  id: "MV4003",
  severity: "warning",
  description:
    'Container imagePullPolicy is set to "Never". This means the image will never be pulled from a registry and must already exist on the node.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.imagePullPolicy === "Never") {
        violations.push({
          rule: "MV4003",
          severity: "warning",
          message: `Container "${container.name ?? index}" has imagePullPolicy set to "Never".`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "imagePullPolicy"),
          fix: 'Set imagePullPolicy to "Always" or "IfNotPresent" to ensure images are pulled from the registry.',
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV4004 - imagePullPolicy is "IfNotPresent" with no version pinning
// ---------------------------------------------------------------------------
const mv4004: Rule = {
  id: "MV4004",
  severity: "warning",
  description:
    'Container imagePullPolicy is "IfNotPresent" but the image has no specific version tag and no sha256 digest. This combination may result in stale or unexpected images being used.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.imagePullPolicy !== "IfNotPresent") continue;

      const image: string = container.image ?? "";

      if (isLatestOrUntagged(image) && !hasDigest(image)) {
        violations.push({
          rule: "MV4004",
          severity: "warning",
          message: `Container "${container.name ?? index}" has imagePullPolicy "IfNotPresent" with an unpinned image "${image}" (no version tag and no digest).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "imagePullPolicy"),
          fix: "Pin the image to a specific version tag or digest, or set imagePullPolicy to \"Always\".",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV4005 - Init container using latest tag
// ---------------------------------------------------------------------------
const mv4005: Rule = {
  id: "MV4005",
  severity: "warning",
  description:
    'Init container image tag is "latest" or missing. Init containers run before app containers and should be pinned to a specific version.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (!podSpec) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    const initContainers: any[] = podSpec.initContainers ?? [];
    initContainers.forEach((container: any, index: number) => {
      const image: string = container.image ?? "";

      if (isLatestOrUntagged(image)) {
        violations.push({
          rule: "MV4005",
          severity: "warning",
          message: `Init container "${container.name ?? index}" uses image "${image}" which has no tag or uses the "latest" tag.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, "initContainers", index, "image"),
          fix: "Pin the init container image to a specific version tag (e.g. myimage:1.2.3).",
        });
      }
    });

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV4006 - No imagePullSecrets for private registry
// ---------------------------------------------------------------------------
const mv4006: Rule = {
  id: "MV4006",
  severity: "info",
  description:
    "Pod references a private registry image but does not define imagePullSecrets. Without pull secrets, the kubelet may fail to authenticate with the private registry.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (!podSpec) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const pullSecrets: any[] = podSpec.imagePullSecrets ?? [];
    const hasPullSecrets = pullSecrets.length > 0;

    // If pull secrets are configured, no violation
    if (hasPullSecrets) return [];

    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const image: string = container.image ?? "";

      if (isPrivateRegistry(image)) {
        violations.push({
          rule: "MV4006",
          severity: "info",
          message: `Container "${container.name ?? index}" references private registry image "${image}" but no imagePullSecrets are defined.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "imagePullSecrets"),
          fix: "Add imagePullSecrets to the pod spec with credentials for the private registry.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV4007 - Image uses a deprecated/insecure registry (docker.io without digest)
// ---------------------------------------------------------------------------
const mv4007: Rule = {
  id: "MV4007",
  severity: "info",
  description:
    "Container images without a registry prefix default to Docker Hub (docker.io). Explicitly specifying the full registry path and using a private or mirrored registry is recommended for production workloads.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const image: string = container.image ?? "";
      // Image without a '/' or with no registry prefix (no dot or colon before first slash)
      if (!image) continue;
      const parts = image.split("/");
      const firstPart = parts[0];
      // If the first part has no dot and no colon (port), it's a Docker Hub short form
      if (parts.length === 1 || (!firstPart.includes(".") && !firstPart.includes(":"))) {
        violations.push({
          rule: "MV4007",
          severity: "info",
          message: `Container "${container.name ?? index}" image "${image}" uses the implicit Docker Hub registry. Explicitly specify the full registry URL (e.g. docker.io/${image}) or use a private/mirrored registry.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "image"),
          fix: `Prefix the image with the full registry URL, e.g. "docker.io/${image}", or switch to a private registry.`,
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// Export all MV4 rules
// ---------------------------------------------------------------------------
export const mv4Rules: Rule[] = [
  mv4001,
  mv4002,
  mv4003,
  mv4004,
  mv4005,
  mv4006,
  mv4007,
];
