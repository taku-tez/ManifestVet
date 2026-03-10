import * as https from "https";
import { Violation } from "../rules/types";
import { FixLang } from "./templates";

interface AnthropicMessage {
  role: "user";
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

function httpsPost(
  host: string,
  path: string,
  headers: Record<string, string>,
  body: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host, path, method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Anthropic API error ${res.statusCode}: ${data}`));
          } else {
            resolve(data);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function buildPrompt(violation: Violation, lang: FixLang): string {
  const langInstruction =
    lang === "ja"
      ? "日本語で回答してください。"
      : "Reply in English.";

  return `You are a Kubernetes security expert. A manifest linter found the following violation:

Rule: ${violation.rule}
Severity: ${violation.severity}
Resource: ${violation.resource}
Message: ${violation.message}

${langInstruction}

Provide:
1. A concise explanation of why this is a security risk (1-2 sentences)
2. A concrete YAML fix snippet showing the recommended configuration

Format your response as:
**Why:** <explanation>
**Fix:**
\`\`\`yaml
<yaml snippet>
\`\`\``;
}

/**
 * Fetch an LLM-augmented fix suggestion for a violation.
 * Requires ANTHROPIC_API_KEY environment variable.
 * Returns undefined if the API key is not set or if the call fails.
 */
export async function getLLMFixSuggestion(
  violation: Violation,
  lang: FixLang
): Promise<string | undefined> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;

  const body = JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: buildPrompt(violation, lang),
      } as AnthropicMessage,
    ],
  });

  try {
    const raw = await httpsPost(
      "api.anthropic.com",
      "/v1/messages",
      {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body).toString(),
      },
      body
    );

    const parsed: AnthropicResponse = JSON.parse(raw);
    return parsed.content?.[0]?.text;
  } catch {
    return undefined;
  }
}
