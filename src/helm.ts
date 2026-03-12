import { spawnSync } from "child_process";
import * as path from "path";

export interface HelmOptions {
  chartDir: string;
  valuesFiles?: string[];
  setValues?: string[];
  releaseName?: string;
  namespace?: string;
}

/**
 * Run `helm template` and return rendered manifests as virtual files.
 * Each file carries a `helm://chart/templates/foo.yaml` path derived from
 * the `# Source:` comments that helm emits natively.
 */
export function renderHelmChart(opts: HelmOptions): { path: string; content: string }[] {
  const releaseName = opts.releaseName ?? "manifestvet-preview";
  const chartPath = path.resolve(opts.chartDir);

  const helmArgs: string[] = ["template", releaseName, chartPath, "--include-crds"];

  for (const vf of opts.valuesFiles ?? []) {
    helmArgs.push("--values", path.resolve(vf));
  }
  for (const sv of opts.setValues ?? []) {
    helmArgs.push("--set", sv);
  }
  if (opts.namespace) {
    helmArgs.push("--namespace", opts.namespace);
  }

  const result = spawnSync("helm", helmArgs, { encoding: "utf-8" });

  if (result.error) {
    throw new Error(
      `helm not found in PATH. Install Helm from https://helm.sh/docs/intro/install/ — ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    const msg = result.stderr?.trim() || `helm template exited with code ${result.status}`;
    throw new Error(`helm template failed:\n${msg}`);
  }

  const stdout = result.stdout;
  if (!stdout.trim()) return [];

  // helm template output has `# Source: chart/templates/foo.yaml` before each document.
  // Split on "---" separators and recover the source file path per document.
  const SOURCE_RE = /^# Source: (.+)$/m;
  const docs: { path: string; content: string }[] = [];
  const chartName = path.basename(chartPath);
  let lastSource = `helm://${chartName}`;

  for (const rawDoc of stdout.split(/^---[ \t]*$/m)) {
    const trimmed = rawDoc.trim();
    if (!trimmed) continue;

    const sourceMatch = SOURCE_RE.exec(trimmed);
    if (sourceMatch) {
      lastSource = `helm://${sourceMatch[1]}`;
    }

    // Strip comment lines (# Source: ...) so they don't confuse the YAML parser
    const content = trimmed
      .split("\n")
      .filter((line) => !line.startsWith("#"))
      .join("\n")
      .trim();

    if (content) {
      docs.push({ path: lastSource, content });
    }
  }

  return docs;
}
