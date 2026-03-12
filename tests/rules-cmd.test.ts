import { describe, it, expect, vi, afterEach } from "vitest";
import { printRules } from "../src/rules-cmd";
import { ALL_RULES } from "../src/rules";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printRules", () => {
  it("outputs all rules when no filter is specified", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => lines.push(msg));

    printRules({ noColor: true });

    const output = lines.join("\n");
    expect(output).toContain(`${ALL_RULES.length}`);
    expect(output).toContain("MV1001");
    expect(output).toContain("MV6015");
  });

  it("filters by category prefix (mv1)", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => lines.push(msg));

    printRules({ filter: "mv1", noColor: true });

    const output = lines.join("\n");
    expect(output).toContain("MV1001");
    expect(output).not.toContain("MV2001");
    expect(output).not.toContain("MV4001");
  });

  it("filters by exact rule ID", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => lines.push(msg));

    printRules({ filter: "MV4001", noColor: true });

    const output = lines.join("\n");
    expect(output).toContain("MV4001");
    // Should show only 1 rule in the count area
    expect(output).toContain("1 rule(s) total");
  });

  it("filters by severity", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => lines.push(msg));

    printRules({ filter: "critical", noColor: true });

    const output = lines.join("\n");
    const criticalRules = ALL_RULES.filter((r) => r.severity === "critical");
    expect(output).toContain(`${criticalRules.length} rule(s) total`);
  });

  it("prints error and returns when filter matches nothing", () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((msg: string) => errors.push(msg));
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg));

    printRules({ filter: "MV9999", noColor: true });

    expect(errors.join("")).toContain("MV9999");
    expect(logs).toHaveLength(0);
  });

  it("outputs JSON format", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => lines.push(msg));

    printRules({ format: "json", filter: "MV4001" });

    const output = lines.join("\n");
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe("MV4001");
    expect(parsed[0]).toHaveProperty("severity");
    expect(parsed[0]).toHaveProperty("description");
    expect(parsed[0]).toHaveProperty("tags");
  });

  it("outputs markdown format", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => lines.push(msg));

    printRules({ format: "markdown", filter: "mv4" });

    const output = lines.join("\n");
    expect(output).toContain("# ManifestVet Rules");
    expect(output).toContain("| Rule |");
    expect(output).toContain("MV4001");
  });
});
