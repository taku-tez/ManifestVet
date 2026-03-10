import * as yaml from "js-yaml";
import { K8sResource, ParseResult, ParseError } from "./types";

export function parseYAML(content: string): ParseResult {
  const resources: K8sResource[] = [];
  const errors: ParseError[] = [];

  const documents = content.split(/^---$/m);

  for (const doc of documents) {
    const trimmed = doc.trim();
    if (!trimmed || trimmed === "") continue;

    try {
      const parsed = yaml.load(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, any>;
        if (obj.apiVersion && obj.kind) {
          resources.push({
            apiVersion: obj.apiVersion,
            kind: obj.kind,
            metadata: {
              name: obj.metadata?.name ?? "",
              namespace: obj.metadata?.namespace,
              labels: obj.metadata?.labels,
              annotations: obj.metadata?.annotations,
            },
            spec: obj.spec,
            data: obj.data,
            stringData: obj.stringData,
            rules: obj.rules,
            roleRef: obj.roleRef,
            subjects: obj.subjects,
            type: obj.type,
          });
        }
      }
    } catch (e: any) {
      errors.push({ message: e.message ?? String(e) });
    }
  }

  return { resources, errors };
}

export function parseMultipleFiles(
  files: { path: string; content: string }[]
): ParseResult {
  const allResources: K8sResource[] = [];
  const allErrors: ParseError[] = [];

  for (const file of files) {
    const result = parseYAML(file.content);
    allResources.push(...result.resources);
    allErrors.push(
      ...result.errors.map((e) => ({ ...e, message: `${file.path}: ${e.message}` }))
    );
  }

  return { resources: allResources, errors: allErrors };
}
