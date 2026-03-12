import { describe, it, expect } from "vitest";
import { lint } from "../src/engine/linter";
import { loadConfig } from "../src/engine/config";
import { parseYAML } from "../src/parser/parser";

const DEPLOYMENT_YAML = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: test
    spec:
      containers:
        - name: app
          image: nginx:latest
          resources: {}
`;

describe("severity overrides in linter", () => {
  it("uses rule default severity when no override configured", () => {
    const { resources } = parseYAML(DEPLOYMENT_YAML);
    const config = loadConfig({ severity: "info" });
    const violations = lint(resources, config);
    const mv4001 = violations.find((v) => v.rule === "MV4001");
    expect(mv4001).toBeDefined();
    expect(mv4001!.severity).toBe("medium"); // MV4001 default severity
  });

  it("applies severity override to emitted violations", () => {
    const { resources } = parseYAML(DEPLOYMENT_YAML);
    const config = loadConfig({
      severity: "info",
      severityOverrides: { MV4001: "critical" },
    });
    const violations = lint(resources, config);
    const mv4001 = violations.find((v) => v.rule === "MV4001");
    expect(mv4001).toBeDefined();
    expect(mv4001!.severity).toBe("critical");
  });

  it("filters out rule when overridden severity is below threshold", () => {
    const { resources } = parseYAML(DEPLOYMENT_YAML);
    const config = loadConfig({
      severity: "high",                        // min severity = high
      severityOverrides: { MV4001: "info" },   // MV4001 overridden to info
    });
    const violations = lint(resources, config);
    const mv4001 = violations.find((v) => v.rule === "MV4001");
    expect(mv4001).toBeUndefined(); // filtered out by min-severity
  });

  it("promotes a rule above threshold with override", () => {
    const { resources } = parseYAML(DEPLOYMENT_YAML);
    const config = loadConfig({
      severity: "critical",                       // only critical pass
      severityOverrides: { MV4001: "critical" }, // promote MV4001
    });
    const violations = lint(resources, config);
    const mv4001 = violations.find((v) => v.rule === "MV4001");
    expect(mv4001).toBeDefined();
    expect(mv4001!.severity).toBe("critical");
  });

  it("override keys are case-insensitive", () => {
    const { resources } = parseYAML(DEPLOYMENT_YAML);
    const config = loadConfig({
      severity: "info",
      severityOverrides: { mv4001: "critical" }, // lowercase key
    });
    const violations = lint(resources, config);
    const mv4001 = violations.find((v) => v.rule === "MV4001");
    expect(mv4001).toBeDefined();
    expect(mv4001!.severity).toBe("critical");
  });

  it("only overrides the specified rule, not others", () => {
    const { resources } = parseYAML(DEPLOYMENT_YAML);
    const config = loadConfig({
      severity: "info",
      severityOverrides: { MV4001: "critical" },
    });
    const violations = lint(resources, config);
    // MV1008 (resource limits) should keep its default severity, not be affected
    const mv1008 = violations.find((v) => v.rule === "MV1008");
    if (mv1008) {
      expect(mv1008.severity).not.toBe("critical");
    }
    // MV4001 should be overridden
    const mv4001 = violations.find((v) => v.rule === "MV4001");
    expect(mv4001?.severity).toBe("critical");
  });
});
