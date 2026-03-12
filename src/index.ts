#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { parseMultipleFiles } from "./parser/parser";
import { lint } from "./engine/linter";
import { loadConfig, ManifestVetConfig } from "./engine/config";
import { formatTTY } from "./formatter/tty";
import { formatJSON } from "./formatter/json";
import { formatSARIF } from "./formatter/sarif";
import { formatHTML } from "./formatter/html";
import { formatMarkdown } from "./formatter/markdown";
import { formatSummary } from "./formatter/summary";
import { fetchManifestsFromGitHub } from "./github";
import { fetchManifestsFromCluster } from "./cluster";
import { computeDelta } from "./delta";
import { annotateFixes, FixLang } from "./fixes";
import { applyFixesToFiles } from "./fixes/apply";
import { applyIgnoreDirectivesMultiFile } from "./policy";
import { collectKustomizeFiles, isKustomizeDir } from "./kustomize";
import { installPreCommitHook, uninstallPreCommitHook, generatePreCommitConfig } from "./hook";
import { loadPlugins } from "./plugins";
import { saveBaseline, loadBaseline, diffBaseline, fixedSinceBaseline } from "./baseline";
import { evalRegoPolicy } from "./rego";
import { startWebhookServer } from "./webhook";
import { loadProjectConfig, loadConfigFile } from "./config-file";
import { runInteractive } from "./interactive";
import { renderHelmChart } from "./helm";
import { startWatch, parseInterval } from "./watch";
import { checkAPIVersion } from "./k8s-versions";
import { printRules } from "./rules-cmd";

const VERSION = "1.0.0";

function printHelp(): void {
  console.log(`
manifestvet v${VERSION} - Kubernetes manifest security linter

Usage:
  manifestvet [options] <manifest.yaml> [manifest.yaml...]
  manifestvet --stdin
  manifestvet --dir <directory>
  manifestvet --github <owner/repo|blob-url> [--branch <branch>] [--path <subdir>]
  manifestvet --cluster [--context <name>] [--namespace <ns>|--all-namespaces] [--delta --dir <dir>]
  manifestvet --helm <chart-dir> [--helm-values values.yaml] [--helm-set key=value]
  manifestvet hook install|uninstall|config
  manifestvet webhook [--port 8443] [--cert cert.pem --key key.pem] [--severity high]
  manifestvet watch --cluster|--dir <dir> [--interval 5m]

Options:
  --format <tty|json|sarif|html|markdown>   Output format (default: tty)
  --ignore <rule>                           Ignore rule (repeatable)
  --severity <critical|high|medium|low|info>  Minimum severity to report
  --no-color                                Disable colored output
  --stdin                                   Read from stdin
  --config <file>                           Explicit config file path (default: .manifestvet.yaml)
  --interactive                             Review violations interactively (F/I/S/Q)
  --k8s-version <1.28>                      Target K8s version for deprecated API warnings

  --helm <chart-dir>                        Render and lint a Helm chart
  --helm-values <values.yaml>               Values file for helm template (repeatable)
  --helm-set <key=value>                    Override a Helm value (repeatable)
  --helm-release <name>                     Release name for helm template (default: manifestvet-preview)

  -o, --output-file <path>                  Write report to file instead of stdout
  --summary                                 Print aggregated summary (counts by severity/category/rule)

  --github <owner/repo|blob-url>            Scan manifests from GitHub
  --branch <branch>                         Branch to scan (default: main)
  --path <subdir>                           Subdirectory to scan within the repo

  --cluster                                 Scan live cluster (current kubeconfig context)
  --context <name>                          Target specific kubeconfig context
  --namespace <ns>                          Namespace to scan
  --all-namespaces                          Scan all namespaces
  --delta                                   Show only violations in cluster missing from local manifests

  --fix                                     Append fix suggestions to output
  --fix-lang <ja|en>                        Language for fix explanations (default: ja)
  --llm                                     Enable LLM-augmented fix suggestions (requires ANTHROPIC_API_KEY)
  --apply-fixes                             Auto-apply safe fixes to local files (creates .manifestvet.bak backups)

  --kustomize <dir>                         Scan a Kustomize overlay directory

  --plugin <path>                           Load a custom rule plugin JS file (repeatable)
  --rego <policy.rego>                      Evaluate an OPA/Rego policy against scanned resources

  --baseline <file>                         Baseline diff: save on first run, show only new violations on subsequent runs
  --baseline-save <file>                    Save current violations to a baseline file (overwrite)

  -h, --help                                Show help
  -v, --version                             Show version

Config file (.manifestvet.yaml):
  ignore: [MV6007]
  severity: high
  format: tty
  k8sVersion: "1.28"
  plugins: [./custom-rules.js]
  allowedRegistries: [gcr.io/my-company]
  namespaceExclusions: [kube-system]
  outputFile: report.html
  severityOverrides:
    MV6007: low
    MV4002: medium

Environment:
  GITHUB_TOKEN                              GitHub token for authenticated API requests
  ANTHROPIC_API_KEY                         Anthropic API key for LLM fix suggestions

Inline ignore (in YAML files):
  # manifestvet-ignore: MV1001, MV1002    Suppress specific rules for this file
  # manifestvet-ignore-all                 Suppress all rules for this file
`);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function collectYAMLFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectYAMLFiles(fullPath));
    } else if (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml")) {
      results.push(fullPath);
    }
  }
  return results;
}

