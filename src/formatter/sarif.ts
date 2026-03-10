import { Violation, Severity } from "../rules/types";
import { ALL_RULES } from "../rules";

function severityToSarif(severity: Severity): string {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
      return "note";
  }
}

export function formatSARIF(
  violations: Violation[],
  filePath?: string
): string {
  const sarif = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ManifestVet",
            version: "0.1.0",
            informationUri: "https://github.com/manifestvet/manifestvet",
            rules: ALL_RULES.map((r) => ({
              id: r.id,
              shortDescription: { text: r.description },
              defaultConfiguration: {
                level: severityToSarif(r.severity),
              },
            })),
          },
        },
        results: violations.map((v) => ({
          ruleId: v.rule,
          level: severityToSarif(v.severity),
          message: { text: v.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: filePath ?? "manifest.yaml",
                },
              },
              logicalLocations: [
                {
                  fullyQualifiedName: v.resource,
                  kind: "resource",
                },
              ],
            },
          ],
          ...(v.fix ? { fixes: [{ description: { text: v.fix } }] } : {}),
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
