import * as fs from "fs";
import { Violation } from "../rules/types";
import { getTemplate } from "./templates";

export interface FixReport {
  file: string;
  fixes: {
    violation: Violation;
    patch: string;
    safe: boolean;
  }[];
}

/**
 * Groups violations by file and prepares fix suggestions.
 * Returns only violations that have a fix template.
 */
export function prepareFixReports(
  violations: Violation[],
  fileMap: Record<string, string> // resourceId → filename
): FixReport[] {
  const byFile: Record<string, FixReport> = {};

  for (const violation of violations) {
    const template = getTemplate(violation.rule);
    if (!template) continue;

    const file = fileMap[violation.resource ?? ""] ?? "unknown";
    if (!byFile[file]) byFile[file] = { file, fixes: [] };
    byFile[file].fixes.push({
      violation,
      patch: template.patch,
      safe: template.safe,
    });
  }

  return Object.values(byFile);
}

/**
 * Writes fix report as a markdown summary.
 */
export function writeFixSummary(
  reports: FixReport[],
  outputPath: string,
  safeOnly = false
): void {
  const lines: string[] = [
    "# ManifestVet Fix Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ];

  for (const report of reports) {
    const fixes = safeOnly ? report.fixes.filter((f) => f.safe) : report.fixes;
    if (fixes.length === 0) continue;

    lines.push(`## ${report.file}`, "");
    for (const fix of fixes) {
      lines.push(
        `### ${fix.violation.rule} — ${fix.violation.resource ?? ""}`,
        "",
        `**Severity:** ${fix.violation.severity}`,
        "",
        `**Issue:** ${fix.violation.message}`,
        "",
        "**Fix:** ```yaml",
        fix.patch,
        "```",
        `**Safe to auto-apply:** ${fix.safe ? "✓ Yes" : "✗ No (requires review)"}`,
        "",
      );
    }
  }

  fs.writeFileSync(outputPath, lines.join("\n"));
}
