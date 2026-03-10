import * as fs from "fs";
import * as path from "path";

const PRE_COMMIT_HOOKS_YAML = `repos:
  - repo: local
    hooks:
      - id: manifestvet
        name: ManifestVet — Kubernetes manifest security lint
        language: node
        entry: manifestvet
        args: ["--severity", "error"]
        types: [yaml]
        pass_filenames: true
`;

const PRE_COMMIT_HOOK_SCRIPT = `#!/bin/sh
# ManifestVet pre-commit hook
# Install: manifestvet hook install

set -e

YAML_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.(yaml|yml)$' || true)

if [ -z "$YAML_FILES" ]; then
  exit 0
fi

echo "[manifestvet] Scanning staged YAML files..."
echo "$YAML_FILES" | xargs manifestvet --severity error

if [ $? -ne 0 ]; then
  echo ""
  echo "[manifestvet] ❌ Security violations found. Fix them or use --no-verify to skip."
  exit 1
fi

echo "[manifestvet] ✓ All checks passed."
`;

export function installPreCommitHook(repoRoot: string): void {
  const hookPath = path.join(repoRoot, ".git", "hooks", "pre-commit");
  const hookDir = path.dirname(hookPath);

  if (!fs.existsSync(hookDir)) {
    throw new Error(`Not a git repository or .git/hooks not found: ${hookDir}`);
  }

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, "utf-8");
    if (existing.includes("manifestvet")) {
      console.log("[manifestvet] pre-commit hook already installed.");
      return;
    }
    // Append to existing hook
    fs.appendFileSync(hookPath, "\n" + PRE_COMMIT_HOOK_SCRIPT);
    console.log("[manifestvet] Appended to existing pre-commit hook.");
  } else {
    fs.writeFileSync(hookPath, PRE_COMMIT_HOOK_SCRIPT, { mode: 0o755 });
    console.log(`[manifestvet] pre-commit hook installed at ${hookPath}`);
  }
}

export function uninstallPreCommitHook(repoRoot: string): void {
  const hookPath = path.join(repoRoot, ".git", "hooks", "pre-commit");
  if (!fs.existsSync(hookPath)) {
    console.log("[manifestvet] No pre-commit hook found.");
    return;
  }
  const content = fs.readFileSync(hookPath, "utf-8");
  if (!content.includes("manifestvet")) {
    console.log("[manifestvet] ManifestVet hook not found in pre-commit.");
    return;
  }
  // If the entire file is ours, remove it; otherwise strip our block
  if (content.trim() === PRE_COMMIT_HOOK_SCRIPT.trim()) {
    fs.unlinkSync(hookPath);
    console.log("[manifestvet] pre-commit hook removed.");
  } else {
    const stripped = content
      .split("\n")
      .filter((l) => !l.includes("manifestvet"))
      .join("\n");
    fs.writeFileSync(hookPath, stripped);
    console.log("[manifestvet] ManifestVet removed from pre-commit hook.");
  }
}

export function generatePreCommitConfig(): string {
  return PRE_COMMIT_HOOKS_YAML;
}
