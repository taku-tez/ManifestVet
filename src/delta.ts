import { Violation } from "./rules/types";

/**
 * Compute a fingerprint for a violation to identify it across cluster/local scans.
 * We match on rule + resource kind+name + message to detect the same logical violation.
 */
function fingerprint(v: Violation): string {
  return `${v.rule}|${v.resource}|${v.message}`;
}

/**
 * Delta mode: return violations present in cluster scan that have no matching
 * violation in the local scan. These represent configuration drift—resources
 * in the cluster that are more insecure than what the local manifests describe.
 */
export function computeDelta(
  clusterViolations: Violation[],
  localViolations: Violation[]
): Violation[] {
  const localPrints = new Set(localViolations.map(fingerprint));
  return clusterViolations.filter((v) => !localPrints.has(fingerprint(v)));
}
