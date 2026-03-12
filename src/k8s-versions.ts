export interface DeprecatedAPI {
  apiVersion: string;
  kind: string;
  deprecatedIn?: string;
  removedIn?: string;
  replacement?: string;
}

/** Parse "1.28" or "v1.28" to a comparable integer. */
export function parseVersion(v: string): number {
  const [major, minor] = v.replace(/^v/, "").split(".").map(Number);
  return (major ?? 1) * 1000 + (minor ?? 0);
}

/**
 * Known deprecated/removed Kubernetes APIs.
 * Source: https://kubernetes.io/docs/reference/using-api/deprecation-guide/
 */
export const DEPRECATED_APIS: DeprecatedAPI[] = [
  // Ingress
  { apiVersion: "extensions/v1beta1", kind: "Ingress", deprecatedIn: "1.14", removedIn: "1.22", replacement: "networking.k8s.io/v1" },
  { apiVersion: "networking.k8s.io/v1beta1", kind: "Ingress", deprecatedIn: "1.19", removedIn: "1.22", replacement: "networking.k8s.io/v1" },
  // NetworkPolicy
  { apiVersion: "extensions/v1beta1", kind: "NetworkPolicy", removedIn: "1.16", replacement: "networking.k8s.io/v1" },
  // Deployment
  { apiVersion: "extensions/v1beta1", kind: "Deployment", removedIn: "1.16", replacement: "apps/v1" },
  { apiVersion: "apps/v1beta1", kind: "Deployment", removedIn: "1.16", replacement: "apps/v1" },
  { apiVersion: "apps/v1beta2", kind: "Deployment", removedIn: "1.16", replacement: "apps/v1" },
  // DaemonSet
  { apiVersion: "extensions/v1beta1", kind: "DaemonSet", removedIn: "1.16", replacement: "apps/v1" },
  { apiVersion: "apps/v1beta2", kind: "DaemonSet", removedIn: "1.16", replacement: "apps/v1" },
  // StatefulSet
  { apiVersion: "apps/v1beta1", kind: "StatefulSet", removedIn: "1.16", replacement: "apps/v1" },
  { apiVersion: "apps/v1beta2", kind: "StatefulSet", removedIn: "1.16", replacement: "apps/v1" },
  // ReplicaSet
  { apiVersion: "extensions/v1beta1", kind: "ReplicaSet", removedIn: "1.16", replacement: "apps/v1" },
  { apiVersion: "apps/v1beta2", kind: "ReplicaSet", removedIn: "1.16", replacement: "apps/v1" },
  // PodSecurityPolicy
  { apiVersion: "policy/v1beta1", kind: "PodSecurityPolicy", deprecatedIn: "1.21", removedIn: "1.25" },
  // CronJob
  { apiVersion: "batch/v1beta1", kind: "CronJob", deprecatedIn: "1.21", removedIn: "1.25", replacement: "batch/v1" },
  // HorizontalPodAutoscaler
  { apiVersion: "autoscaling/v2beta1", kind: "HorizontalPodAutoscaler", removedIn: "1.26", replacement: "autoscaling/v2" },
  { apiVersion: "autoscaling/v2beta2", kind: "HorizontalPodAutoscaler", deprecatedIn: "1.23", removedIn: "1.26", replacement: "autoscaling/v2" },
  // FlowSchema
  { apiVersion: "flowcontrol.apiserver.k8s.io/v1beta1", kind: "FlowSchema", removedIn: "1.29", replacement: "flowcontrol.apiserver.k8s.io/v1" },
  { apiVersion: "flowcontrol.apiserver.k8s.io/v1beta2", kind: "FlowSchema", removedIn: "1.29", replacement: "flowcontrol.apiserver.k8s.io/v1" },
  // StorageClass
  { apiVersion: "storage.k8s.io/v1beta1", kind: "StorageClass", removedIn: "1.22", replacement: "storage.k8s.io/v1" },
  // PodDisruptionBudget
  { apiVersion: "policy/v1beta1", kind: "PodDisruptionBudget", deprecatedIn: "1.21", removedIn: "1.25", replacement: "policy/v1" },
  // ValidatingWebhookConfiguration / MutatingWebhookConfiguration
  { apiVersion: "admissionregistration.k8s.io/v1beta1", kind: "ValidatingWebhookConfiguration", removedIn: "1.22", replacement: "admissionregistration.k8s.io/v1" },
  { apiVersion: "admissionregistration.k8s.io/v1beta1", kind: "MutatingWebhookConfiguration", removedIn: "1.22", replacement: "admissionregistration.k8s.io/v1" },
  // ClusterRole / Role (rbac.authorization.k8s.io/v1beta1)
  { apiVersion: "rbac.authorization.k8s.io/v1beta1", kind: "ClusterRole", removedIn: "1.22", replacement: "rbac.authorization.k8s.io/v1" },
  { apiVersion: "rbac.authorization.k8s.io/v1beta1", kind: "ClusterRoleBinding", removedIn: "1.22", replacement: "rbac.authorization.k8s.io/v1" },
  { apiVersion: "rbac.authorization.k8s.io/v1beta1", kind: "Role", removedIn: "1.22", replacement: "rbac.authorization.k8s.io/v1" },
  { apiVersion: "rbac.authorization.k8s.io/v1beta1", kind: "RoleBinding", removedIn: "1.22", replacement: "rbac.authorization.k8s.io/v1" },
];

