import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findConfigFile, loadConfigFile, loadProjectConfig } from "../src/config-file";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-cfg-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// findConfigFile
// ---------------------------------------------------------------------------
describe("findConfigFile", () => {
  it("returns path when .manifestvet.yaml exists", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "ignore: []\n");
    expect(findConfigFile(tmpDir)).toBe(p);
  });

  it("returns path when .manifestvet.yml exists", () => {
    const p = path.join(tmpDir, ".manifestvet.yml");
    fs.writeFileSync(p, "ignore: []\n");
    expect(findConfigFile(tmpDir)).toBe(p);
  });

  it("prefers .yaml over .yml when both exist", () => {
    const yaml = path.join(tmpDir, ".manifestvet.yaml");
    const yml = path.join(tmpDir, ".manifestvet.yml");
    fs.writeFileSync(yaml, "ignore: [MV1001]\n");
    fs.writeFileSync(yml, "ignore: []\n");
    expect(findConfigFile(tmpDir)).toBe(yaml);
  });

  it("returns undefined when no config file exists", () => {
    expect(findConfigFile(tmpDir)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// loadConfigFile
// ---------------------------------------------------------------------------
describe("loadConfigFile", () => {
  it("loads ignore list", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "ignore:\n  - MV1001\n  - MV4001\n");
    const cfg = loadConfigFile(p);
    expect(cfg.ignore).toEqual(["MV1001", "MV4001"]);
  });

  it("loads severity", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "severity: high\n");
    const cfg = loadConfigFile(p);
    expect(cfg.severity).toBe("high");
  });

  it("loads allowedRegistries", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "allowedRegistries:\n  - gcr.io/my-company\n  - docker.io\n");
    const cfg = loadConfigFile(p);
    expect(cfg.allowedRegistries).toEqual(["gcr.io/my-company", "docker.io"]);
  });

  it("loads namespaceExclusions", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "namespaceExclusions:\n  - kube-system\n  - monitoring\n");
    const cfg = loadConfigFile(p);
    expect(cfg.namespaceExclusions).toEqual(["kube-system", "monitoring"]);
  });

  it("loads k8sVersion", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, 'k8sVersion: "1.28"\n');
    const cfg = loadConfigFile(p);
    expect(cfg.k8sVersion).toBe("1.28");
  });

  it("loads plugins list", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "plugins:\n  - ./custom-rules.js\n");
    const cfg = loadConfigFile(p);
    expect(cfg.plugins).toEqual(["./custom-rules.js"]);
  });

  it("returns empty object for empty file", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "");
    const cfg = loadConfigFile(p);
    expect(cfg).toEqual({});
  });

  it("throws on invalid YAML", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "ignore: [\nbroken yaml");
    expect(() => loadConfigFile(p)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// loadProjectConfig
// ---------------------------------------------------------------------------
describe("loadProjectConfig", () => {
  it("returns empty schema when no config file found", () => {
    const { schema, filePath } = loadProjectConfig(tmpDir);
    expect(schema).toEqual({});
    expect(filePath).toBeUndefined();
  });

  it("returns schema and filePath when config exists", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "severity: medium\n");
    const { schema, filePath } = loadProjectConfig(tmpDir);
    expect(schema.severity).toBe("medium");
    expect(filePath).toBe(p);
  });
});

// ---------------------------------------------------------------------------
// severityOverrides and outputFile
// ---------------------------------------------------------------------------
describe("ConfigFileSchema — new fields", () => {
  it("loads severityOverrides", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(
      p,
      "severityOverrides:\n  MV6007: low\n  MV4002: medium\n"
    );
    const cfg = loadConfigFile(p);
    expect(cfg.severityOverrides).toEqual({ MV6007: "low", MV4002: "medium" });
  });

  it("loads outputFile", () => {
    const p = path.join(tmpDir, ".manifestvet.yaml");
    fs.writeFileSync(p, "outputFile: report.html\n");
    const cfg = loadConfigFile(p);
    expect(cfg.outputFile).toBe("report.html");
  });
});
