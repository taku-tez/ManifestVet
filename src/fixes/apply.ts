import * as fs from "fs";
import * as yaml from "js-yaml";
import { Violation } from "../rules/types";
import { getTemplate } from "./templates";

interface ApplyResult {
  file: string;
  applied: number;
  skipped: number;
  backupPath: string;
}

/**
 * Deep-merge `patch` into `target` (non-destructive: only adds missing keys).
 */
function mergeDeep(target: any, patch: any): any {
  if (typeof patch !== "object" || patch === null) return target;
  const result = { ...target };
  for (const key of Object.keys(patch)) {
    if (
      key in result &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = mergeDeep(result[key], patch[key]);
    } else if (!(key in result)) {
      result[key] = patch[key];
    }
    // If key already exists with a scalar value, don't overwrite (safe mode)
  }
  return result;
}

/**
 * Build a patch object (parsed from YAML) for a rule's safe fix.
 * Returns undefined for rules that are not safe to auto-apply.
 */
function buildPatchObject(ruleId: string): any | undefined {
  const template = getTemplate(ruleId);
  if (!template || !template.safe) return undefined;

  try {
    return yaml.load(template.patch);
  } catch {
    return undefined;
  }
}

/**
 * Apply safe fixes to a single YAML file.
 * Creates a .manifestvet.bak backup before modifying.
 */
export function applyFixesToFile(
  filePath: string,
  violations: Violation[]
): ApplyResult {
  const backupPath = `${filePath}.manifestvet.bak`;
  const original = fs.readFileSync(filePath, "utf-8");

  // Backup
  fs.writeFileSync(backupPath, original, "utf-8");

  let applied = 0;
  let skipped = 0;

  // Parse multi-doc YAML
  const docs: string[] = original.split(/^---\s*$/m);
  const updatedDocs: string[] = [];

  for (const doc of docs) {
    const trimmed = doc.trim();
    if (!trimmed) {
      updatedDocs.push(doc);
      continue;
    }

    let parsed: any;
    try {
      parsed = yaml.load(trimmed);
    } catch {
      updatedDocs.push(doc);
      continue;
    }

    if (!parsed || typeof parsed !== "object" || !parsed.apiVersion || !parsed.kind) {
      updatedDocs.push(doc);
      continue;
    }

    const resourceId = `${parsed.kind}/${parsed.metadata?.name ?? ""}`;
    const relevantViolations = violations.filter((v) =>
      v.resource === resourceId || v.resource.endsWith(`/${parsed.metadata?.name ?? ""}`)
    );

    let modified = parsed;
    let anyApplied = false;

    for (const violation of relevantViolations) {
      const patchObj = buildPatchObject(violation.rule);
      if (!patchObj) {
        skipped++;
        continue;
      }

      // Apply patch to the relevant location in the document
      // For container-level patches, we need to walk spec.template.spec.containers
      const isContainerLevel = violation.message.includes("containers[");
      if (isContainerLevel) {
        const containers = modified.spec?.template?.spec?.containers;
        if (Array.isArray(containers)) {
          modified = {
            ...modified,
            spec: {
              ...modified.spec,
              template: {
                ...modified.spec.template,
                spec: {
                  ...modified.spec.template.spec,
                  containers: containers.map((c: any) =>
                    mergeDeep(c, patchObj)
                  ),
                },
              },
            },
          };
          applied++;
          anyApplied = true;
        } else if (modified.spec?.containers) {
          // Pod-level
          modified = {
            ...modified,
            spec: {
              ...modified.spec,
              containers: modified.spec.containers.map((c: any) =>
                mergeDeep(c, patchObj)
              ),
            },
          };
          applied++;
          anyApplied = true;
        } else {
          skipped++;
        }
      } else {
        // Spec-level patches (e.g., automountServiceAccountToken, strategy, minReadySeconds)
        modified = mergeDeep(modified, { spec: patchObj });
        applied++;
        anyApplied = true;
      }
    }

    if (anyApplied) {
      updatedDocs.push(yaml.dump(modified, { lineWidth: -1 }));
    } else {
      updatedDocs.push(doc);
    }
  }

  const newContent = updatedDocs.join("\n---\n");
  fs.writeFileSync(filePath, newContent, "utf-8");

  return { file: filePath, applied, skipped, backupPath };
}

/**
 * Apply safe fixes to multiple files.
 */
export function applyFixesToFiles(
  files: string[],
  violations: Violation[]
): ApplyResult[] {
  return files.map((f) => applyFixesToFile(f, violations));
}
