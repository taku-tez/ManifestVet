import { Violation, Severity } from "../rules/types";

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const COLORS: Record<Severity, string> = {
  critical: "\x1b[91m",
  high: "\x1b[31m",
  medium: "\x1b[33m",
  low: "\x1b[36m",
  info: "\x1b[34m",
};
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const CATEGORY_NAMES: Record<string, string> = {
  MV1: "Pod Security",
  MV2: "RBAC",
  MV3: "Networking",
  MV4: "Image Security",
  MV5: "Secrets & Config",
  MV6: "Best Practices",
};

function bar(count: number, max: number, width = 24): string {
  const filled = max === 0 ? 0 : Math.round((count / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function formatSummary(
  violations: Violation[],
  options: { noColor?: boolean } = {}
): string {
  const noColor = options.noColor ?? false;
  const c = (sev: Severity) => (noColor ? "" : COLORS[sev]);
  const rst = noColor ? "" : RESET;
  const bold = (s: string) => (noColor ? s : `${BOLD}${s}${RESET}`);
  const dim = (s: string) => (noColor ? s : `${DIM}${s}${RESET}`);

  const lines: string[] = [];
  lines.push("");

  if (violations.length === 0) {
    lines.push(`  ${dim("No violations found.")}`);
    lines.push("");
    return lines.join("\n");
  }

  // Unique resources
  const uniqueResources = new Set(violations.map((v) => v.resource)).size;
  lines.push(bold(`  Summary — ${violations.length} violation(s) across ${uniqueResources} resource(s)`));
  lines.push("");

  // ── By severity ──────────────────────────────────────────────────────────
  lines.push(`  ${bold("By severity:")}`);
  const bySeverity: Partial<Record<Severity, number>> = {};
  for (const v of violations) {
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
  }
  const sevOrder: Severity[] = ["critical", "high", "medium", "low", "info"];
  for (const sev of sevOrder) {
    const count = bySeverity[sev] ?? 0;
    if (count === 0) continue;
    const label = sev.padEnd(8);
    const countStr = String(count).padStart(4);
    lines.push(`    ${c(sev)}${label}${rst}  ${c(sev)}${countStr}${rst}`);
  }
  lines.push("");

  // ── By category ──────────────────────────────────────────────────────────
  lines.push(`  ${bold("By category:")}`);
  const byCategory: Record<string, number> = {};
  for (const v of violations) {
    const cat = v.rule.slice(0, 3).toUpperCase();
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  const maxCatCount = Math.max(...Object.values(byCategory));
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const name = (CATEGORY_NAMES[cat] ?? cat).padEnd(18);
    const countStr = String(count).padStart(4);
    const b = dim(bar(count, maxCatCount));
    lines.push(`    ${bold(cat)}  ${name}  ${countStr}  ${b}`);
  }
  lines.push("");

  // ── Top rules ─────────────────────────────────────────────────────────────
  lines.push(`  ${bold("Top rules:")}`);
  const byRule: Record<string, { count: number; severity: Severity; desc: string }> = {};
  for (const v of violations) {
    if (!byRule[v.rule]) {
      byRule[v.rule] = { count: 0, severity: v.severity, desc: v.message.split(".")[0] };
    }
    byRule[v.rule].count++;
  }
  const topRules = Object.entries(byRule)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  const maxRuleCount = topRules[0]?.[1].count ?? 1;
  for (const [ruleId, { count, severity, desc }] of topRules) {
    const id = ruleId.padEnd(8);
    const countStr = String(count).padStart(4);
    const descTrunc = desc.length > 40 ? desc.slice(0, 39) + "…" : desc.padEnd(40);
    const b = dim(bar(count, maxRuleCount, 16));
    lines.push(`    ${c(severity)}${id}${rst}  ${dim(descTrunc)}  ${countStr}  ${b}`);
  }
  lines.push("");

  return lines.join("\n");
}
