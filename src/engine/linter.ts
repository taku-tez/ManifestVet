import { K8sResource } from "../parser/types";
import { ALL_RULES } from "../rules";
import { Violation, Severity, Rule } from "../rules/types";
import { ManifestVetConfig } from "./config";

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 3,
  warning: 2,
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

  for (const resource of resources) {
    for (const rule of rules) {
      if (ignoreSet.has(rule.id.toUpperCase())) continue;
      if (SEVERITY_ORDER[rule.severity] < minSeverity) continue;

      const results = rule.check({
        resource,
        allResources: resources,
      });

      violations.push(...results);
    }
  }

  return violations.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.rule.localeCompare(b.rule);
  });
}
