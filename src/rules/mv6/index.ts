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
// Recommended labels for Deployment / StatefulSet
// ---------------------------------------------------------------------------
const RECOMMENDED_LABELS = [
  "app.kubernetes.io/name",
  "app.kubernetes.io/version",
  "app.kubernetes.io/managed-by",
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

// ---------------------------------------------------------------------------
// MV6001 - Deployment/StatefulSet missing recommended labels
// ---------------------------------------------------------------------------
const mv6001: Rule = {
  id: "MV6001",
  severity: "low",
  description:
    "Deployment or StatefulSet is missing recommended Kubernetes labels (app.kubernetes.io/name, app.kubernetes.io/version, app.kubernetes.io/managed-by). These labels improve observability and tooling integration.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Deployment" && resource.kind !== "StatefulSet") {
      return [];
    }

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const labels = resource.metadata.labels;

    if (!labels) {
      return [
        {
          rule: "MV6001",
          severity: "low",
          message: `${resource.kind} "${resource.metadata.name}" has no metadata.labels. Recommended labels: ${RECOMMENDED_LABELS.join(", ")}.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "metadata.labels",
          fix: `Add recommended labels to metadata.labels: ${RECOMMENDED_LABELS.join(", ")}.`,
        },
      ];
    }

    const hasAtLeastOne = RECOMMENDED_LABELS.some(
      (label) => labels[label] !== undefined,
    );

    if (!hasAtLeastOne) {
      return [
        {
          rule: "MV6001",
          severity: "low",
          message: `${resource.kind} "${resource.metadata.name}" is missing all recommended labels. Include at least one of: ${RECOMMENDED_LABELS.join(", ")}.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "metadata.labels",
          fix: `Add at least one of the recommended labels to metadata.labels: ${RECOMMENDED_LABELS.join(", ")}.`,
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6002 - Deployment with replicas: 1 (no HA)
// ---------------------------------------------------------------------------
const mv6002: Rule = {
  id: "MV6002",
  severity: "low",
  description:
    "Deployment has replicas set to 1 (or omitted, which defaults to 1). A single replica provides no high availability; if the pod crashes, there will be downtime until it is rescheduled.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Deployment") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const replicas = resource.spec?.replicas;

    if (replicas === undefined || replicas === null || replicas === 1) {
      return [
        {
          rule: "MV6002",
          severity: "low",
          message: `Deployment "${resource.metadata.name}" has ${replicas === undefined || replicas === null ? "no replicas specified (defaults to 1)" : "replicas set to 1"}, which provides no high availability.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.replicas",
          fix: "Set spec.replicas to at least 2 for high availability.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6003 - Containers missing livenessProbe
// ---------------------------------------------------------------------------
const mv6003: Rule = {
  id: "MV6003",
  severity: "low",
  description:
    "One or more containers are missing a livenessProbe. Liveness probes allow Kubernetes to detect and restart containers that are stuck in a broken state.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (!container.livenessProbe) {
        violations.push({
          rule: "MV6003",
          severity: "low",
          message: `Container "${container.name ?? index}" is missing a livenessProbe.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "livenessProbe"),
          fix: "Add a livenessProbe (httpGet, tcpSocket, exec, or grpc) to the container spec.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV6004 - Containers missing readinessProbe
// ---------------------------------------------------------------------------
const mv6004: Rule = {
  id: "MV6004",
  severity: "low",
  description:
    "One or more containers are missing a readinessProbe. Readiness probes prevent traffic from being sent to pods that are not yet ready to handle requests.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (!container.readinessProbe) {
        violations.push({
          rule: "MV6004",
          severity: "low",
          message: `Container "${container.name ?? index}" is missing a readinessProbe.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "readinessProbe"),
          fix: "Add a readinessProbe (httpGet, tcpSocket, exec, or grpc) to the container spec.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV6005 - Deployment missing podAntiAffinity
// ---------------------------------------------------------------------------
const mv6005: Rule = {
  id: "MV6005",
  severity: "low",
  description:
    "Deployment is missing podAntiAffinity. Without pod anti-affinity rules, multiple replicas may be scheduled on the same node, reducing fault tolerance.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Deployment") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const podSpec = resource.spec?.template?.spec;

    if (!podSpec?.affinity?.podAntiAffinity) {
      return [
        {
          rule: "MV6005",
          severity: "low",
          message: `Deployment "${resource.metadata.name}" does not define podAntiAffinity. Replicas may be scheduled on the same node.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.template.spec.affinity.podAntiAffinity",
          fix: "Add spec.template.spec.affinity.podAntiAffinity to spread replicas across nodes.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6006 - Deployment without rollingUpdate strategy
// ---------------------------------------------------------------------------
const mv6006: Rule = {
  id: "MV6006",
  severity: "low",
  description:
    "Deployment does not use a RollingUpdate strategy. RollingUpdate allows zero-downtime deployments by gradually replacing old pods with new ones.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Deployment") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const strategy = resource.spec?.strategy;

    // If strategy is missing entirely, flag it
    if (!strategy) {
      return [
        {
          rule: "MV6006",
          severity: "low",
          message: `Deployment "${resource.metadata.name}" does not define a deployment strategy. Explicitly set strategy.type to "RollingUpdate" for zero-downtime deployments.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.strategy",
          fix: 'Add spec.strategy with type: "RollingUpdate" and configure rollingUpdate.maxSurge / rollingUpdate.maxUnavailable.',
        },
      ];
    }

    // If strategy.type is explicitly "RollingUpdate" or rollingUpdate config exists, it's fine
    if (strategy.type === "RollingUpdate" || strategy.rollingUpdate) {
      return [];
    }

    // Otherwise (e.g. strategy.type is "Recreate"), flag it
    return [
      {
        rule: "MV6006",
        severity: "low",
        message: `Deployment "${resource.metadata.name}" uses strategy type "${strategy.type ?? "unknown"}" instead of "RollingUpdate". This may cause downtime during deployments.`,
        resource: resourceId,
        namespace: resource.metadata.namespace,
        path: "spec.strategy.type",
        fix: 'Set spec.strategy.type to "RollingUpdate" and configure rollingUpdate.maxSurge / rollingUpdate.maxUnavailable for zero-downtime deployments.',
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// MV6007 - Containers missing lifecycle.preStop hook
// ---------------------------------------------------------------------------
const mv6007: Rule = {
  id: "MV6007",
  severity: "low",
  description:
    "One or more containers are missing a lifecycle.preStop hook. A preStop hook allows the container to gracefully shut down before receiving SIGTERM, enabling connection draining and cleanup.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (!container.lifecycle?.preStop) {
        violations.push({
          rule: "MV6007",
          severity: "low",
          message: `Container "${container.name ?? index}" is missing a lifecycle.preStop hook.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "lifecycle.preStop"),
          fix: "Add a lifecycle.preStop hook (exec or httpGet) to allow graceful shutdown before SIGTERM.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV6008 - Namespace is "default"
// ---------------------------------------------------------------------------
const mv6008: Rule = {
  id: "MV6008",
  severity: "low",
  description:
    'Resource is deployed to the "default" namespace. Using the default namespace is discouraged because it makes it harder to manage resources, apply RBAC policies, and enforce resource quotas.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;

    if (resource.metadata.namespace !== "default") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;

    return [
      {
        rule: "MV6008",
        severity: "low",
        message: `${resource.kind} "${resource.metadata.name}" is in the "default" namespace.`,
        resource: resourceId,
        namespace: resource.metadata.namespace,
        path: "metadata.namespace",
        fix: "Move the resource to a dedicated namespace instead of using the default namespace.",
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// MV6009 - metadata.name missing or empty
// ---------------------------------------------------------------------------
const mv6009: Rule = {
  id: "MV6009",
  severity: "high",
  description:
    "Resource metadata.name is missing or empty. Every Kubernetes resource must have a unique name within its namespace.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;

    const name = resource.metadata?.name;

    if (name === undefined || name === null || name === "") {
      const resourceId = `${resource.kind}/${name ?? ""}`;

      return [
        {
          rule: "MV6009",
          severity: "high",
          message: `${resource.kind} has a missing or empty metadata.name.`,
          resource: resourceId,
          namespace: resource.metadata?.namespace,
          path: "metadata.name",
          fix: "Set a valid, non-empty metadata.name for the resource.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6010 - Deployment without minReadySeconds
// ---------------------------------------------------------------------------
const mv6010: Rule = {
  id: "MV6010",
  severity: "low",
  description:
    "Deployment does not set minReadySeconds. Without minReadySeconds, a new pod is considered available as soon as it is ready, which may not allow enough time to catch startup issues before rolling forward.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Deployment") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const minReadySeconds = resource.spec?.minReadySeconds;

    if (minReadySeconds === undefined || minReadySeconds === null || minReadySeconds <= 0) {
      return [
        {
          rule: "MV6010",
          severity: "low",
          message: `Deployment "${resource.metadata.name}" does not set minReadySeconds (or it is set to 0). New pods will be considered available immediately after becoming ready.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.minReadySeconds",
          fix: "Set spec.minReadySeconds to a positive value (e.g. 10) to ensure new pods are stable before the rollout continues.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6011 - Container terminationMessagePolicy not FallbackToLogsOnError
// ---------------------------------------------------------------------------
const mv6011: Rule = {
  id: "MV6011",
  severity: "low",
  description:
    'Containers should set terminationMessagePolicy to "FallbackToLogsOnError" to ensure useful termination messages are available even when the container does not write to the termination message file.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const policy = container.terminationMessagePolicy;
      if (policy !== "FallbackToLogsOnError") {
        violations.push({
          rule: "MV6011",
          severity: "low",
          message: `Container "${container.name ?? index}" in ${resourceId} does not set terminationMessagePolicy to "FallbackToLogsOnError" (current: ${policy ?? "not set"}).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "terminationMessagePolicy"),
          fix: 'Set terminationMessagePolicy: FallbackToLogsOnError to get log output as the termination message when the termination message file is empty.',
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV6012 - Deployment revisionHistoryLimit not set or too large
// ---------------------------------------------------------------------------
const mv6012: Rule = {
  id: "MV6012",
  severity: "low",
  description:
    "Deployment should set revisionHistoryLimit to a reasonable value to control the number of old ReplicaSets retained. Keeping too many (default is 10) wastes etcd storage.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Deployment") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const limit = resource.spec?.revisionHistoryLimit;

    if (limit === undefined || limit === null || limit > 10) {
      return [
        {
          rule: "MV6012",
          severity: "low",
          message: `Deployment "${resource.metadata.name}" has revisionHistoryLimit set to ${limit ?? "default (10)"}. Consider setting it to 3–5 to reduce etcd overhead.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.revisionHistoryLimit",
          fix: "Set spec.revisionHistoryLimit to 3 or 5 to limit the number of retained old ReplicaSets.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6013 - StatefulSet missing podManagementPolicy: Parallel
// ---------------------------------------------------------------------------
const mv6013: Rule = {
  id: "MV6013",
  severity: "low",
  description:
    'StatefulSet uses the default sequential pod management policy. Setting podManagementPolicy to "Parallel" can significantly reduce startup time when scaling or updating, unless strict ordering is required.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "StatefulSet") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const policy = resource.spec?.podManagementPolicy;

    // Only flag if it's explicitly OrderedReady or not set (default = OrderedReady)
    if (!policy || policy === "OrderedReady") {
      return [
        {
          rule: "MV6013",
          severity: "low",
          message: `StatefulSet "${resource.metadata.name}" uses podManagementPolicy "${policy ?? "OrderedReady (default)"}". Consider "Parallel" if pod ordering is not required.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.podManagementPolicy",
          fix: 'Set spec.podManagementPolicy: Parallel to allow pods to start and stop simultaneously, reducing scale-up time.',
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6014 - Container with livenessProbe but no startupProbe
// ---------------------------------------------------------------------------
const mv6014: Rule = {
  id: "MV6014",
  severity: "low",
  description:
    "Container defines a livenessProbe but no startupProbe. Without a startupProbe, Kubernetes uses the livenessProbe during startup, which may kill a slow-starting container before it is ready.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.livenessProbe && !container.startupProbe) {
        violations.push({
          rule: "MV6014",
          severity: "low",
          message: `Container "${container.name ?? index}" has a livenessProbe but no startupProbe. Add a startupProbe to protect slow-starting containers from premature restarts.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "startupProbe"),
          fix: "Add a startupProbe with an appropriate failureThreshold and periodSeconds to give the container time to start.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV6015 - Deployment without PodDisruptionBudget
// ---------------------------------------------------------------------------
const mv6015: Rule = {
  id: "MV6015",
  severity: "low",
  description: "Deployment with multiple replicas should have a PodDisruptionBudget to maintain availability during voluntary disruptions.",
  check(ctx: RuleContext): Violation[] {
    const { resource, allResources } = ctx;
    if (resource.kind !== "Deployment") return [];

    const replicas = resource.spec?.replicas ?? 1;
    if (replicas < 2) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const deployLabels: Record<string, string> = resource.spec?.selector?.matchLabels ?? {};
    if (Object.keys(deployLabels).length === 0) return [];

    const hasPDB = allResources.some((r: any) => {
      if (r.kind !== "PodDisruptionBudget") return false;
      // namespace must match (or PDB has no namespace)
      if (r.metadata?.namespace && resource.metadata?.namespace &&
          r.metadata.namespace !== resource.metadata.namespace) return false;
      const pdbLabels: Record<string, string> = r.spec?.selector?.matchLabels ?? {};
      // PDB selector must be a subset of deployment selector labels
      return Object.entries(pdbLabels).every(([k, v]) => deployLabels[k] === v);
    });

    if (!hasPDB) {
      return [{
        rule: "MV6015",
        severity: "low",
        message: `Deployment "${resource.metadata.name}" has ${replicas} replicas but no matching PodDisruptionBudget.`,
        resource: resourceId,
        namespace: resource.metadata?.namespace,
        path: "metadata.name",
        fix: "Create a PodDisruptionBudget to protect this Deployment during node maintenance.",
      }];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV6016 - Deprecated Kubernetes API version
// ---------------------------------------------------------------------------

interface DeprecatedAPI {
  apiVersion: string;
  removedIn: string;
  replacement: string;
}

const DEPRECATED_APIS: DeprecatedAPI[] = [
  // Removed in Kubernetes 1.16
  { apiVersion: "extensions/v1beta1",   removedIn: "1.16", replacement: "apps/v1 (or networking.k8s.io/v1 for Ingress/NetworkPolicy)" },
  { apiVersion: "apps/v1beta1",         removedIn: "1.16", replacement: "apps/v1" },
  { apiVersion: "apps/v1beta2",         removedIn: "1.16", replacement: "apps/v1" },
  // Removed in Kubernetes 1.22
  { apiVersion: "networking.k8s.io/v1beta1",              removedIn: "1.22", replacement: "networking.k8s.io/v1" },
  { apiVersion: "rbac.authorization.k8s.io/v1beta1",      removedIn: "1.22", replacement: "rbac.authorization.k8s.io/v1" },
  { apiVersion: "storage.k8s.io/v1beta1",                 removedIn: "1.22", replacement: "storage.k8s.io/v1" },
  { apiVersion: "apiextensions.k8s.io/v1beta1",           removedIn: "1.22", replacement: "apiextensions.k8s.io/v1" },
  { apiVersion: "certificates.k8s.io/v1beta1",            removedIn: "1.22", replacement: "certificates.k8s.io/v1" },
  { apiVersion: "scheduling.k8s.io/v1beta1",              removedIn: "1.22", replacement: "scheduling.k8s.io/v1" },
  { apiVersion: "coordination.k8s.io/v1beta1",            removedIn: "1.22", replacement: "coordination.k8s.io/v1" },
  // Removed in Kubernetes 1.25
  { apiVersion: "batch/v1beta1",        removedIn: "1.25", replacement: "batch/v1" },
  { apiVersion: "policy/v1beta1",       removedIn: "1.25", replacement: "policy/v1 (or Pod Security Admission for PSP)" },
  { apiVersion: "events.k8s.io/v1beta1",    removedIn: "1.25", replacement: "events.k8s.io/v1" },
  { apiVersion: "discovery.k8s.io/v1beta1", removedIn: "1.25", replacement: "discovery.k8s.io/v1" },
  // Removed in Kubernetes 1.26
  { apiVersion: "autoscaling/v2beta1",  removedIn: "1.26", replacement: "autoscaling/v2" },
  { apiVersion: "autoscaling/v2beta2",  removedIn: "1.26", replacement: "autoscaling/v2" },
  // Removed in Kubernetes 1.27
  { apiVersion: "storage.k8s.io/v1beta1", removedIn: "1.27", replacement: "storage.k8s.io/v1" },
];

const DEPRECATED_API_MAP = new Map(DEPRECATED_APIS.map((d) => [d.apiVersion, d]));

const mv6016: Rule = {
  id: "MV6016",
  severity: "medium",
  description:
    "Resource uses a deprecated and removed Kubernetes API version. Manifests using removed APIs will fail on newer clusters.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    const apiVersion = resource.apiVersion as string | undefined;
    if (!apiVersion) return [];

    const deprecated = DEPRECATED_API_MAP.get(apiVersion);
    if (!deprecated) return [];

    const resourceId = `${resource.kind}/${resource.metadata?.name ?? "unknown"}`;
    return [
      {
        rule: "MV6016",
        severity: "medium",
        message: `${resourceId} uses deprecated apiVersion "${apiVersion}" (removed in Kubernetes ${deprecated.removedIn}). Migrate to ${deprecated.replacement}.`,
        resource: resourceId,
        namespace: resource.metadata?.namespace,
        path: "apiVersion",
        fix: `Update apiVersion from "${apiVersion}" to "${deprecated.replacement}".`,
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Export all MV6 rules
// ---------------------------------------------------------------------------
export const mv6Rules: Rule[] = [
  mv6001,
  mv6002,
  mv6003,
  mv6004,
  mv6005,
  mv6006,
  mv6007,
  mv6008,
  mv6009,
  mv6010,
  mv6011,
  mv6012,
  mv6013,
  mv6014,
  mv6015,
  mv6016,
];
