#!/usr/bin/env ts-node
/**
 * ManifestVet OSS Analyzer
 * Analyzes scan results to find rule improvements, false positives, and gaps.
 *
 * Usage:
 *   npm run oss:analyze
 *   npm run oss:analyze -- --compare            (compare latest vs previous)
 *   npm run oss:analyze -- --file results/X.json
 */

import * as fs from "fs";
import * as path from "path";
import { ScanResult } from "./scan";
import { ALL_RULES } from "../src/rules";
import { Violation } from "../src/rules/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESULTS_DIR = path.join(__dirname, "results");

function loadResults(filePath?: string): ScanResult[] {
  const p = filePath ?? path.join(RESULTS_DIR, "latest.json");
  if (!fs.existsSync(p)) {
    throw new Error(`Results file not found: ${p}\nRun 'npm run oss:scan' first.`);
  }
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function loadPreviousResults(): ScanResult[] | null {
  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith(".json") && f !== "latest.json")
    .sort();
  if (files.length < 2) return null;
  const prev = files[files.length - 2];
  return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, prev), "utf-8"));
}

// ── Analysis ──────────────────────────────────────────────────────────────────

interface RuleStats {
  id: string;
  description: string;
  severity: string;
  fireCount: number;          // violations across all projects
  projectCount: number;       // how many projects triggered this rule
  fireRate: number;           // projectCount / totalProjects
  violationsPerResource: number;
}

interface ProjectStats {
  name: string;
  repo: string;
  tags: string[];
  resourceCount: number;
  violationCount: number;
  violationsPerResource: number;
  topRules: string[];
  errorRate: number;
  warningRate: number;
}

interface AnalysisReport {
  generatedAt: string;
  summary: {
    projectsScanned: number;
    projectsSuccessful: number;
    projectsSkipped: number;
    projectsErrored: number;
    totalResources: number;
    totalViolations: number;
    avgViolationsPerResource: number;
    uniqueRulesFired: number;
    rulesCoverage: number;
  };
  ruleStats: RuleStats[];
  suspectedFalsePositives: RuleStats[];
  neverFiredRules: string[];
  projectStats: ProjectStats[];
  tagInsights: Record<string, {
    projects: number;
    avgViolationsPerResource: number;
    topRules: string[];
  }>;
  topViolatedProjects: ProjectStats[];
  cleanestProjects: ProjectStats[];
  improvements: string[];
}

