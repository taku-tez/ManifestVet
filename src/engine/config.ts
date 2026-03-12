export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface ManifestVetConfig {
  ignore: string[];
  severity: Severity;
  format: "tty" | "json" | "sarif";
  noColor: boolean;
  /** Target Kubernetes version (e.g. "1.28") for API deprecation checks and rule gating. */
  k8sVersion?: string;
  /** Registries allowed for image pulls; used by image-security rules. */
  allowedRegistries?: string[];
  /** Namespaces to skip entirely during linting. */
  namespaceExclusions?: string[];
  /** Per-rule severity overrides. Key: rule ID (e.g. "MV6007"), value: desired severity. */
  severityOverrides?: Record<string, Severity>;
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