/** APIs removed at or before the given version. */
export function getRemovedAPIs(targetVersion: string): DeprecatedAPI[] {
  const target = parseVersion(targetVersion);
  return DEPRECATED_APIS.filter((api) => api.removedIn && parseVersion(api.removedIn) <= target);
}

/** APIs deprecated (but not yet removed) for the given version. */
export function getDeprecatedAPIs(targetVersion: string): DeprecatedAPI[] {
  const target = parseVersion(targetVersion);
  return DEPRECATED_APIS.filter((api) => {
    const isDeprecated = api.deprecatedIn ? parseVersion(api.deprecatedIn) <= target : false;
    const isRemoved = api.removedIn ? parseVersion(api.removedIn) <= target : false;
    return isDeprecated && !isRemoved;
  });
}

/**
 * Rule IDs that require a minimum K8s version to be meaningful.
 * Rules not listed here apply to all versions.
 */
export const RULE_MIN_VERSION: Record<string, string> = {
  // Pod Security Admission labels only exist 1.23+
  // (none currently require version gating — this map is extensible)
};

/** Return rule IDs that should be skipped for the given K8s version. */
export function getRulesToSkip(targetVersion: string): Set<string> {
  const target = parseVersion(targetVersion);
  const skip = new Set<string>();
  for (const [ruleId, minVersion] of Object.entries(RULE_MIN_VERSION)) {
    if (parseVersion(minVersion) > target) skip.add(ruleId);
  }
  return skip;
}

/**
 * Check whether a resource uses a deprecated or removed API for the given K8s version.
 * Returns a human-readable string if there's an issue, or undefined if OK.
 */
export function checkAPIVersion(
  apiVersion: string,
  kind: string,
  targetVersion: string
): { status: "removed" | "deprecated"; replacement?: string; since: string } | undefined {
  const target = parseVersion(targetVersion);
  const entry = DEPRECATED_APIS.find(
    (a) => a.apiVersion === apiVersion && a.kind === kind
  );
  if (!entry) return undefined;

  if (entry.removedIn && parseVersion(entry.removedIn) <= target) {
    return { status: "removed", replacement: entry.replacement, since: entry.removedIn };
  }
  if (entry.deprecatedIn && parseVersion(entry.deprecatedIn) <= target) {
    return { status: "deprecated", replacement: entry.replacement, since: entry.deprecatedIn };
  }
  return undefined;
}