interface CLIArgs {
  files: string[];
  stdin: boolean;
  github?: string;
  branch: string;
  githubPath: string;
  dir?: string;
  kustomize?: string;
  cluster: boolean;
  context?: string;
  namespace?: string;
  allNamespaces: boolean;
  delta: boolean;
  format: "tty" | "json" | "sarif" | "html" | "markdown";
  ignore: string[];
  severity: "critical" | "high" | "medium" | "low" | "info";
  noColor: boolean;
  fix: boolean;
  fixLang: FixLang;
  llm: boolean;
  applyFixes: boolean;
  plugins: string[];
  rego?: string;
  baseline?: string;
  baselineSave?: string;
  help: boolean;
  version: boolean;
  hookCmd?: string;
  webhookCmd: boolean;
  webhookPort: number;
  webhookCert?: string;
  webhookKey?: string;
  // New features
  configFile?: string;
  interactive: boolean;
  severitySet: boolean;
  k8sVersion?: string;
  helm?: string;
  helmValues: string[];
  helmSet: string[];
  helmRelease?: string;
  watchCmd: boolean;
  watchInterval: string;
  exitZero: boolean;
  rulesCmd: boolean;
  rulesFilter?: string;
  outputFile?: string;
  summary: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    files: [],
    stdin: false,
    branch: "main",
    githubPath: "",
    cluster: false,
    allNamespaces: false,
    delta: false,
    format: "tty",
    ignore: [],
    severity: "info",
    severitySet: false,
    noColor: false,
    fix: false,
    fixLang: "ja",
    llm: false,
    applyFixes: false,
    plugins: [],
    webhookCmd: false,
    webhookPort: 8443,
    help: false,
    version: false,
    interactive: false,
    helmValues: [],
    helmSet: [],
    watchCmd: false,
    watchInterval: "5m",
    exitZero: false,
    rulesCmd: false,
    summary: false,
  };

  // Subcommands
  if (argv[0] === "hook" && argv[1]) {
    args.hookCmd = argv[1];
    return args;
  }
  if (argv[0] === "webhook") {
    args.webhookCmd = true;
    argv = argv.slice(1);
  }
  if (argv[0] === "watch") {
    args.watchCmd = true;
    argv = argv.slice(1);
  }
  if (argv[0] === "rules") {
    args.rulesCmd = true;
    args.rulesFilter = argv[1] && !argv[1].startsWith("-") ? argv[1] : undefined;
    argv = argv.slice(args.rulesFilter ? 2 : 1);
  }

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-v":
      case "--version":
        args.version = true;
        break;
      case "--stdin":
        args.stdin = true;
        break;
      case "--no-color":
        args.noColor = true;
        break;
      case "--format":
        args.format = argv[++i] as CLIArgs["format"];
        break;
      case "--ignore":
        args.ignore.push(argv[++i]);
        break;
      case "--severity":
        args.severity = argv[++i] as "critical" | "high" | "medium" | "low" | "info";
        args.severitySet = true;
        break;
      case "--github":
        args.github = argv[++i];
        break;
      case "--branch":
        args.branch = argv[++i];
        break;
      case "--path":
        args.githubPath = argv[++i];
        break;
      case "--dir":
        args.dir = argv[++i];
        break;
      case "--kustomize":
        args.kustomize = argv[++i];
        break;
      case "--cluster":
        args.cluster = true;
        break;
      case "--context":
        args.context = argv[++i];
        break;
      case "--namespace":
      case "-n":
        args.namespace = argv[++i];
        break;
      case "--all-namespaces":
      case "-A":
        args.allNamespaces = true;
        break;
      case "--delta":
        args.delta = true;
        break;
      case "--fix":
        args.fix = true;
        break;
      case "--fix-lang":
        args.fixLang = argv[++i] as FixLang;
        break;
      case "--llm":
        args.llm = true;
        break;
      case "--apply-fixes":
        args.applyFixes = true;
        break;
      case "--plugin":
        args.plugins.push(argv[++i]);
        break;
      case "--rego":
        args.rego = argv[++i];
        break;
      case "--baseline":
        args.baseline = argv[++i];
        break;
      case "--baseline-save":
        args.baselineSave = argv[++i];
        break;
      case "--config":
        args.configFile = argv[++i];
        break;
      case "--interactive":
        args.interactive = true;
        break;
      case "--k8s-version":
        args.k8sVersion = argv[++i];
        break;
      case "--helm":
        args.helm = argv[++i];
        break;
      case "--helm-values":
        args.helmValues.push(argv[++i]);
        break;
      case "--helm-set":
        args.helmSet.push(argv[++i]);
        break;
      case "--helm-release":
        args.helmRelease = argv[++i];
        break;
      case "--interval":
        args.watchInterval = argv[++i];
        break;
      case "--exit-zero":
        args.exitZero = true;
        break;
      case "--output-file":
      case "-o":
        args.outputFile = argv[++i];
        break;
      case "--summary":
        args.summary = true;
        break;
      case "--port":
        args.webhookPort = parseInt(argv[++i], 10);
        break;
      case "--cert":
        args.webhookCert = argv[++i];
        break;
      case "--key":
        args.webhookKey = argv[++i];
        break;
      default:
        if (!arg.startsWith("-")) {
          args.files.push(arg);
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
    i++;
  }

  return args;
}

