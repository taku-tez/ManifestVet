import { describe, it, expect } from "vitest";
import {
  parseVersion,
  getRemovedAPIs,
  getDeprecatedAPIs,
  getRulesToSkip,
  checkAPIVersion,
  DEPRECATED_APIS,
} from "../src/k8s-versions";

// ---------------------------------------------------------------------------
// parseVersion
// ---------------------------------------------------------------------------
describe("parseVersion", () => {
  it("parses '1.28' correctly", () => {
    expect(parseVersion("1.28")).toBe(1028);
  });

  it("parses 'v1.22' correctly (strips leading v)", () => {
    expect(parseVersion("v1.22")).toBe(1022);
  });

  it("compares versions correctly", () => {
    expect(parseVersion("1.22") < parseVersion("1.28")).toBe(true);
    expect(parseVersion("1.28") > parseVersion("1.16")).toBe(true);
    expect(parseVersion("1.25") === parseVersion("1.25")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getRemovedAPIs
// ---------------------------------------------------------------------------
describe("getRemovedAPIs", () => {
  it("returns Ingress extensions/v1beta1 as removed in 1.22", () => {
    const removed = getRemovedAPIs("1.22");
    const entry = removed.find(
      (a) => a.apiVersion === "extensions/v1beta1" && a.kind === "Ingress"
    );
    expect(entry).toBeDefined();
    expect(entry?.replacement).toBe("networking.k8s.io/v1");
  });

  it("does not include Ingress extensions/v1beta1 as removed in 1.21", () => {
    const removed = getRemovedAPIs("1.21");
    const entry = removed.find(
      (a) => a.apiVersion === "extensions/v1beta1" && a.kind === "Ingress"
    );
    expect(entry).toBeUndefined();
  });

  it("includes apps/v1beta1 Deployment as removed in 1.16", () => {
    const removed = getRemovedAPIs("1.16");
    const entry = removed.find(
      (a) => a.apiVersion === "apps/v1beta1" && a.kind === "Deployment"
    );
    expect(entry).toBeDefined();
  });

  it("includes PodSecurityPolicy as removed in 1.25", () => {
    const removed = getRemovedAPIs("1.25");
    const entry = removed.find(
      (a) => a.kind === "PodSecurityPolicy"
    );
    expect(entry).toBeDefined();
  });

  it("includes CronJob batch/v1beta1 as removed in 1.25", () => {
    const removed = getRemovedAPIs("1.25");
    const entry = removed.find(
      (a) => a.apiVersion === "batch/v1beta1" && a.kind === "CronJob"
    );
    expect(entry).toBeDefined();
    expect(entry?.replacement).toBe("batch/v1");
  });
});

// ---------------------------------------------------------------------------
// getDeprecatedAPIs
// ---------------------------------------------------------------------------
describe("getDeprecatedAPIs", () => {
  it("returns networking.k8s.io/v1beta1 Ingress as deprecated in 1.19 but not yet removed", () => {
    const deprecated = getDeprecatedAPIs("1.19");
    const entry = deprecated.find(
      (a) => a.apiVersion === "networking.k8s.io/v1beta1" && a.kind === "Ingress"
    );
    expect(entry).toBeDefined();
  });

  it("does NOT include networking.k8s.io/v1beta1 Ingress as deprecated after removal (1.22)", () => {
    // It was removed in 1.22, so after that it's not "deprecated" anymore in our schema
    const deprecated = getDeprecatedAPIs("1.22");
    const entry = deprecated.find(
      (a) => a.apiVersion === "networking.k8s.io/v1beta1" && a.kind === "Ingress"
    );
    expect(entry).toBeUndefined();
  });

  it("returns CronJob batch/v1beta1 as deprecated in 1.21 before removal", () => {
    const deprecated = getDeprecatedAPIs("1.21");
    const entry = deprecated.find(
      (a) => a.apiVersion === "batch/v1beta1" && a.kind === "CronJob"
    );
    expect(entry).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// getRulesToSkip
// ---------------------------------------------------------------------------
describe("getRulesToSkip", () => {
  it("returns empty set when no rules are version-gated", () => {
    // RULE_MIN_VERSION is currently empty, so skip set should always be empty
    const skip = getRulesToSkip("1.20");
    expect(skip.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkAPIVersion
// ---------------------------------------------------------------------------
describe("checkAPIVersion", () => {
  it("returns removed for extensions/v1beta1 Ingress on K8s 1.22", () => {
    const result = checkAPIVersion("extensions/v1beta1", "Ingress", "1.22");
    expect(result).toBeDefined();
    expect(result?.status).toBe("removed");
    expect(result?.replacement).toBe("networking.k8s.io/v1");
    expect(result?.since).toBe("1.22");
  });

  it("returns deprecated for networking.k8s.io/v1beta1 Ingress on K8s 1.19", () => {
    const result = checkAPIVersion("networking.k8s.io/v1beta1", "Ingress", "1.19");
    expect(result).toBeDefined();
    expect(result?.status).toBe("deprecated");
    expect(result?.since).toBe("1.19");
  });

  it("returns undefined for current API (apps/v1 Deployment)", () => {
    const result = checkAPIVersion("apps/v1", "Deployment", "1.28");
    expect(result).toBeUndefined();
  });

  it("returns undefined for extensions/v1beta1 Ingress on K8s 1.13 (before deprecation)", () => {
    // extensions/v1beta1 Ingress was deprecated in 1.14
    const result = checkAPIVersion("extensions/v1beta1", "Ingress", "1.13");
    expect(result).toBeUndefined();
  });

  it("returns removed for apps/v1beta1 Deployment on K8s 1.16", () => {
    const result = checkAPIVersion("apps/v1beta1", "Deployment", "1.16");
    expect(result).toBeDefined();
    expect(result?.status).toBe("removed");
  });

  it("covers all DEPRECATED_APIS entries (no duplicate apiVersion+kind)", () => {
    const seen = new Set<string>();
    for (const entry of DEPRECATED_APIS) {
      const key = `${entry.apiVersion}|${entry.kind}`;
      expect(seen.has(key), `Duplicate entry: ${key}`).toBe(false);
      seen.add(key);
    }
  });
});
