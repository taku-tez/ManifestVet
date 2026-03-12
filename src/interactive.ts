import * as readline from "readline";
import * as fs from "fs";
import { Violation } from "./rules/types";
import { applyFixesToFile } from "./fixes/apply";
import { formatTTY } from "./formatter/tty";

const C = {
  bold: "\x1b[1m",
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export interface InteractiveResult {
  fixed: number;
  ignored: number;
  skipped: number;
  quit: boolean;
}

function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

/**
 * Insert `# manifestvet-ignore: RULE` before the YAML document that contains
 * the violating resource. Falls back to prepending at the start of the file.
 */
export function insertIgnoreComment(filePath: string, ruleId: string, resourceName: string): void {
  const content = fs.readFileSync(filePath, "utf-8");

  // Find the last `---` separator before the resource's `name:` field
  const namePattern = new RegExp(`name:\\s*${escapeRegex(resourceName)}\\b`);
  const nameMatch = namePattern.exec(content);

  let insertPos = 0;
  if (nameMatch) {
    const docSepPos = content.lastIndexOf("\n---", nameMatch.index);
    if (docSepPos !== -1) {
      // Insert after the `---\n` line
      insertPos = docSepPos + 1;
    }
  }

  const before = content.slice(0, insertPos);
  const after = content.slice(insertPos);
  fs.writeFileSync(filePath, `${before}# manifestvet-ignore: ${ruleId}\n${after}`, "utf-8");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readKey(): Promise<string> {
  return new Promise((resolve) => {
    const handler = (_: unknown, key: readline.Key) => {
      process.stdin.removeListener("keypress", handler as any);
      resolve((key?.name ?? key?.sequence ?? "").toLowerCase());
    };
    process.stdin.once("keypress", handler as any);
  });
}

/**
 * Interactive violation review loop.
 * Shows each violation and lets the user Fix / Ignore / Skip / Quit.
 */
export async function runInteractive(
  violations: Violation[],
  noColor: boolean
): Promise<InteractiveResult> {
  if (violations.length === 0) {
    console.log("No violations to review.");
    return { fixed: 0, ignored: 0, skipped: 0, quit: false };
  }

  if (!process.stdin.isTTY) {
    console.error("--interactive requires an interactive terminal (TTY).");
    process.exit(1);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  const result: InteractiveResult = { fixed: 0, ignored: 0, skipped: 0, quit: false };
  let i = 0;

  while (i < violations.length) {
    const v = violations[i];
    clearScreen();

    const progress = noColor
      ? `[${i + 1}/${violations.length}] Interactive Review`
      : `${C.bold}[${i + 1}/${violations.length}] Interactive Review${C.reset}`;

    console.log(`\n${progress}\n`);
    console.log(formatTTY([v], { noColor }));

    if (v.path) {
      const fileNote = noColor ? `File: ${v.path}` : `${C.dim}File: ${v.path}${C.reset}`;
      console.log(fileNote);
    }

    const prompt = noColor
      ? "\n[F]ix  [I]gnore  [S]kip  [Q]uit  "
      : `\n${C.cyan}[F]ix  [I]gnore  [S]kip  [Q]uit${C.reset}  `;
    process.stdout.write(prompt);

    const key = await readKey();

    if (key === "q") {
      result.quit = true;
      break;
    }

    if (key === "f") {
      const filePath = v.path;
      if (filePath && !filePath.startsWith("cluster://") && filePath !== "stdin" && fs.existsSync(filePath)) {
        try {
          applyFixesToFile(filePath, [v]);
          console.log(`\n${noColor ? "" : C.green}Fix applied.${noColor ? "" : C.reset}`);
          result.fixed++;
        } catch (e: any) {
          console.error(`\nFix failed: ${e.message}`);
        }
      } else {
        console.log(`\n${noColor ? "" : C.yellow}Cannot apply fix: no local file.${noColor ? "" : C.reset}`);
      }
      i++;
    } else if (key === "i") {
      const filePath = v.path;
      if (filePath && !filePath.startsWith("cluster://") && filePath !== "stdin" && fs.existsSync(filePath)) {
        const resourceName = v.resource.split("/").pop() ?? "";
        try {
          insertIgnoreComment(filePath, v.rule, resourceName);
          console.log(`\n${noColor ? "" : C.green}Ignore comment inserted.${noColor ? "" : C.reset}`);
          result.ignored++;
        } catch (e: any) {
          console.error(`\nFailed to insert ignore comment: ${e.message}`);
        }
      } else {
        console.log(`\n${noColor ? "" : C.yellow}Cannot insert ignore: no local file.${noColor ? "" : C.reset}`);
      }
      i++;
    } else if (key === "s") {
      result.skipped++;
      i++;
    }
    // Any other key: re-display same violation
  }

  process.stdin.setRawMode(false);
  process.stdin.pause();

  clearScreen();
  const total = result.fixed + result.ignored + result.skipped;
  console.log(`\nInteractive review complete (${total} of ${violations.length} reviewed):`);
  console.log(`  Fixed:   ${result.fixed}`);
  console.log(`  Ignored: ${result.ignored}`);
  console.log(`  Skipped: ${result.skipped}`);
  if (result.quit) console.log(`  (Quit early)`);
  console.log("");

  return result;
}
