import { K8sResource } from "../parser/types";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Violation {
  rule: string;
  severity: Severity;
  message: string;
  resource: string;
  namespace?: string;
  path?: string;
  fix?: string;
}

/** Subset of ManifestVetConfig that rules may read. */
export interface RuleConfig {
  allowedRegistries?: string[];
}

export interface RuleContext {
  resource: K8sResource;
  allResources: K8sResource[];
  filePath?: string;
  config?: RuleConfig;
}

export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  url?: string;
  tags?: string[];
  check(ctx: RuleContext): Violation[];
}
