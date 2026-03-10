import * as fs from "fs";
import { Violation } from "./rules/types";

function fingerprint(v: Violation): string {
  return `${v.rule}|${v.resource}|${v.message}`;
}

/**
 * Save the current violations as a baseline file.
 * On subsequent runs, use compareBaseline() to surface only new violations.
 */
export function saveBaseline(violations: Violation[], baselinePath: string): void {
  fs.writeFileSync(baselinePath, JSON.stringify(violations, null, 2), "utf-8");
}

/**
 * Load a previously saved baseline.
 * Returns [] if the file does not exist (first run).
 */
export function loadBaseline(baselinePath: string): Violation[] {
  if (!fs.existsSync(baselinePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as Violation[];
  } catch {
    return [];
  }
}

/**
 * Return only violations that are new compared to the baseline.
 * A violation is "new" if its fingerprint (rule + resource + message)
 * does not appear in the baseline.
 */
export function diffBaseline(
  current: Violation[],
  baseline: Violation[]
): Violation[] {
  const baselineSet = new Set(baseline.map(fingerprint));
  return current.filter((v) => !baselineSet.has(fingerprint(v)));
}

/**
 * Return violations that were in the baseline but are no longer present.
 * Useful for showing "fixed" issues.
 */
export function fixedSinceBaseline(
  current: Violation[],
  baseline: Violation[]
): Violation[] {
  const currentSet = new Set(current.map(fingerprint));
  return baseline.filter((v) => !currentSet.has(fingerprint(v)));
}
