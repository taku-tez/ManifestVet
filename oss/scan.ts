#!/usr/bin/env ts-node
/**
 * ManifestVet OSS Continuous Scanner
 * Scans 100 representative OSS Kubernetes projects and saves results.
 *
 * Usage:
 *   GITHUB_TOKEN=xxx npm run oss:scan
 *   GITHUB_TOKEN=xxx npm run oss:scan -- --only cert-manager,argo-cd
 *   GITHUB_TOKEN=xxx npm run oss:scan -- --no-cache
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { parseMultipleFiles } from "../src/parser/parser";
import { lint } from "../src/engine/linter";
import { loadConfig } from "../src/engine/config";

// ── Types ────────────────────────────────────────────────────────────────────

interface OSSTarget {
  name: string;
  repo: string;
  branch: string;
  path: string;
  tags: string[];
}

export interface ScanResult {
  name: string;
  repo: string;
  tags: string[];
  scannedAt: string;
  durationMs: number;
  resourceCount: number;
  yamlFileCount: number;
  violationCount: number;
  violations: ReturnType<typeof lint>;
  error?: string;
  skipped?: boolean;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TARGETS_PATH = path.join(__dirname, "targets.json");
const RESULTS_DIR  = path.join(__dirname, "results");
const CACHE_DIR    = path.join(__dirname, "cache");

const targets: OSSTarget[] = JSON.parse(fs.readFileSync(TARGETS_PATH, "utf-8"));

// CLI flags
const args = process.argv.slice(2);
const onlyFlag = args.find(a => a.startsWith("--only="))?.split("=")[1]?.split(",") ?? null;
const noCache  = args.includes("--no-cache");

// ── GitHub helpers ────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return {
    "User-Agent": "ManifestVet-OSS-Scanner/1.0",
    "Accept": "application/vnd.github.v3+json",
    ...(token ? { Authorization: `token ${token}` } : {}),
  };
}

function httpsGet(url: string): Promise<{ body: string; status: number; headers: any }> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: getAuthHeaders() }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        httpsGet(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ body, status: res.statusCode ?? 0, headers: res.headers }));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function listDir(owner: string, repo: string, branch: string, dir: string): Promise<any[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dir}?ref=${branch}`;
  const { body, status, headers } = await httpsGet(url);

  if (status === 429 || (status === 403 && headers["x-ratelimit-remaining"] === "0")) {
    const reset = parseInt(headers["x-ratelimit-reset"] ?? "0", 10);
    const wait  = Math.max(0, reset * 1000 - Date.now()) + 2000;
    console.warn(`  ⚠ Rate limited. Waiting ${Math.round(wait / 1000)}s...`);
    await sleep(wait);
    return listDir(owner, repo, branch, dir);
  }

  if (status !== 200) return [];

  const parsed = JSON.parse(body);
  return Array.isArray(parsed) ? parsed : [];
}

async function fetchRaw(url: string): Promise<string | null> {
  try {
    const { body, status } = await httpsGet(url);
    return status === 200 ? body : null;
  } catch {
    return null;
  }
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function cacheKey(name: string): string {
  return path.join(CACHE_DIR, `${name}.json`);
}

function readCache(name: string): { path: string; content: string }[] | null {
  if (noCache) return null;
  const p = cacheKey(name);
  if (!fs.existsSync(p)) return null;
  const age = Date.now() - fs.statSync(p).mtimeMs;
  if (age > 24 * 60 * 60 * 1000) return null; // 24h TTL
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeCache(name: string, files: { path: string; content: string }[]): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheKey(name), JSON.stringify(files));
}

// ── Manifest fetcher ──────────────────────────────────────────────────────────

async function fetchManifests(
  target: OSSTarget
): Promise<{ path: string; content: string }[]> {
  const cached = readCache(target.name);
  if (cached) {
    console.log(`  ✓ Using cache (${cached.length} files)`);
    return cached;
  }

  const [owner, repo] = target.repo.split("/");
  const results: { path: string; content: string }[] = [];

  async function walk(dir: string, depth = 0): Promise<void> {
    if (depth > 4) return; // max recursion depth
    const entries = await listDir(owner, repo, target.branch, dir);
    await sleep(200); // polite delay

    for (const entry of entries) {
      if (entry.type === "dir") {
        // Skip irrelevant directories
        const skip = ["node_modules", "vendor", ".git", "test", "tests",
                      "__pycache__", "docs", "doc", "website", "site"];
        if (skip.includes(entry.name)) continue;
        await walk(entry.path, depth + 1);
      } else if (
        (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) &&
        entry.download_url
      ) {
        const content = await fetchRaw(entry.download_url);
        if (content) {
          results.push({ path: entry.path, content });
        }
        await sleep(50);
      }
    }
  }

  await walk(target.path);
  writeCache(target.name, results);
  return results;
}

// ── Scanner ───────────────────────────────────────────────────────────────────

const config = loadConfig({ severity: "info" });

async function scanTarget(target: OSSTarget): Promise<ScanResult> {
  const start = Date.now();
  console.log(`\n[${target.name}] ${target.repo}/${target.path}`);

  try {
    const files = await fetchManifests(target);
    console.log(`  → ${files.length} YAML files fetched`);

    if (files.length === 0) {
      return {
        name: target.name, repo: target.repo, tags: target.tags,
        scannedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        resourceCount: 0, yamlFileCount: 0,
        violationCount: 0, violations: [],
        skipped: true,
      };
    }

    const { resources, errors } = parseMultipleFiles(files);
    if (errors.length > 0) {
      console.log(`  ⚠ ${errors.length} parse error(s)`);
    }

    const violations = lint(resources, config);
    console.log(`  → ${resources.length} resources, ${violations.length} violations`);

    return {
      name: target.name, repo: target.repo, tags: target.tags,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      resourceCount: resources.length,
      yamlFileCount: files.length,
      violationCount: violations.length,
      violations,
    };
  } catch (e: any) {
    console.error(`  ✗ Error: ${e.message}`);
    return {
      name: target.name, repo: target.repo, tags: target.tags,
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      resourceCount: 0, yamlFileCount: 0,
      violationCount: 0, violations: [],
      error: e.message,
    };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    console.warn("⚠ GITHUB_TOKEN not set. Rate limit is 60 req/hour. Set token for 5000 req/hour.");
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const selectedTargets = onlyFlag
    ? targets.filter(t => onlyFlag.includes(t.name))
    : targets;

  console.log(`\nManifestVet OSS Scanner`);
  console.log(`Scanning ${selectedTargets.length} projects...`);
  console.log("─".repeat(60));

  const results: ScanResult[] = [];
  let done = 0;

  for (const target of selectedTargets) {
    const result = await scanTarget(target);
    results.push(result);
    done++;
    console.log(`  [${done}/${selectedTargets.length}] done`);
  }

  // Save timestamped results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(RESULTS_DIR, `${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  // Overwrite latest.json
  const latestPath = path.join(RESULTS_DIR, "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(results, null, 2));

  // Summary
  const successful = results.filter(r => !r.error && !r.skipped);
  const totalResources = successful.reduce((s, r) => s + r.resourceCount, 0);
  const totalViolations = successful.reduce((s, r) => s + r.violationCount, 0);

  console.log("\n" + "─".repeat(60));
  console.log(`✓ Scan complete`);
  console.log(`  Projects: ${successful.length}/${selectedTargets.length} successful`);
  console.log(`  Resources: ${totalResources}`);
  console.log(`  Violations: ${totalViolations}`);
  console.log(`  Results: ${outPath}`);
  console.log(`\nRun 'npm run oss:analyze' to see insights.`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
