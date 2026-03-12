import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { FixLang } from "./fixes";

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export interface ConfigFileSchema {
  ignore?: string[];
  severity?: SeverityLevel;
  format?: "tty" | "json" | "sarif" | "html" | "markdown";
  fixLang?: FixLang;
  plugins?: string[];
  allowedRegistries?: string[];
  namespaceExclusions?: string[];
  k8sVersion?: string;
  /** Override severity for specific rules. Example: { MV6007: "low", MV4002: "medium" } */
  severityOverrides?: Record<string, SeverityLevel>;
  /** Write report to this file path instead of stdout. */
  outputFile?: string;
}

const CONFIG_FILENAMES = [".manifestvet.yaml", ".manifestvet.yml"];

export function findConfigFile(startDir: string = process.cwd()): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.join(startDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function loadConfigFile(filePath: string): ConfigFileSchema {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as ConfigFileSchema;
  } catch (e: any) {
    throw new Error(`Failed to load config file "${filePath}": ${e.message}`);
  }
}

export function loadProjectConfig(cwd?: string): { schema: ConfigFileSchema; filePath?: string } {
  const filePath = findConfigFile(cwd);
  if (!filePath) return { schema: {} };
  return { schema: loadConfigFile(filePath), filePath };
}
