import { Violation, Severity } from "../rules/types";

const COLORS = {
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function severityColor(severity: Severity, noColor: boolean): string {
  if (noColor) return "";
  switch (severity) {
    case "error":
      return COLORS.red;
    case "warning":
      return COLORS.yellow;
    case "info":
      return COLORS.cyan;
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
    const sev = v.severity.padEnd(7);
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

  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warning").length;
  const infos = violations.filter((v) => v.severity === "info").length;

  const parts: string[] = [];
  if (errors > 0)
    parts.push(`${severityColor("error", noColor)}${errors} error${errors !== 1 ? "s" : ""}${reset(noColor)}`);
  if (warnings > 0)
    parts.push(`${severityColor("warning", noColor)}${warnings} warning${warnings !== 1 ? "s" : ""}${reset(noColor)}`);
  if (infos > 0)
    parts.push(`${severityColor("info", noColor)}${infos} info${reset(noColor)}`);

  lines.push(`  ${parts.join(", ")}`);
  lines.push("");

  return lines.join("\n");
}
