import { K8sResource } from "../parser/types";
import { ALL_RULES } from "../rules";
import { Violation, Severity, Rule } from "../rules/types";
import { ManifestVetConfig } from "./config";
import { getRulesToSkip } from "../k8s-versions";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function lint(
  resources: K8sResource[],
  config: ManifestVetConfig,
  extraRules: Rule[] = []
): Violation[] {
  const violations: Violation[] = [];
  const ignoreSet = new Set(config.ignore.map((r) => r.toUpperCase()));
  const minSeverity = SEVERITY_ORDER[config.severity];
  const rules = [...ALL_RULES, ...extraRules];
  const versionSkip = config.k8sVersion ? getRulesToSkip(config.k8sVersion) : new Set<string>();
  const nsExclusions = new Set(config.namespaceExclusions ?? []);
  // Normalise override keys to uppercase for case-insensitive lookup
  const overrides: Record<string, Severity> = {};
  for (const [id, sev] of Object.entries(config.severityOverrides ?? {})) {
    overrides[id.toUpperCase()] = sev as Severity;
  }

  for (const resource of resources) {
    if (nsExclusions.size > 0 && resource.metadata?.namespace && nsExclusions.has(resource.metadata.namespace)) {
      continue;
    }
    for (const rule of rules) {
      if (ignoreSet.has(rule.id.toUpperCase())) continue;
      if (versionSkip.has(rule.id)) continue;

      // Apply per-rule severity override; affects both filtering and emitted violations
      const effectiveSeverity: Severity = overrides[rule.id.toUpperCase()] ?? rule.severity;
      if (SEVERITY_ORDER[effectiveSeverity] < minSeverity) continue;

      const results = rule.check({
        resource,
        allResources: resources,
        config: { allowedRegistries: config.allowedRegistries },
      });

      // Stamp overridden severity onto violations
      if (overrides[rule.id.toUpperCase()]) {
        for (const v of results) v.severity = effectiveSeverity;
      }

      violations.push(...results);
    }
  }

  // Deduplicate: same rule + resource + namespace + message from multiple files
  // (common when a project has overlapping manifests or copied base files)
  const seen = new Set<string>();
  const deduped = violations.filter((v) => {
    const key = `${v.rule}|${v.resource}|${v.namespace ?? ""}|${v.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.rule.localeCompare(b.rule);
  });
}
