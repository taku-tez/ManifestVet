import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

interface KustomizationFile {
  resources?: string[];
  bases?: string[];
  components?: string[];
  patches?: Array<{ path?: string } | string>;
  patchesStrategicMerge?: string[];
  patchesJson6902?: Array<{ path?: string }>;
  configMapGenerator?: Array<{ files?: string[] }>;
  secretGenerator?: Array<{ files?: string[] }>;
}

/**
 * Discover and collect all YAML files referenced by a kustomization.yaml
 * (or kustomization.yml), recursively resolving overlays and bases.
 */
export function collectKustomizeFiles(
  kustomizeDir: string,
  visited: Set<string> = new Set()
): { path: string; content: string }[] {
  const absDir = path.resolve(kustomizeDir);

  // Guard against cycles
  if (visited.has(absDir)) return [];
  visited.add(absDir);

  // Find kustomization file
  const candidates = [
    "kustomization.yaml",
    "kustomization.yml",
    "Kustomization",
  ];
  let kustomizationPath: string | undefined;
  for (const name of candidates) {
    const p = path.join(absDir, name);
    if (fs.existsSync(p)) {
      kustomizationPath = p;
      break;
    }
  }

  if (!kustomizationPath) return [];

  let kust: KustomizationFile;
  try {
    kust = yaml.load(fs.readFileSync(kustomizationPath, "utf-8")) as KustomizationFile;
  } catch {
    return [];
  }

  if (!kust || typeof kust !== "object") return [];

  const results: { path: string; content: string }[] = [];

  const addYamlFile = (filePath: string) => {
    if (!fs.existsSync(filePath)) return;
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".yaml" && ext !== ".yml") return;
    const content = fs.readFileSync(filePath, "utf-8");
    results.push({ path: filePath, content });
  };

  // resources / bases
  const refs = [
    ...(kust.resources ?? []),
    ...(kust.bases ?? []),
    ...(kust.components ?? []),
  ];

  for (const ref of refs) {
    const refPath = path.join(absDir, ref);
    if (fs.existsSync(refPath)) {
      const stat = fs.statSync(refPath);
      if (stat.isDirectory()) {
        // Recurse into base/overlay directory
        results.push(...collectKustomizeFiles(refPath, visited));
      } else {
        addYamlFile(refPath);
      }
    }
  }

  // patches
  const patches = kust.patches ?? [];
  for (const p of patches) {
    const patchPath = typeof p === "string" ? p : p.path;
    if (patchPath) addYamlFile(path.join(absDir, patchPath));
  }

  const smpPatches = kust.patchesStrategicMerge ?? [];
  for (const p of smpPatches) {
    addYamlFile(path.join(absDir, p));
  }

  const json6902 = kust.patchesJson6902 ?? [];
  for (const p of json6902) {
    if (p.path) addYamlFile(path.join(absDir, p.path));
  }

  return results;
}

/**
 * Check whether a directory contains a kustomization file.
 */
export function isKustomizeDir(dir: string): boolean {
  return ["kustomization.yaml", "kustomization.yml", "Kustomization"].some(
    (name) => fs.existsSync(path.join(dir, name))
  );
}
