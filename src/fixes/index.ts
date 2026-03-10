import { Violation } from "../rules/types";
import { getTemplate, getFixSummary, FixLang } from "./templates";
import { getLLMFixSuggestion } from "./llm";

export type { FixLang };

export interface FixOptions {
  lang: FixLang;
  llm?: boolean;
}

/**
 * Annotate violations with fix suggestions.
 * Populates the `fix` field on each violation.
 */
export async function annotateFixes(
  violations: Violation[],
  opts: FixOptions
): Promise<Violation[]> {
  const result: Violation[] = [];

  for (const v of violations) {
    const template = getTemplate(v.rule);
    let fix: string | undefined;

    if (template) {
      const summary = template[opts.lang];
      fix = `${summary}\n\n\`\`\`yaml\n${template.patch.trim()}\n\`\`\``;
    } else if (opts.llm) {
      // Fall back to LLM for rules without a static template
      fix = await getLLMFixSuggestion(v, opts.lang);
    }

    result.push({ ...v, fix });
  }

  return result;
}

export { getTemplate, getFixSummary };
