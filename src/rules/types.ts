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

export interface RuleContext {
  resource: K8sResource;
  allResources: K8sResource[];
  filePath?: string;
}

export interface Rule {
  id: string;
  severity: Severity;
  description: string;
  url?: string;
  tags?: string[];
  check(ctx: RuleContext): Violation[];
}
