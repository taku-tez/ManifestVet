import { ALL_RULES } from "./rules";
import { Rule, Severity } from "./rules/types";

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

export interface PrintRulesOptions {
  /** Filter by rule ID (e.g. "MV1001"), category prefix (e.g. "mv1"), or severity */
  filter?: string;
  format?: "tty" | "json" | "sarif" | "html" | "markdown";
  noColor?: boolean;
}

function matchesFilter(rule: Rule, filter: string): boolean {
  const f = filter.toLowerCase();
  // Exact rule ID
  if (rule.id.toLowerCase() === f) return true;
  // Category prefix: "mv1", "mv2", ...
  if (rule.id.toLowerCase().startsWith(f)) return true;
  // Severity
  if (rule.severity === f) return true;
  return false;
}

function formatTTYRules(rules: Rule[], noColor: boolean): string {
  const lines: string[] = [];
  const c = (sev: Severity) => (noColor ? "" : COLORS[sev]);
  const rst = noColor ? "" : RESET;
  const bold = (s: string) => (noColor ? s : `${BOLD}${s}${RESET}`);
  const dim = (s: string) => (noColor ? s : `${DIM}${s}${RESET}`);

  lines.push("");
  lines.push(bold(`ManifestVet Rules (${rules.length})`));
  lines.push("");

  let currentCategory = "";
  for (const rule of rules) {
    const category = rule.id.slice(0, 3).toUpperCase(); // MV1, MV2, ...
    if (category !== currentCategory) {
      currentCategory = category;
      const categoryNames: Record<string, string> = {
        MV1: "Pod Security",
        MV2: "RBAC",
        MV3: "Networking",
        MV4: "Image Security",
        MV5: "Secrets & Config",
        MV6: "Best Practices",
      };
      lines.push(bold(`  ${category} — ${categoryNames[category] ?? ""}`));
    }

    const sev = rule.severity.padEnd(8);
    const id = rule.id.padEnd(8);
    lines.push(`    ${c(rule.severity)}${id}${rst}  ${c(rule.severity)}${sev}${rst}  ${dim(rule.description)}`);
  }

  lines.push("");
  lines.push(dim(`  ${rules.length} rule(s) total`));
  lines.push("");
  return lines.join("\n");
}

function formatJSONRules(rules: Rule[]): string {
  return JSON.stringify(
    rules.map((r) => ({
      id: r.id,
      severity: r.severity,
      description: r.description,
      tags: r.tags ?? [],
      url: r.url,
    })),
    null,
    2
  );
}

function formatMarkdownRules(rules: Rule[]): string {
  const lines: string[] = [];
  lines.push("# ManifestVet Rules\n");

  const categories: Record<string, Rule[]> = {};
  for (const rule of rules) {
    const cat = rule.id.slice(0, 3);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(rule);
  }

  const categoryNames: Record<string, string> = {
    MV1: "Pod Security",
    MV2: "RBAC",
    MV3: "Networking",
    MV4: "Image Security",
    MV5: "Secrets & Config",
    MV6: "Best Practices",
  };

  for (const [cat, catRules] of Object.entries(categories)) {
    lines.push(`## ${cat} — ${categoryNames[cat] ?? cat}\n`);
    lines.push("| Rule | Severity | Description |");
    lines.push("|------|----------|-------------|");
    for (const rule of catRules) {
      const badge = `![${rule.severity}](https://img.shields.io/badge/-${rule.severity}-${severityColor(rule.severity)})`;
      lines.push(`| \`${rule.id}\` | ${badge} | ${rule.description} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function severityColor(sev: Severity): string {
  switch (sev) {
    case "critical": return "critical";
    case "high":     return "red";
    case "medium":   return "yellow";
    case "low":      return "blue";
    case "info":     return "lightgrey";
  }
}

export function printRules(opts: PrintRulesOptions = {}): void {
  const noColor = opts.noColor ?? false;
  const format = opts.format ?? "tty";

  let rules = [...ALL_RULES].sort((a, b) => {
    const catDiff = a.id.localeCompare(b.id);
    return catDiff !== 0 ? catDiff : SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  });

  if (opts.filter) {
    rules = rules.filter((r) => matchesFilter(r, opts.filter!));
    if (rules.length === 0) {
      console.error(`No rules match filter: "${opts.filter}"`);
      return;
    }
  }

  switch (format) {
    case "json":
      console.log(formatJSONRules(rules));
      break;
    case "markdown":
    case "html": // HTML falls back to markdown for rules listing
      console.log(formatMarkdownRules(rules));
      break;
    case "tty":
    default:
      console.log(formatTTYRules(rules, noColor));
      break;
  }
}
