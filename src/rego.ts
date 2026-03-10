import { spawnSync } from "child_process";
import * as fs from "fs";
import { K8sResource } from "./parser/types";
import { Violation, Severity } from "./rules/types";

/**
 * OPA/Rego policy integration.
 *
 * The Rego policy must define violations under `data.manifestvet.violations`
 * as an array of objects matching the Violation interface.
 *
 * Example policy (policy.rego):
 * ```rego
 * package manifestvet
 *
 * violations[v] {
 *   resource := input.resources[_]
 *   resource.kind == "Deployment"
 *   not resource.metadata.labels["app.kubernetes.io/name"]
 *   v := {
 *     "rule": "ORG002",
 *     "severity": "warning",
 *     "message": "Deployment missing app.kubernetes.io/name label",
 *     "resource": concat("/", [resource.kind, resource.metadata.name]),
 *   }
 * }
 * ```
 */
export function evalRegoPolicy(
  policyPath: string,
  resources: K8sResource[]
): Violation[] {
  if (!fs.existsSync(policyPath)) {
    throw new Error(`Rego policy file not found: ${policyPath}`);
  }

  const input = JSON.stringify({ resources });

  const result = spawnSync(
    "opa",
    [
      "eval",
      "--format", "json",
      "--stdin-input",
      "--data", policyPath,
      "data.manifestvet.violations",
    ],
    { input, encoding: "utf-8" }
  );

  if (result.error) {
    throw new Error(
      `"opa" command not found. Install OPA: https://www.openpolicyagent.org/docs/latest/#running-opa`
    );
  }

  if (result.status !== 0) {
    throw new Error(
      `OPA evaluation failed:\n${result.stderr?.trim() ?? "unknown error"}`
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`Failed to parse OPA output: ${result.stdout}`);
  }

  // OPA returns: { "result": [{ "expressions": [{ "value": [...] }] }] }
  const rawViolations: any[] = parsed?.result?.[0]?.expressions?.[0]?.value ?? [];

  return rawViolations.map((v: any): Violation => ({
    rule: String(v.rule ?? "REGO_UNKNOWN"),
    severity: (["error", "warning", "info"].includes(v.severity)
      ? v.severity
      : "warning") as Severity,
    message: String(v.message ?? "Rego policy violation"),
    resource: String(v.resource ?? "unknown"),
    namespace: v.namespace ? String(v.namespace) : undefined,
    path: v.path ? String(v.path) : undefined,
  }));
}

/**
 * Check if the `opa` CLI is available.
 */
export function isOpaAvailable(): boolean {
  const result = spawnSync("opa", ["version"], { encoding: "utf-8" });
  return result.status === 0;
}
