import { Violation, Severity } from "../rules/types";

const COLORS = {
  brightRed: "\x1b[91m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function severityColor(severity: Severity, noColor: boolean): string {
  if (noColor) return "";
  switch (severity) {
    case "critical": return COLORS.brightRed;
    case "high":     return COLORS.red;
    case "medium":   return COLORS.yellow;
    case "low":      return COLORS.cyan;
    case "info":     return COLORS.blue;
  }
}

function reset(noColor: boolean): string {
  return noColor ? "" : COLORS.reset;
}

function bold(text: string, noColor: boolean): string {
  return noColor ? text : `${COLORS.bold}${text}${COLORS.reset}`;
}

function dim(text: string, noColor: boolean): string {
  return noColor ? text : `${COLORS.dim}${text}${COLORS.reset}`;
}

export function formatTTY(
  violations: Violation[],
  options: { noColor?: boolean; filePath?: string } = {}
): string {
  const noColor = options.noColor ?? false;
  const lines: string[] = [];

  if (options.filePath) {
    lines.push("");
    lines.push(bold(options.filePath, noColor));
  }

  if (violations.length === 0) {
    lines.push("");
    lines.push(`  ${dim("No issues found.", noColor)}`);
    lines.push("");
    return lines.join("\n");
  }

  lines.push("");

  for (const v of violations) {
    const color = severityColor(v.severity, noColor);
    const rst = reset(noColor);
    const sev = v.severity.padEnd(8);
    const rule = v.rule.padEnd(8);
    lines.push(
      `  ${color}${rule}${rst}  ${color}${sev}${rst}  ${v.resource}  ${v.message}`
    );
    if (v.fix) {
      for (const fixLine of v.fix.split("\n")) {
        lines.push(`  ${dim("  " + fixLine, noColor)}`);
      }
    }
  }

  lines.push("");

  const counts: Partial<Record<Severity, number>> = {};
  for (const v of violations) {
    counts[v.severity] = (counts[v.severity] ?? 0) + 1;
  }

  const parts: string[] = [];
  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  for (const sev of order) {
    const n = counts[sev];
    if (n && n > 0) {
      parts.push(`${severityColor(sev, noColor)}${n} ${sev}${reset(noColor)}`);
    }
  }

  lines.push(`  ${parts.join(", ")}`);
  lines.push("");

  return lines.join("\n");
}
