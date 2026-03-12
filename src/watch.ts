import * as fs from "fs";
import * as path from "path";
import { parseMultipleFiles } from "./parser/parser";
import { lint } from "./engine/linter";
import { ManifestVetConfig } from "./engine/config";
import { Violation, Rule } from "./rules/types";
import { fetchManifestsFromCluster, ClusterOptions } from "./cluster";
import { formatTTY } from "./formatter/tty";

const C = {
  bold: "\x1b[1m",
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
};

/** Parse "30s", "5m", "1h" to milliseconds. */
export function parseInterval(raw: string): number {
  const match = /^(\d+)(s|m|h)$/.exec(raw.trim());
  if (!match) throw new Error(`Invalid interval "${raw}". Use e.g. "30s", "5m", "1h".`);
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return n * 1_000;
    case "m": return n * 60_000;
    case "h": return n * 3_600_000;
    default: throw new Error(`Unknown interval unit: ${match[2]}`);
  }
}

export interface WatchOptions {
  cluster: boolean;
  clusterOpts?: ClusterOptions;
  dir?: string;
  intervalMs: number;
  config: ManifestVetConfig;
  extraRules?: Rule[];
  noColor?: boolean;
}

function fingerprint(v: Violation): string {
  return `${v.rule}|${v.resource}|${v.message}`;
}

function collectYAMLFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectYAMLFiles(fp));
    else if (fp.endsWith(".yaml") || fp.endsWith(".yml")) out.push(fp);
  }
  return out;
}

async function runScan(opts: WatchOptions): Promise<Violation[]> {
  let files: { path: string; content: string }[];

  if (opts.cluster) {
    files = await fetchManifestsFromCluster(opts.clusterOpts ?? {});
  } else if (opts.dir) {
    const yamlFiles = collectYAMLFiles(opts.dir);
    files = yamlFiles.map((f) => ({ path: f, content: fs.readFileSync(f, "utf-8") }));
  } else {
    throw new Error("watch requires --cluster or --dir");
  }

  const { resources } = parseMultipleFiles(files);
  return lint(resources, opts.config, opts.extraRules ?? []);
}

/**
 * Start continuous monitoring. Runs indefinitely until SIGINT.
 */
export async function startWatch(opts: WatchOptions): Promise<void> {
  const noColor = opts.noColor ?? false;
  const color = noColor ? { bold: "", reset: "", dim: "", green: "", red: "" } : C;

  const source = opts.cluster ? "cluster" : opts.dir ?? "(unknown)";
  const intervalSec = opts.intervalMs / 1000;

  console.log(`${color.bold}[manifestvet watch]${color.reset} Continuous monitoring started`);
  console.log(`  Source:   ${source}`);
  console.log(`  Interval: ${intervalSec}s`);
  console.log("");

  let previous: Violation[] = [];
  let scanCount = 0;

  const scan = async (): Promise<void> => {
    scanCount++;
    const ts = new Date().toISOString();

    let current: Violation[];
    try {
      current = await runScan(opts);
    } catch (e: any) {
      process.stderr.write(`\n${color.red}[watch ${ts}] Scan error: ${e.message}${color.reset}\n`);
      return;
    }

    if (scanCount === 1) {
      previous = current;
      console.log(`[${ts}] Initial scan: ${current.length} violation(s)`);
      if (current.length > 0) {
        console.log(formatTTY(current, { noColor }));
      }
      return;
    }

    const prevFingerprints = new Set(previous.map(fingerprint));
    const currFingerprints = new Set(current.map(fingerprint));

    const newViolations = current.filter((v) => !prevFingerprints.has(fingerprint(v)));
    const resolved = previous.filter((v) => !currFingerprints.has(fingerprint(v)));

    if (newViolations.length === 0 && resolved.length === 0) {
      process.stderr.write(
        `\r${color.dim}[${ts}] No changes (${current.length} violation(s))${color.reset}  `
      );
    } else {
      console.log(`\n${color.bold}[${ts}] Changes detected${color.reset}`);

      if (newViolations.length > 0) {
        console.log(`\n${color.red}NEW (${newViolations.length}):${color.reset}`);
        console.log(formatTTY(newViolations, { noColor }));
      }
      if (resolved.length > 0) {
        console.log(`\n${color.green}RESOLVED (${resolved.length}):${color.reset}`);
        console.log(formatTTY(resolved, { noColor }));
      }
    }

    previous = current;
  };

  // First scan immediately, then on interval
  await scan();
  const timer = setInterval(scan, opts.intervalMs);

  process.on("SIGINT", () => {
    clearInterval(timer);
    console.log(`\n[manifestvet watch] Stopped.`);
    process.exit(0);
  });

  // Keep the process alive (setInterval already does this, but be explicit)
  await new Promise<never>(() => {});
}