function analyze(results: ScanResult[]): AnalysisReport {
  const successful = results.filter(r => !r.error && !r.skipped && r.resourceCount > 0);
  const totalProjects = successful.length;

  // Rule stats
  const ruleFires = new Map<string, { projects: Set<string>; count: number }>();
  const ruleMap = new Map(ALL_RULES.map(r => [r.id, r]));

  for (const result of successful) {
    const seenRules = new Set<string>();
    for (const v of result.violations) {
      if (!ruleFires.has(v.rule)) {
        ruleFires.set(v.rule, { projects: new Set(), count: 0 });
      }
      const s = ruleFires.get(v.rule)!;
      s.count++;
      if (!seenRules.has(v.rule)) {
        s.projects.add(result.name);
        seenRules.add(v.rule);
      }
    }
  }

  const totalResources = successful.reduce((s, r) => s + r.resourceCount, 0);
  const totalViolations = successful.reduce((s, r) => s + r.violationCount, 0);

  const ruleStats: RuleStats[] = ALL_RULES.map(rule => {
    const fires = ruleFires.get(rule.id);
    const fireCount = fires?.count ?? 0;
    const projectCount = fires?.projects.size ?? 0;
    return {
      id: rule.id,
      description: rule.description,
      severity: rule.severity,
      fireCount,
      projectCount,
      fireRate: totalProjects > 0 ? projectCount / totalProjects : 0,
      violationsPerResource: totalResources > 0 ? fireCount / totalResources : 0,
    };
  }).sort((a, b) => b.fireCount - a.fireCount);

  // Rules with very high fire rate might be too strict or just universally violated
  const suspectedFalsePositives = ruleStats.filter(r => r.fireRate > 0.95 && r.fireCount > 50);

  // Rules that never fired
  const neverFiredRules = ruleStats.filter(r => r.fireCount === 0).map(r => r.id);

  // Project stats
  const projectStats: ProjectStats[] = successful.map(r => {
    const ruleFreq = new Map<string, number>();
    for (const v of r.violations) {
      ruleFreq.set(v.rule, (ruleFreq.get(v.rule) ?? 0) + 1);
    }
    const topRules = [...ruleFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([rule]) => rule);

    const errors = r.violations.filter(v => v.severity === "error").length;
    const warnings = r.violations.filter(v => v.severity === "warning").length;

    return {
      name: r.name,
      repo: r.repo,
      tags: r.tags,
      resourceCount: r.resourceCount,
      violationCount: r.violationCount,
      violationsPerResource: r.resourceCount > 0 ? r.violationCount / r.resourceCount : 0,
      topRules,
      errorRate: r.resourceCount > 0 ? errors / r.resourceCount : 0,
      warningRate: r.resourceCount > 0 ? warnings / r.resourceCount : 0,
    };
  });

  // Tag insights
  const allTags = [...new Set(successful.flatMap(r => r.tags))];
  const tagInsights: AnalysisReport["tagInsights"] = {};

  for (const tag of allTags) {
    const tagProjects = successful.filter(r => r.tags.includes(tag));
    const tagViolations = tagProjects.flatMap(r => r.violations);
    const tagResources = tagProjects.reduce((s, r) => s + r.resourceCount, 0);
    const ruleFreq = new Map<string, number>();
    for (const v of tagViolations) {
      ruleFreq.set(v.rule, (ruleFreq.get(v.rule) ?? 0) + 1);
    }
    const topRules = [...ruleFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([rule]) => rule);

    tagInsights[tag] = {
      projects: tagProjects.length,
      avgViolationsPerResource: tagResources > 0 ? tagViolations.length / tagResources : 0,
      topRules,
    };
  }

  // Generate improvement suggestions
  const improvements: string[] = [];

  if (neverFiredRules.length > 0) {
    improvements.push(
      `Rules that never fired (possible bugs or very rare conditions): ${neverFiredRules.join(", ")}`
    );
  }

  const highFireRules = ruleStats.filter(r => r.fireRate > 0.8);
  if (highFireRules.length > 0) {
    improvements.push(
      `Rules firing in >80% of projects — consider making them higher severity or auto-fixable: ${highFireRules.map(r => r.id).join(", ")}`
    );
  }

  // Rules with very low but non-zero fire rate might need better documentation
  const rareRules = ruleStats.filter(r => r.fireCount > 0 && r.fireRate < 0.05);
  if (rareRules.length > 0) {
    improvements.push(
      `Rarely firing rules (fired in <5% of projects) — verify correctness: ${rareRules.map(r => r.id).join(", ")}`
    );
  }

  // Check if certain tags have consistently high violation rates
  for (const [tag, stats] of Object.entries(tagInsights)) {
    if (stats.avgViolationsPerResource > 5) {
      improvements.push(
        `Tag "${tag}" has high avg violations/resource (${stats.avgViolationsPerResource.toFixed(1)}) — consider targeted fix templates`
      );
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      projectsScanned: results.length,
      projectsSuccessful: successful.length,
      projectsSkipped: results.filter(r => r.skipped).length,
      projectsErrored: results.filter(r => r.error).length,
      totalResources,
      totalViolations,
      avgViolationsPerResource: totalResources > 0 ? totalViolations / totalResources : 0,
      uniqueRulesFired: ruleStats.filter(r => r.fireCount > 0).length,
      rulesCoverage: ALL_RULES.length > 0
        ? ruleStats.filter(r => r.fireCount > 0).length / ALL_RULES.length
        : 0,
    },
    ruleStats,
    suspectedFalsePositives,
    neverFiredRules,
    projectStats: projectStats.sort((a, b) => b.violationsPerResource - a.violationsPerResource),
    tagInsights,
    topViolatedProjects: [...projectStats].sort((a, b) => b.violationsPerResource - a.violationsPerResource).slice(0, 10),
    cleanestProjects: [...projectStats].sort((a, b) => a.violationsPerResource - b.violationsPerResource).slice(0, 10),
    improvements,
  };
}

