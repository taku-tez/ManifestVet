import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { prepareFixReports, writeFixSummary } from "../src/fixes/applier";
import { Violation } from "../src/rules/types";

const violations: Violation[] = [
  {
    rule: "MV1001",
    severity: "high",
    message: "runAsNonRoot not set to true",
    resource: "Deployment/nginx",
  },
  {
    rule: "MV1008",
    severity: "medium",
    message: "no resource limits set",
    resource: "Deployment/nginx",
  },
  {
    rule: "MV6001",
    severity: "info",
    message: "missing recommended labels",
    resource: "Service/frontend",
  },
  // Rule with no template
  {
    rule: "MV9999",
    severity: "high",
    message: "unknown rule",
    resource: "Deployment/nginx",
  },
];

const fileMap: Record<string, string> = {
  "Deployment/nginx": "deploy.yaml",
  "Service/frontend": "service.yaml",
};

describe("prepareFixReports", () => {
  it("returns only violations that have a fix template", () => {
    const reports = prepareFixReports(violations, fileMap);
    const allFixes = reports.flatMap((r) => r.fixes);
    // MV9999 has no template, so it should be excluded
    const rules = allFixes.map((f) => f.violation.rule);
    expect(rules).not.toContain("MV9999");
  });

  it("groups violations by file", () => {
    const reports = prepareFixReports(violations, fileMap);
    const files = reports.map((r) => r.file);
    expect(files).toContain("deploy.yaml");
    expect(files).toContain("service.yaml");
  });

  it("includes patch string from template", () => {
    const reports = prepareFixReports(violations, fileMap);
    const deployReport = reports.find((r) => r.file === "deploy.yaml");
    expect(deployReport).toBeDefined();
    const mv1001Fix = deployReport!.fixes.find((f) => f.violation.rule === "MV1001");
    expect(mv1001Fix).toBeDefined();
    expect(mv1001Fix!.patch).toContain("runAsNonRoot");
  });

  it("correctly sets safe flag from template", () => {
    const reports = prepareFixReports(violations, fileMap);
    const deployReport = reports.find((r) => r.file === "deploy.yaml");
    expect(deployReport).toBeDefined();

    // MV1001 is safe: true
    const mv1001Fix = deployReport!.fixes.find((f) => f.violation.rule === "MV1001");
    expect(mv1001Fix!.safe).toBe(true);

    // MV1008 is safe: false
    const mv1008Fix = deployReport!.fixes.find((f) => f.violation.rule === "MV1008");
    expect(mv1008Fix!.safe).toBe(false);
  });

  it("returns empty array for violations with no templates", () => {
    const noTemplateViolations: Violation[] = [
      { rule: "MV9999", severity: "high", message: "unknown", resource: "Pod/foo" },
    ];
    const reports = prepareFixReports(noTemplateViolations, { "Pod/foo": "pod.yaml" });
    expect(reports).toHaveLength(0);
  });

  it("assigns 'unknown' file for resources not in fileMap", () => {
    const orphanViolations: Violation[] = [
      { rule: "MV1001", severity: "high", message: "runAsNonRoot not set", resource: "Deployment/orphan" },
    ];
    const reports = prepareFixReports(orphanViolations, {});
    expect(reports).toHaveLength(1);
    expect(reports[0].file).toBe("unknown");
  });

  it("returns empty array for empty violations", () => {
    const reports = prepareFixReports([], fileMap);
    expect(reports).toHaveLength(0);
  });
});

describe("writeFixSummary", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifestvet-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a markdown file", () => {
    const reports = prepareFixReports(violations, fileMap);
    const outPath = path.join(tmpDir, "fixes.md");
    writeFixSummary(reports, outPath);
    expect(fs.existsSync(outPath)).toBe(true);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("# ManifestVet Fix Summary");
  });

  it("includes file sections in the output", () => {
    const reports = prepareFixReports(violations, fileMap);
    const outPath = path.join(tmpDir, "fixes.md");
    writeFixSummary(reports, outPath);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("## deploy.yaml");
    expect(content).toContain("## service.yaml");
  });

  it("includes rule IDs and resource names", () => {
    const reports = prepareFixReports(violations, fileMap);
    const outPath = path.join(tmpDir, "fixes.md");
    writeFixSummary(reports, outPath);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("MV1001");
    expect(content).toContain("Deployment/nginx");
  });

  it("safeOnly=true filters out non-safe fixes", () => {
    const reports = prepareFixReports(violations, fileMap);
    const outPath = path.join(tmpDir, "fixes-safe.md");
    writeFixSummary(reports, outPath, true);
    const content = fs.readFileSync(outPath, "utf-8");
    // MV1008 is safe: false, should be excluded
    expect(content).not.toContain("MV1008");
    // MV1001 is safe: true, should be included
    expect(content).toContain("MV1001");
  });

  it("safeOnly=false includes all fixes (default)", () => {
    const reports = prepareFixReports(violations, fileMap);
    const outPath = path.join(tmpDir, "fixes-all.md");
    writeFixSummary(reports, outPath, false);
    const content = fs.readFileSync(outPath, "utf-8");
    // MV1008 is safe: false but should appear with safeOnly=false
    expect(content).toContain("MV1008");
  });

  it("includes Generated timestamp", () => {
    const reports = prepareFixReports(violations, fileMap);
    const outPath = path.join(tmpDir, "fixes.md");
    writeFixSummary(reports, outPath);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("Generated:");
  });

  it("includes safe/not-safe indicator", () => {
    const reports = prepareFixReports(violations, fileMap);
    const outPath = path.join(tmpDir, "fixes.md");
    writeFixSummary(reports, outPath, false);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("✓ Yes");
    expect(content).toContain("✗ No (requires review)");
  });

  it("produces empty summary (only header) when all reports have safeOnly filtered", () => {
    // Only MV1008 (safe: false) in violations
    const unsafeViolations: Violation[] = [
      { rule: "MV1008", severity: "medium", message: "no limits", resource: "Deployment/x" },
    ];
    const reports = prepareFixReports(unsafeViolations, { "Deployment/x": "x.yaml" });
    const outPath = path.join(tmpDir, "fixes-empty.md");
    writeFixSummary(reports, outPath, true);
    const content = fs.readFileSync(outPath, "utf-8");
    expect(content).toContain("# ManifestVet Fix Summary");
    expect(content).not.toContain("## x.yaml");
  });
});
