export interface ManifestVetConfig {
  ignore: string[];
  severity: "critical" | "high" | "medium" | "low" | "info";
  format: "tty" | "json" | "sarif";
  noColor: boolean;
}

export const DEFAULT_CONFIG: ManifestVetConfig = {
  ignore: [],
  severity: "info",
  format: "tty",
  noColor: false,
};

export function loadConfig(
  overrides: Partial<ManifestVetConfig> = {}
): ManifestVetConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}