// ── Renderer ──────────────────────────────────────────────────────────────────

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function bar(n: number, max: number, width = 20): string {
  const filled = Math.round((n / Math.max(max, 1)) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function renderMarkdown(report: AnalysisReport): string {
  const { summary, ruleStats, neverFiredRules, topViolatedProjects,
          cleanestProjects, tagInsights, suspectedFalsePositives, improvements } = report;

  const lines: string[] = [];

  lines.push("# ManifestVet OSS Scan Analysis");
  lines.push(`*Generated: ${report.generatedAt}*`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Projects scanned | ${summary.projectsScanned} |`);
  lines.push(`| Successful | ${summary.projectsSuccessful} |`);
  lines.push(`| Skipped (no manifests) | ${summary.projectsSkipped} |`);
  lines.push(`| Errored | ${summary.projectsErrored} |`);
  lines.push(`| Total resources | ${summary.totalResources.toLocaleString()} |`);
  lines.push(`| Total violations | ${summary.totalViolations.toLocaleString()} |`);
  lines.push(`| Avg violations/resource | ${summary.avgViolationsPerResource.toFixed(2)} |`);
  lines.push(`| Rules coverage | ${pct(summary.rulesCoverage)} (${summary.uniqueRulesFired}/${ruleStats.length} rules fired) |`);
  lines.push("");

  // Top rules
  lines.push("## Top 20 Most Violated Rules");
  lines.push("");
  lines.push("| Rank | Rule | Severity | Projects | Fire Rate | Violations |");
  lines.push("|------|------|----------|----------|-----------|------------|");
  const maxFire = ruleStats[0]?.fireCount ?? 1;
  ruleStats.slice(0, 20).forEach((r, i) => {
    lines.push(
      `| ${i + 1} | \`${r.id}\` | ${r.severity} | ${r.projectCount} | ${pct(r.fireRate)} | ${r.fireCount} |`
    );
  });
  lines.push("");

  // Never fired
  if (neverFiredRules.length > 0) {
    lines.push("## Rules That Never Fired");
    lines.push("");
    lines.push("These rules had zero violations across all scanned projects.");
    lines.push("Possible causes: incorrect implementation, extremely rare condition, or rules that apply to uncommon resource patterns.");
    lines.push("");
    for (const r of neverFiredRules) {
      const rule = ruleStats.find(s => s.id === r);
      lines.push(`- \`${r}\` — ${rule?.description ?? ""}`);
    }
    lines.push("");
  }

  // Suspected false positives
  if (suspectedFalsePositives.length > 0) {
    lines.push("## High Fire Rate Rules (>95% of Projects)");
    lines.push("");
    lines.push("These rules fire in almost every project. They may be:");
    lines.push("- **Correct** — a widespread real security issue worth highlighting");
    lines.push("- **Too strict** — consider making them `info` severity");
    lines.push("- **Good candidates for auto-fix** — since they're universally applicable");
    lines.push("");
    for (const r of suspectedFalsePositives) {
      lines.push(`- \`${r.id}\` (${r.severity}) — ${r.description} — fires in ${pct(r.fireRate)} of projects`);
    }
    lines.push("");
  }

  // Tag insights
  lines.push("## Insights by Project Category");
  lines.push("");
  lines.push("| Category | Projects | Avg Violations/Resource | Top Rules |");
  lines.push("|----------|----------|------------------------|-----------|");
  for (const [tag, stats] of Object.entries(tagInsights).sort((a, b) => b[1].avgViolationsPerResource - a[1].avgViolationsPerResource)) {
    lines.push(
      `| ${tag} | ${stats.projects} | ${stats.avgViolationsPerResource.toFixed(2)} | ${stats.topRules.join(", ")} |`
    );
  }
  lines.push("");

  // Top violated
  lines.push("## Most Violated Projects (top 10)");
  lines.push("");
  lines.push("| Project | Resources | Violations | Violations/Resource | Top Rules |");
  lines.push("|---------|-----------|------------|--------------------|-----------| ");
  for (const p of topViolatedProjects) {
    lines.push(
      `| [${p.name}](https://github.com/${p.repo}) | ${p.resourceCount} | ${p.violationCount} | ${p.violationsPerResource.toFixed(2)} | ${p.topRules.slice(0, 3).join(", ")} |`
    );
  }
  lines.push("");

  // Cleanest
  lines.push("## Cleanest Projects (top 10)");
  lines.push("");
  lines.push("| Project | Resources | Violations | Violations/Resource |");
  lines.push("|---------|-----------|------------|---------------------|");
  for (const p of cleanestProjects) {
    lines.push(
      `| [${p.name}](https://github.com/${p.repo}) | ${p.resourceCount} | ${p.violationCount} | ${p.violationsPerResource.toFixed(2)} |`
    );
  }
  lines.push("");

  // Improvements
  if (improvements.length > 0) {
    lines.push("## Rule Improvement Suggestions");
    lines.push("");
    for (const imp of improvements) {
      lines.push(`- ${imp}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("*Generated by ManifestVet OSS Scanner*");

  return lines.join("\n");
}

// ── Diff mode ─────────────────────────────────────────────────────────────────

function diffReports(current: AnalysisReport, previous: AnalysisReport): string {
  const lines: string[] = [];
  lines.push("# OSS Scan Diff (latest vs previous)");
  lines.push("");

  const deltaViolations = current.summary.totalViolations - previous.summary.totalViolations;
  const deltaResources  = current.summary.totalResources  - previous.summary.totalResources;
  const sign = (n: number) => n > 0 ? `+${n}` : `${n}`;

  lines.push("## Changes");
  lines.push("");
  lines.push(`| Metric | Previous | Current | Delta |`);
  lines.push(`|--------|----------|---------|-------|`);
  lines.push(`| Total resources  | ${previous.summary.totalResources}  | ${current.summary.totalResources}  | ${sign(deltaResources)}  |`);
  lines.push(`| Total violations | ${previous.summary.totalViolations} | ${current.summary.totalViolations} | ${sign(deltaViolations)} |`);
  lines.push(`| Avg viol/resource | ${previous.summary.avgViolationsPerResource.toFixed(2)} | ${current.summary.avgViolationsPerResource.toFixed(2)} | ${sign(parseFloat((current.summary.avgViolationsPerResource - previous.summary.avgViolationsPerResource).toFixed(2)))} |`);
  lines.push(`| Rules coverage | ${pct(previous.summary.rulesCoverage)} | ${pct(current.summary.rulesCoverage)} | — |`);
  lines.push("");

  // Rule changes
  const prevRuleMap = new Map(previous.ruleStats.map(r => [r.id, r]));
  const changed = current.ruleStats
    .filter(r => {
      const prev = prevRuleMap.get(r.id);
      return prev && Math.abs(r.fireCount - prev.fireCount) > 0;
    })
    .sort((a, b) => {
      const da = a.fireCount - (prevRuleMap.get(a.id)?.fireCount ?? 0);
      const db = b.fireCount - (prevRuleMap.get(b.id)?.fireCount ?? 0);
      return Math.abs(db) - Math.abs(da);
    })
    .slice(0, 15);

  if (changed.length > 0) {
    lines.push("## Top Rule Changes");
    lines.push("");
    lines.push("| Rule | Previous | Current | Delta |");
    lines.push("|------|----------|---------|-------|");
    for (const r of changed) {
      const prev = prevRuleMap.get(r.id)?.fireCount ?? 0;
      const delta = r.fireCount - prev;
      lines.push(`| \`${r.id}\` | ${prev} | ${r.fireCount} | ${sign(delta)} |`);
    }
  }

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2);
  const compareMode = cliArgs.includes("--compare");
  const fileArg = cliArgs.find(a => a.startsWith("--file="))?.split("=")[1];

  const results = loadResults(fileArg);
  const report  = analyze(results);

  // Save JSON report
  const jsonPath = path.join(RESULTS_DIR, "analysis.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Save Markdown report
  let markdown = renderMarkdown(report);

  if (compareMode) {
    const prev = loadPreviousResults();
    if (prev) {
      const prevReport = analyze(prev);
      markdown += "\n\n" + diffReports(report, prevReport);
    } else {
      console.warn("No previous results found for comparison.");
    }
  }

  const mdPath = path.join(RESULTS_DIR, "analysis.md");
  fs.writeFileSync(mdPath, markdown);

  // Console summary
  const { summary, ruleStats, neverFiredRules, improvements } = report;

  console.log("\n" + "═".repeat(60));
  console.log("ManifestVet OSS Analysis");
  console.log("═".repeat(60));
  console.log(`Projects:     ${summary.projectsSuccessful}/${summary.projectsScanned} successful`);
  console.log(`Resources:    ${summary.totalResources.toLocaleString()}`);
  console.log(`Violations:   ${summary.totalViolations.toLocaleString()} (avg ${summary.avgViolationsPerResource.toFixed(2)}/resource)`);
  console.log(`Coverage:     ${pct(summary.rulesCoverage)} rules fired`);
  console.log("");
  console.log("Top 10 rules:");
  ruleStats.slice(0, 10).forEach((r, i) => {
    console.log(`  ${(i + 1).toString().padStart(2)}. ${r.id.padEnd(10)} ${bar(r.fireCount, ruleStats[0]?.fireCount ?? 1, 15)} ${r.fireCount} (${pct(r.fireRate)})`);
  });
  console.log("");
  if (neverFiredRules.length > 0) {
    console.log(`Rules never fired: ${neverFiredRules.join(", ")}`);
  }
  if (improvements.length > 0) {
    console.log("\nImprovement suggestions:");
    improvements.forEach(imp => console.log(`  • ${imp}`));
  }
  console.log("");
  // Also copy to oss/analysis.md for git tracking
  const ossAnalysisPath = path.join(__dirname, "analysis.md");
  fs.writeFileSync(ossAnalysisPath, markdown);

  console.log(`Reports saved:`);
  console.log(`  JSON:     ${jsonPath}`);
  console.log(`  Markdown: ${mdPath}`);
  console.log(`  OSS:      ${ossAnalysisPath}`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
