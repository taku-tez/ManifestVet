import { describe, it, expect } from "vitest";
import {
  extractIgnoreDirectives,
  applyIgnoreDirectives,
} from "../src/policy";
import { Violation } from "../src/rules/types";

function v(rule: string): Violation {
  return { rule, severity: "error", message: "test", resource: "Deployment/app" };
}

describe("extractIgnoreDirectives", () => {
  it("returns empty array for yaml with no directives", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
`;
    expect(extractIgnoreDirectives(yaml)).toHaveLength(0);
  });

  it("parses a single rule ignore", () => {
    const yaml = `# manifestvet-ignore: MV1001\napiVersion: apps/v1`;
    const dirs = extractIgnoreDirectives(yaml);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].rules?.has("MV1001")).toBe(true);
  });

  it("parses multiple rules in one comment", () => {
    const yaml = `# manifestvet-ignore: MV1001, MV1002, MV4001\napiVersion: apps/v1`;
    const dirs = extractIgnoreDirectives(yaml);
    expect(dirs[0].rules?.has("MV1001")).toBe(true);
    expect(dirs[0].rules?.has("MV1002")).toBe(true);
    expect(dirs[0].rules?.has("MV4001")).toBe(true);
  });

  it("parses ignore-all directive", () => {
    const yaml = `# manifestvet-ignore-all\napiVersion: apps/v1`;
    const dirs = extractIgnoreDirectives(yaml);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].rules).toBeNull();
  });

  it("is case-insensitive for rule IDs", () => {
    const yaml = `# manifestvet-ignore: mv1001\napiVersion: apps/v1`;
    const dirs = extractIgnoreDirectives(yaml);
    expect(dirs[0].rules?.has("MV1001")).toBe(true);
  });
});

describe("applyIgnoreDirectives", () => {
  it("removes ignored violations", () => {
    const violations = [v("MV1001"), v("MV1002")];
    const yaml = `# manifestvet-ignore: MV1001\napiVersion: apps/v1`;
    const result = applyIgnoreDirectives(violations, yaml);
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("MV1002");
  });

  it("removes all violations with ignore-all", () => {
    const violations = [v("MV1001"), v("MV1002"), v("MV4001")];
    const yaml = `# manifestvet-ignore-all\napiVersion: apps/v1`;
    const result = applyIgnoreDirectives(violations, yaml);
    expect(result).toHaveLength(0);
  });

  it("returns all violations when no directives present", () => {
    const violations = [v("MV1001"), v("MV1002")];
    const yaml = `apiVersion: apps/v1`;
    const result = applyIgnoreDirectives(violations, yaml);
    expect(result).toHaveLength(2);
  });

  it("does not remove non-ignored violations", () => {
    const violations = [v("MV1001"), v("MV4001")];
    const yaml = `# manifestvet-ignore: MV1001`;
    const result = applyIgnoreDirectives(violations, yaml);
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("MV4001");
  });
});
