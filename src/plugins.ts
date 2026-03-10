import * as path from "path";
import { Rule } from "./rules/types";

export interface PluginModule {
  rules: Rule[];
  /** Optional metadata */
  name?: string;
  version?: string;
}

/**
 * Load a custom rule plugin from a JS file.
 * The plugin must export `{ rules: Rule[] }`.
 *
 * Example plugin (my-rules.js):
 * ```js
 * module.exports = {
 *   name: "my-org-rules",
 *   rules: [{
 *     id: "ORG001",
 *     severity: "warning",
 *     description: "Deployments must have team label",
 *     check({ resource }) {
 *       if (resource.kind !== "Deployment") return [];
 *       if (!resource.metadata?.labels?.["team"]) {
 *         return [{
 *           rule: "ORG001",
 *           severity: "warning",
 *           message: "Missing required label: team",
 *           resource: `${resource.kind}/${resource.metadata.name}`,
 *         }];
 *       }
 *       return [];
 *     },
 *   }],
 * };
 * ```
 */
export function loadPlugin(pluginPath: string): Rule[] {
  const absPath = path.resolve(pluginPath);

  let mod: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require(absPath);
  } catch (e: any) {
    throw new Error(`Cannot load plugin "${absPath}": ${e.message}`);
  }

  // Support both `module.exports = { rules }` and `module.exports.rules`
  const candidate = (mod as any)?.default ?? mod;

  if (!candidate || typeof candidate !== "object") {
    throw new Error(
      `Plugin "${absPath}" must export an object with a "rules" array.`
    );
  }

  if (!Array.isArray((candidate as any).rules)) {
    throw new Error(
      `Plugin "${absPath}" export must have a "rules" array. Got: ${typeof (candidate as any).rules}`
    );
  }

  const rules: Rule[] = (candidate as PluginModule).rules;

  // Basic validation of each rule
  for (const r of rules) {
    if (!r.id || typeof r.id !== "string") {
      throw new Error(`Plugin "${absPath}": each rule must have a string "id".`);
    }
    if (typeof r.check !== "function") {
      throw new Error(
        `Plugin "${absPath}": rule "${r.id}" must have a "check" function.`
      );
    }
  }

  const pluginName = (candidate as PluginModule).name ?? path.basename(absPath);
  console.error(
    `[manifestvet] Loaded plugin "${pluginName}" with ${rules.length} rule(s): ${rules.map((r) => r.id).join(", ")}`
  );

  return rules;
}

/**
 * Load multiple plugins and merge their rules.
 */
export function loadPlugins(pluginPaths: string[]): Rule[] {
  return pluginPaths.flatMap((p) => loadPlugin(p));
}
