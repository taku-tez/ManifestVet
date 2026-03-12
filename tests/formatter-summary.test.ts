import { describe, it, expect } from "vitest";
import { formatSummary } from "../src/formatter/summary";
import { Violation } from "../src/rules/types";

function v(
  rule: string,
  severity: Violation["severity"] = "high",
  resource = "Deployment/app",
  message = "test violation"
): Violation {
  return { rule, severity, resource, message };
}

describe("formatSummary", () => {
  it("shows 'No violations found' for empty list", () => {
    const out = formatSummary([], { noColor: true });
    expect(out).toContain("No violations found");
  });

  it("shows total violation and resource counts", () => {
    const violations = [
      v("MV1001", "critical", "Deployment/a"),
      v("MV1001", "critical", "Deployment/b"),
      v("MV4001", "medium", "Pod/c"),
    ];
    const out = formatSummary(violations, { noColor: true });
    expect(out).toContain("3 violation(s)");
    expect(out).toContain("3 resource(s)");
  });

  it("deduplicates resource count by resource name", () => {
    const violations = [
      v("MV1001", "high", "Deployment/app"),
      v("MV1008", "high", "Deployment/app"), // same resource
      v("MV4001", "medium", "Pod/web"),
    ];
    const out = formatSummary(violations, { noColor: true });
    // 3 violations, 2 unique resources
    expect(out).toContain("3 violation(s)");
    expect(out).toContain("2 resource(s)");
  });

  it("shows severity breakdown", () => {
    const violations = [
      v("MV1001", "critical"),
      v("MV1002", "high"),
      v("MV1003", "high"),
      v("MV4001", "medium"),
    ];
    const out = formatSummary(violations, { noColor: true });
    expect(out).toContain("critical");
    expect(out).toContain("high");
    expect(out).toContain("medium");
  });

  it("shows category breakdown", () => {
    const violations = [
      v("MV1001", "high"),
      v("MV1002", "high"),
      v("MV6001", "info"),
    ];
    const out = formatSummary(violations, { noColor: true });
    expect(out).toContain("MV1");
    expect(out).toContain("MV6");
  });

  it("shows top rules", () => {
    const violations = [
      v("MV6007", "medium"),
      v("MV6007", "medium"),
      v("MV6007", "medium"),
      v("MV1008", "high"),
      v("MV1008", "high"),
    ];
    const out = formatSummary(violations, { noColor: true });
    expect(out).toContain("MV6007");
    expect(out).toContain("MV1008");
  });

  it("works without noColor option (defaults to colored)", () => {
    const violations = [v("MV1001", "critical")];
    // Should not throw when colors are enabled
    expect(() => formatSummary(violations)).not.toThrow();
  });
});
