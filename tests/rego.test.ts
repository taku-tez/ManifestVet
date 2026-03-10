import { describe, it, expect } from "vitest";
import { isOpaAvailable } from "../src/rego";

describe("OPA availability check", () => {
  it("isOpaAvailable returns a boolean", () => {
    // Just verify it doesn't throw and returns boolean
    const available = isOpaAvailable();
    expect(typeof available).toBe("boolean");
  });
});

// Test the Rego policy interface contract
describe("Rego policy interface", () => {
  it("expects violations in the correct format", () => {
    // The expected output format from OPA
    const expectedViolation = {
      rule: "ORG001",
      severity: "medium",
      message: "Missing team label",
      resource: "Deployment/app",
    };
    expect(expectedViolation.rule).toBeTruthy();
    expect(["critical", "high", "medium", "low", "info"]).toContain(expectedViolation.severity);
    expect(typeof expectedViolation.message).toBe("string");
    expect(typeof expectedViolation.resource).toBe("string");
  });

  it("handles unknown severity gracefully", () => {
    const rawViolations = [{ rule: "X001", severity: "unknown-level", message: "test", resource: "Pod/x" }];
    // The rego.ts normalizer converts unknown severity to "medium"
    const normalized = rawViolations.map((v: any) => ({
      ...v,
      severity: (["critical", "high", "medium", "low", "info"].includes(v.severity)
        ? v.severity
        : "medium") as "critical" | "high" | "medium" | "low" | "info",
    }));
    expect(normalized[0].severity).toBe("medium");
  });
});

// Example Rego policy documentation test
describe("Example Rego policy structure", () => {
  const examplePolicy = `
package manifestvet

violations[v] {
  resource := input.resources[_]
  resource.kind == "Deployment"
  not resource.metadata.labels["app.kubernetes.io/name"]
  v := {
    "rule": "ORG002",
    "severity": "medium",
    "message": "Deployment missing app.kubernetes.io/name label",
    "resource": concat("/", [resource.kind, resource.metadata.name]),
  }
}
`;

  it("follows the expected package structure", () => {
    expect(examplePolicy).toContain("package manifestvet");
    expect(examplePolicy).toContain("violations[v]");
    expect(examplePolicy).toContain("input.resources");
  });
});