function renderOutput(
  violations: any[],
  format: CLIArgs["format"],
  noColor: boolean,
  firstFilePath?: string
): string {
  switch (format) {
    case "json":     return formatJSON(violations);
    case "sarif":    return formatSARIF(violations, firstFilePath);
    case "html":     return formatHTML(violations);
    case "markdown": return formatMarkdown(violations);
    case "tty":
    default:         return formatTTY(violations, { noColor });
  }
}

function output(
  violations: any[],
  format: CLIArgs["format"],
  noColor: boolean,
  firstFilePath?: string,
  outputFile?: string
): void {
  const content = renderOutput(violations, format, noColor, firstFilePath);
  if (outputFile) {
    fs.writeFileSync(outputFile, content, "utf-8");
    console.error(`[manifestvet] Report written to ${outputFile}`);
  } else {
    console.log(content);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Webhook subcommand
  if (args.webhookCmd) {
    const extraRules = args.plugins.length > 0 ? loadPlugins(args.plugins) : [];
    startWebhookServer({
      port: args.webhookPort,
      certFile: args.webhookCert,
      keyFile: args.webhookKey,
      severity: args.severity,
      extraRules,
    });
    return; // server runs indefinitely
  }

  // Hook subcommand
  if (args.hookCmd) {
    const repoRoot = process.cwd();
    switch (args.hookCmd) {
      case "install":
        installPreCommitHook(repoRoot);
        break;
      case "uninstall":
        uninstallPreCommitHook(repoRoot);
        break;
      case "config":
        console.log(generatePreCommitConfig());
        break;
      default:
        console.error(`Unknown hook command: ${args.hookCmd}. Use install|uninstall|config`);
        process.exit(1);
    }
    process.exit(0);
  }

  // Rules subcommand
  if (args.rulesCmd) {
    printRules({ filter: args.rulesFilter, format: args.format, noColor: args.noColor });
    process.exit(0);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log(`manifestvet v${VERSION}`);
    process.exit(0);
  }

  // Load .manifestvet.yaml (or explicit --config) and merge with CLI args
  let projectCfg: ReturnType<typeof loadProjectConfig>["schema"] = {};
  if (args.configFile) {
    try {
      projectCfg = loadConfigFile(args.configFile);
    } catch (e: any) {
      console.error(`[manifestvet] ${e.message}`);
      process.exit(1);
    }
  } else {
    const { schema, filePath } = loadProjectConfig();
    projectCfg = schema;
    if (filePath) {
      console.error(`[manifestvet] Using config: ${filePath}`);
    }
  }

  // CLI args take precedence: merge ignore lists, CLI severity wins if explicitly set
  const mergedIgnore = [...(projectCfg.ignore ?? []), ...args.ignore];
  const mergedPlugins = [...(projectCfg.plugins ?? []), ...args.plugins];
  const resolvedSeverity = args.severitySet ? args.severity : (projectCfg.severity ?? args.severity);
  const resolvedFormat = args.format !== "tty" ? args.format : (projectCfg.format ?? args.format);
  const resolvedK8sVersion = args.k8sVersion ?? projectCfg.k8sVersion;
  const resolvedOutputFile = args.outputFile ?? projectCfg.outputFile;
  // Merge severity overrides: CLI doesn't have per-rule override flags, config file only
  const resolvedSeverityOverrides = projectCfg.severityOverrides;

  const config: ManifestVetConfig = loadConfig({
    ignore: mergedIgnore,
    severity: resolvedSeverity,
    format: resolvedFormat as any,
    noColor: args.noColor,
    k8sVersion: resolvedK8sVersion,
    allowedRegistries: projectCfg.allowedRegistries,
    namespaceExclusions: projectCfg.namespaceExclusions,
    severityOverrides: resolvedSeverityOverrides,
  });

  // Watch subcommand
  if (args.watchCmd) {
    let intervalMs: number;
    try {
      intervalMs = parseInterval(args.watchInterval);
    } catch (e: any) {
      console.error(`[manifestvet] ${e.message}`);
      process.exit(1);
    }
    const watchExtraRules = mergedPlugins.length > 0 ? loadPlugins(mergedPlugins) : [];
    await startWatch({
      cluster: args.cluster,
      clusterOpts: {
        context: args.context,
        namespace: args.namespace,
        allNamespaces: args.allNamespaces,
      },
      dir: args.dir,
      intervalMs,
      config,
      extraRules: watchExtraRules,
      noColor: args.noColor,
    });
    return;
  }

  let files: { path: string; content: string }[] = [];

  if (args.stdin) {
    const content = await readStdin();
    files = [{ path: "stdin", content }];
  } else if (args.github) {
    files = await fetchManifestsFromGitHub(
      args.github,
      args.branch,
      args.githubPath
    );
  } else if (args.kustomize) {
    if (!isKustomizeDir(args.kustomize)) {
      console.error(`No kustomization.yaml found in: ${args.kustomize}`);
      process.exit(1);
    }
    files = collectKustomizeFiles(args.kustomize);
    if (files.length === 0) {
      console.error("No YAML files found via Kustomize.");
      process.exit(1);
    }
  } else if (args.helm) {
    try {
      files = renderHelmChart({
        chartDir: args.helm,
        valuesFiles: args.helmValues,
        setValues: args.helmSet,
        releaseName: args.helmRelease,
        namespace: args.namespace,
      });
    } catch (e: any) {
      console.error(`[manifestvet] Helm error: ${e.message}`);
      process.exit(1);
    }
    if (files.length === 0) {
      console.error("[manifestvet] helm template produced no output.");
      process.exit(1);
    }
  } else if (args.cluster) {
    const clusterFiles = await fetchManifestsFromCluster({
      context: args.context,
      namespace: args.namespace,
      allNamespaces: args.allNamespaces,
    });

    // Delta mode
    const hasLocalFiles = args.files.length > 0 || args.dir !== undefined;
    if (args.delta && hasLocalFiles) {
      const localFiles = args.dir
        ? collectYAMLFiles(args.dir).map((f) => ({
            path: f,
            content: fs.readFileSync(f, "utf-8"),
          }))
        : args.files.map((f) => ({
            path: f,
            content: fs.readFileSync(f, "utf-8"),
          }));

      const { resources: clusterResources } = parseMultipleFiles(clusterFiles);
      const { resources: localResources } = parseMultipleFiles(localFiles);

      const deltaExtraRules = args.plugins.length > 0 ? loadPlugins(args.plugins) : [];
      const clusterViolations = lint(clusterResources, config, deltaExtraRules);
      const localViolations = lint(localResources, config, deltaExtraRules);
      let delta = computeDelta(clusterViolations, localViolations);

      if (args.fix || args.llm) {
        delta = await annotateFixes(delta, { lang: args.fixLang, llm: args.llm });
      }

      if (delta.length === 0) {
        console.log("No drift detected: cluster and local manifests have the same violations.");
        process.exit(0);
      }

      output(delta, args.format, args.noColor, "cluster", resolvedOutputFile);
      process.exit(delta.some((v) => v.severity === "critical" || v.severity === "high") ? 1 : 0);
      return;
    }

    files = clusterFiles;
  } else if (args.dir) {
    const yamlFiles = collectYAMLFiles(args.dir);
    files = yamlFiles.map((f) => ({
      path: f,
      content: fs.readFileSync(f, "utf-8"),
    }));
  } else if (args.files.length > 0) {
    files = args.files.map((f) => ({
      path: f,
      content: fs.readFileSync(f, "utf-8"),
    }));
  } else {
    printHelp();
    process.exit(1);
  }

  const { resources, errors } = parseMultipleFiles(files);

  for (const err of errors) {
    console.error(`Parse error: ${err.message}`);
  }

  if (resources.length === 0 && errors.length === 0) {
    console.error("No Kubernetes resources found.");
    process.exit(1);
  }

  // Load plugin rules (mergedPlugins already combines config file + CLI plugins)
  const extraRules = mergedPlugins.length > 0 ? loadPlugins(mergedPlugins) : [];

  let violations = lint(resources, config, extraRules);

  // OPA/Rego additional violations
  if (args.rego) {
    try {
      const regoViolations = evalRegoPolicy(args.rego, resources);
      violations = [...violations, ...regoViolations];
    } catch (e: any) {
      console.error(`[manifestvet] Rego error: ${e.message}`);
    }
  }

  // Apply inline policy exceptions
  violations = applyIgnoreDirectivesMultiFile(violations, files);

  // Baseline diff
  if (args.baseline) {
    const baseline = loadBaseline(args.baseline);
    if (baseline.length === 0 && !fs.existsSync(args.baseline)) {
      // First run: save baseline
      saveBaseline(violations, args.baseline);
      console.error(`[manifestvet] Baseline saved to ${args.baseline} (${violations.length} violation(s)). Future runs will show only new violations.`);
    } else {
      const fixed = fixedSinceBaseline(violations, baseline);
      violations = diffBaseline(violations, baseline);
      if (fixed.length > 0) {
        console.error(`[manifestvet] ${fixed.length} violation(s) fixed since baseline.`);
      }
      if (violations.length === 0) {
        console.error("[manifestvet] No new violations since baseline.");
        process.exit(0);
      }
    }
  }

  if (args.baselineSave) {
    saveBaseline(violations, args.baselineSave);
    console.error(`[manifestvet] Baseline saved to ${args.baselineSave}`);
  }

  // Annotate with fix suggestions
  if (args.fix || args.llm || args.interactive) {
    violations = await annotateFixes(violations, {
      lang: projectCfg.fixLang ?? args.fixLang,
      llm: args.llm,
    });
  }

  // Interactive fix mode
  if (args.interactive) {
    await runInteractive(violations, args.noColor);
    process.exit(0);
    return;
  }

  // K8s version API check: warn about deprecated/removed APIs in scanned resources
  if (resolvedK8sVersion) {
    for (const resource of resources) {
      const check = checkAPIVersion(resource.apiVersion, resource.kind, resolvedK8sVersion);
      if (check) {
        const replacement = check.replacement ? ` Use ${check.replacement} instead.` : "";
        const msg = check.status === "removed"
          ? `[manifestvet] ${resource.kind} uses ${resource.apiVersion} which was removed in K8s ${check.since}.${replacement}`
          : `[manifestvet] ${resource.kind} uses ${resource.apiVersion} which was deprecated in K8s ${check.since}.${replacement}`;
        console.error(msg);
      }
    }
  }

  // Auto-apply safe fixes
  if (args.applyFixes) {
    const localFiles = args.files.length > 0
      ? args.files
      : args.dir
        ? collectYAMLFiles(args.dir)
        : [];

    if (localFiles.length === 0) {
      console.error("--apply-fixes requires local file arguments or --dir.");
      process.exit(1);
    }

    const results = applyFixesToFiles(localFiles, violations);
    for (const r of results) {
      console.error(
        `[manifestvet] ${r.file}: applied ${r.applied} fix(es), skipped ${r.skipped} (backup: ${r.backupPath})`
      );
    }
  }

  // Summary mode: print aggregated counts instead of individual violations
  if (args.summary) {
    const summaryText = formatSummary(violations, { noColor: args.noColor });
    if (resolvedOutputFile) {
      fs.writeFileSync(resolvedOutputFile, summaryText, "utf-8");
      console.error(`[manifestvet] Summary written to ${resolvedOutputFile}`);
    } else {
      console.log(summaryText);
    }
    if (args.exitZero) process.exit(0);
    const hasErrors = violations.some((v) => v.severity === "critical" || v.severity === "high");
    process.exit(hasErrors ? 1 : 0);
    return;
  }

  output(violations, args.format, args.noColor, files[0]?.path, resolvedOutputFile);

  if (args.exitZero) {
    process.exit(0);
  }
  const hasErrors = violations.some((v) => v.severity === "critical" || v.severity === "high");
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
