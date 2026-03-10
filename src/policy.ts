/**
 * Policy exceptions: parse `# manifestvet-ignore: MV1001,MV1002` comments
 * from raw YAML text, then filter violations accordingly.
 *
 * Supported forms:
 *   # manifestvet-ignore: MV1001
 *   # manifestvet-ignore: MV1001, MV1002, MV1003
 *   # manifestvet-ignore-all  (suppress all rules for this resource)
 */

import { Violation } from "./rules/types";

interface IgnoreDirective {
  /** null = ignore all */
  rules: Set<string> | null;
  /** resource identifier this directive applies to, or null = file-level */
  resource: string | null;
}

const IGNORE_RE = /^\s*#\s*manifestvet-ignore:\s*(.+)$/m;
const IGNORE_ALL_RE = /^\s*#\s*manifestvet-ignore-all\s*$/m;

/**
 * Extract ignore directives from raw YAML text.
 * We scan the text naively since YAML parsers strip comments.
 */
export function extractIgnoreDirectives(rawYaml: string): IgnoreDirective[] {
  const directives: IgnoreDirective[] = [];

  // File-level ignore-all
  if (IGNORE_ALL_RE.test(rawYaml)) {
    directives.push({ rules: null, resource: null });
    return directives;
  }

  // Line-by-line scan for # manifestvet-ignore: ...
  for (const match of rawYaml.matchAll(new RegExp(IGNORE_RE.source, "gm"))) {
    const ruleList = match[1]
      .split(",")
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean);
    directives.push({ rules: new Set(ruleList), resource: null });
  }

  return directives;
}

/**
 * Filter violations based on inline ignore directives extracted from
 * the original YAML file content.
 */
export function applyIgnoreDirectives(
  violations: Violation[],
  rawYaml: string
): Violation[] {
  const directives = extractIgnoreDirectives(rawYaml);
  if (directives.length === 0) return violations;

  return violations.filter((v) => {
    for (const d of directives) {
      // null = ignore all
      if (d.rules === null) return false;
      if (d.rules.has(v.rule.toUpperCase())) return false;
    }
    return true;
  });
}

/**
 * Apply ignore directives across multiple files.
 * files: map of filePath → raw content
 * violations: all violations (have a .path field from their source file)
 */
export function applyIgnoreDirectivesMultiFile(
  violations: Violation[],
  files: { path: string; content: string }[]
): Violation[] {
  // Build a map: filePath → ignored rule set
  const ignoreMap = new Map<string, Set<string> | null>();
  for (const f of files) {
    const directives = extractIgnoreDirectives(f.content);
    if (directives.length === 0) continue;

    let combined: Set<string> | null = new Set();
    for (const d of directives) {
      if (d.rules === null) {
        combined = null; // ignore all
        break;
      }
      for (const r of d.rules) {
        (combined as Set<string>).add(r);
      }
    }
    ignoreMap.set(f.path, combined);
  }

  if (ignoreMap.size === 0) return violations;

  return violations.filter((v) => {
    // Match by filePath if available, otherwise apply file-level directives globally
    for (const [filePath, ignored] of ignoreMap.entries()) {
      if (ignored === null) return false; // ignore-all in any file
      if (ignored.has(v.rule.toUpperCase())) return false;
    }
    return true;
  });
}
