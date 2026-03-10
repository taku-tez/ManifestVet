#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { parseYAML, parseMultipleFiles } from "./parser/parser";
import { lint } from "./engine/linter";
import { loadConfig, ManifestVetConfig } from "./engine/config";
import { formatTTY } from "./formatter/tty";
import { formatJSON } from "./formatter/json";
import { formatSARIF } from "./formatter/sarif";
import { fetchManifestsFromGitHub } from "./github";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
manifestvet v${VERSION} - Kubernetes manifest security linter

Usage:
  manifestvet [options] <manifest.yaml> [manifest.yaml...]
  manifestvet --stdin
  manifestvet --github <owner/repo> [--branch <branch>]
  manifestvet --dir <directory>

Options:
  --format <tty|json|sarif>       Output format (default: tty)
  --ignore <rule>                 Ignore rule (repeatable)
  --severity <error|warning|info> Minimum severity to report
  --no-color                      Disable colored output
  --stdin                         Read from stdin
  -h, --help                      Show help
  -v, --version                   Show version
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
  dir?: string;
  format: "tty" | "json" | "sarif";
  ignore: string[];
  severity: "error" | "warning" | "info";
  noColor: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    files: [],
    stdin: false,
    branch: "main",
    format: "tty",
    ignore: [],
    severity: "info",
    noColor: false,
    help: false,
    version: false,
  };

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
        args.format = argv[++i] as "tty" | "json" | "sarif";
        break;
      case "--ignore":
        args.ignore.push(argv[++i]);
        break;
      case "--severity":
        args.severity = argv[++i] as "error" | "warning" | "info";
        break;
      case "--github":
        args.github = argv[++i];
        break;
      case "--branch":
        args.branch = argv[++i];
        break;
      case "--dir":
        args.dir = argv[++i];
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log(`manifestvet v${VERSION}`);
    process.exit(0);
  }

  const config: ManifestVetConfig = loadConfig({
    ignore: args.ignore,
    severity: args.severity,
    format: args.format,
    noColor: args.noColor,
  });

  let files: { path: string; content: string }[] = [];

  if (args.stdin) {
    const content = await readStdin();
    files = [{ path: "stdin", content }];
  } else if (args.github) {
    files = await fetchManifestsFromGitHub(args.github, args.branch);
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

  const violations = lint(resources, config);

  switch (config.format) {
    case "json":
      console.log(formatJSON(violations));
      break;
    case "sarif":
      console.log(formatSARIF(violations, files[0]?.path));
      break;
    case "tty":
    default:
      console.log(formatTTY(violations, { noColor: config.noColor }));
      break;
  }

  const hasErrors = violations.some((v) => v.severity === "error");
  process.exit(hasErrors ? 1 : 0);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
