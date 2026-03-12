import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We mock child_process.spawnSync before importing helm so that no real `helm`
// binary is required in the test environment.
vi.mock("child_process", () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from "child_process";
import { renderHelmChart } from "../src/helm";

const mockSpawnSync = spawnSync as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockSpawnSync.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSuccessResult(stdout: string) {
  return { status: 0, stdout, stderr: "", error: undefined };
}

// ---------------------------------------------------------------------------
// renderHelmChart
// ---------------------------------------------------------------------------
describe("renderHelmChart", () => {
  it("passes correct arguments to helm template", () => {
    mockSpawnSync.mockReturnValue(makeSuccessResult(""));

    renderHelmChart({ chartDir: "/charts/myapp" });

    const [cmd, args] = mockSpawnSync.mock.calls[0];
    expect(cmd).toBe("helm");
    expect(args[0]).toBe("template");
    expect(args[1]).toBe("manifestvet-preview");
    expect(args).toContain("--include-crds");
  });

  it("uses custom release name when provided", () => {
    mockSpawnSync.mockReturnValue(makeSuccessResult(""));

    renderHelmChart({ chartDir: "/charts/myapp", releaseName: "my-release" });

    const [, args] = mockSpawnSync.mock.calls[0];
    expect(args[1]).toBe("my-release");
  });

  it("appends --values for each valuesFiles entry", () => {
    mockSpawnSync.mockReturnValue(makeSuccessResult(""));

    renderHelmChart({ chartDir: "/charts/myapp", valuesFiles: ["/vals/a.yaml", "/vals/b.yaml"] });

    const [, args] = mockSpawnSync.mock.calls[0];
    expect(args).toContain("--values");
    const valuesIdxs = args.reduce((acc: number[], v: string, i: number) => {
      if (v === "--values") acc.push(i);
      return acc;
    }, []);
    expect(valuesIdxs).toHaveLength(2);
  });

  it("appends --set for each setValues entry", () => {
    mockSpawnSync.mockReturnValue(makeSuccessResult(""));

    renderHelmChart({ chartDir: "/charts/myapp", setValues: ["replicas=3", "image.tag=v2"] });

    const [, args] = mockSpawnSync.mock.calls[0];
    const setIdxs = args.reduce((acc: number[], v: string, i: number) => {
      if (v === "--set") acc.push(i);
      return acc;
    }, []);
    expect(setIdxs).toHaveLength(2);
    expect(args[setIdxs[0] + 1]).toBe("replicas=3");
  });

  it("returns empty array when helm output is empty", () => {
    mockSpawnSync.mockReturnValue(makeSuccessResult(""));

    const result = renderHelmChart({ chartDir: "/charts/myapp" });
    expect(result).toEqual([]);
  });

  it("parses Source comments and returns correct paths", () => {
    const stdout = `---
# Source: myapp/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
spec:
  replicas: 1
---
# Source: myapp/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: my-svc
`;
    mockSpawnSync.mockReturnValue(makeSuccessResult(stdout));

    const result = renderHelmChart({ chartDir: "/charts/myapp" });

    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("helm://myapp/templates/deployment.yaml");
    expect(result[0].content).toContain("kind: Deployment");
    expect(result[1].path).toBe("helm://myapp/templates/service.yaml");
    expect(result[1].content).toContain("kind: Service");
  });

  it("strips comment lines from content", () => {
    const stdout = `---
# Source: myapp/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploy
`;
    mockSpawnSync.mockReturnValue(makeSuccessResult(stdout));

    const result = renderHelmChart({ chartDir: "/charts/myapp" });
    expect(result[0].content).not.toContain("# Source:");
  });

  it("uses chart name as fallback path when no Source comment", () => {
    const stdout = `---
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-cm
`;
    mockSpawnSync.mockReturnValue(makeSuccessResult(stdout));

    const result = renderHelmChart({ chartDir: "/charts/myapp" });
    expect(result[0].path).toContain("helm://myapp");
  });

  it("throws when helm binary not found", () => {
    mockSpawnSync.mockReturnValue({
      status: null,
      stdout: "",
      stderr: "",
      error: new Error("spawn helm ENOENT"),
    });

    expect(() => renderHelmChart({ chartDir: "/charts/myapp" })).toThrow(/helm not found/);
  });

  it("throws when helm template exits non-zero", () => {
    mockSpawnSync.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "Error: chart not found",
      error: undefined,
    });

    expect(() => renderHelmChart({ chartDir: "/charts/myapp" })).toThrow(/helm template failed/);
  });
});
