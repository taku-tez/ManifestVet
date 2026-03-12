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
// Sensitive patterns
// ---------------------------------------------------------------------------
const SENSITIVE_PATTERNS: string[] = [
  "PASSWORD",
  "SECRET",
  "TOKEN",
  "KEY",
  "API_KEY",
  "APIKEY",
  "PRIVATE_KEY",
  "CREDENTIAL",
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
 * Boolean-like values that indicate the env var is a feature flag, not a credential.
 * e.g. MYSQL_RANDOM_ROOT_PASSWORD="yes" tells MySQL to generate a random password;
 * it is not itself a hardcoded password.
 */
const BOOLEAN_VALUES = new Set(["yes", "no", "true", "false", "1", "0", "on", "off", "enabled", "disabled"]);

/**
 * Suffixes that indicate the env var holds a reference NAME or PATH,
 * not an actual secret value. e.g. WEBHOOK_SECRET_NAME="webhook-secret"
 * is a Kubernetes object name reference, not a hardcoded credential.
 */
const REFERENCE_SUFFIXES = [
  "_NAME",
  "_PATH",
  "_FILE",
  "_DIR",
  "_DIRECTORY",
  "_NAMESPACE",
  "_INTERVAL",
  "_PERIOD",
  "_TIMEOUT",
  "_SIZE",
  "_TYPE",
  "_PREFIX",
  "_SUFFIX",
  "_LABEL",
  "_ANNOTATION",
  "_MOUNT",
  "_MOUNT_PATH",
];

/**
 * Check if a name matches any of the sensitive patterns (case-insensitive).
 * Returns false for env vars whose names end with reference-only suffixes
 * (e.g. *_NAME, *_PATH) since those hold object references, not credentials.
 */
function matchesSensitivePattern(name: string): boolean {
  const upper = name.toUpperCase();
  // Skip names that end with a reference suffix — they hold names/paths, not secrets
  if (REFERENCE_SUFFIXES.some((s) => upper.endsWith(s))) return false;
  return SENSITIVE_PATTERNS.some((pattern) => upper.includes(pattern));
}

// ---------------------------------------------------------------------------
// MV5001 - Env var with hardcoded sensitive value
// ---------------------------------------------------------------------------
const mv5001: Rule = {
  id: "MV5001",
  severity: "high",
  description:
    "Environment variable with a sensitive name has a hardcoded value. Secrets should be injected via Secret references (valueFrom.secretKeyRef) rather than hardcoded in the manifest.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const envVars: any[] = container.env ?? [];
      envVars.forEach((envVar: any, envIndex: number) => {
        const envName: string = envVar.name ?? "";
        if (
          matchesSensitivePattern(envName) &&
          envVar.value !== undefined &&
          envVar.value !== null &&
          !envVar.valueFrom &&
          typeof envVar.value === "string" &&
          envVar.value !== "" &&
          !BOOLEAN_VALUES.has(envVar.value.toLowerCase())
        ) {
          violations.push({
            rule: "MV5001",
            severity: "high",
            message: `Container "${container.name ?? index}" has environment variable "${envName}" with a hardcoded sensitive value.`,
            resource: resourceId,
            namespace: resource.metadata.namespace,
            path: containerPath(resource, prefix, index, `env[${envIndex}].value`),
            fix: "Use valueFrom.secretKeyRef to reference a Kubernetes Secret instead of hardcoding the value.",
          });
        }
      });
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV5002 - Opaque Secret with sensitive key names in data
// ---------------------------------------------------------------------------
const mv5002: Rule = {
  id: "MV5002",
  severity: "medium",
  description:
    'Secret of type "Opaque" contains keys with sensitive names in its data field. Sensitive data should be properly managed through external secret management solutions.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Secret") return [];

    // Opaque is the default type when type is missing
    const secretType = resource.type ?? "Opaque";
    if (secretType !== "Opaque") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    if (resource.data && typeof resource.data === "object") {
      const keys = Object.keys(resource.data);
      for (const key of keys) {
        if (matchesSensitivePattern(key)) {
          violations.push({
            rule: "MV5002",
            severity: "medium",
            message: `Secret "${resource.metadata.name}" has sensitive key "${key}" in its data field.`,
            resource: resourceId,
            namespace: resource.metadata.namespace,
            path: `data.${key}`,
            fix: "Consider using an external secret management solution (e.g. Sealed Secrets, External Secrets Operator, or a vault) to manage sensitive data.",
          });
        }
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV5003 - ConfigMap with sensitive key names
// ---------------------------------------------------------------------------
const mv5003: Rule = {
  id: "MV5003",
  severity: "low",
  description:
    "ConfigMap contains keys with sensitive names. Sensitive data should be stored in Secrets, not ConfigMaps, since ConfigMaps are not encrypted at rest.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "ConfigMap") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    if (resource.data && typeof resource.data === "object") {
      const keys = Object.keys(resource.data);
      for (const key of keys) {
        if (matchesSensitivePattern(key)) {
          violations.push({
            rule: "MV5003",
            severity: "low",
            message: `ConfigMap "${resource.metadata.name}" has a key "${key}" that appears to contain sensitive data.`,
            resource: resourceId,
            namespace: resource.metadata.namespace,
            path: `data.${key}`,
            fix: "Move sensitive data to a Kubernetes Secret instead of storing it in a ConfigMap.",
          });
        }
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV5004 - Volume using hostPath
// ---------------------------------------------------------------------------
const mv5004: Rule = {
  id: "MV5004",
  severity: "info",
  description:
    "Pod spec uses a hostPath volume. hostPath volumes mount directories from the host node's filesystem, which can pose security risks by exposing the host to the container.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (!podSpec) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    const volumes: any[] = podSpec.volumes ?? [];
    volumes.forEach((volume: any, volumeIndex: number) => {
      if (volume.hostPath) {
        violations.push({
          rule: "MV5004",
          severity: "info",
          message: `Volume "${volume.name ?? volumeIndex}" uses hostPath "${volume.hostPath.path ?? ""}", which mounts a host directory into the pod.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, `volumes[${volumeIndex}].hostPath`),
          fix: "Avoid hostPath volumes. Use persistent volume claims, emptyDir, configMap, or secret volumes instead.",
        });
      }
    });

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV5005 - Sensitive env var sourced from ConfigMap instead of Secret
// ---------------------------------------------------------------------------
const mv5005: Rule = {
  id: "MV5005",
  severity: "info",
  description:
    "Environment variable with a sensitive name is sourced from a ConfigMap (configMapKeyRef) instead of a Secret (secretKeyRef). Sensitive values should be stored in Secrets, which are encrypted at rest.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const envVars: any[] = container.env ?? [];
      envVars.forEach((envVar: any, envIndex: number) => {
        const envName: string = envVar.name ?? "";
        if (
          matchesSensitivePattern(envName) &&
          envVar.valueFrom?.configMapKeyRef
        ) {
          violations.push({
            rule: "MV5005",
            severity: "info",
            message: `Container "${container.name ?? index}" has environment variable "${envName}" sourced from ConfigMap "${envVar.valueFrom.configMapKeyRef.name ?? "unknown"}" instead of a Secret.`,
            resource: resourceId,
            namespace: resource.metadata.namespace,
            path: containerPath(resource, prefix, index, `env[${envIndex}].valueFrom.configMapKeyRef`),
            fix: "Use valueFrom.secretKeyRef to source sensitive values from a Kubernetes Secret instead of a ConfigMap.",
          });
        }
      });
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// Export all MV5 rules
// ---------------------------------------------------------------------------
export const mv5Rules: Rule[] = [
  mv5001,
  mv5002,
  mv5003,
  mv5004,
  mv5005,
];
