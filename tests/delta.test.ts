import { describe, it, expect } from "vitest";
import { computeDelta } from "../src/delta";
import { Violation } from "../src/rules/types";

function v(rule: string, resource: string, message: string, severity: Violation["severity"] = "high"): Violation {
  return { rule, resource, message, severity };
}

describe("computeDelta", () => {
  it("returns all cluster violations when no local violations", () => {
    const cluster = [v("MV1001", "Deployment/nginx", "runAsNonRoot not set")];
    const result = computeDelta(cluster, []);
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("MV1001");
  });

  it("returns empty when cluster and local have same violations", () => {
    const shared = v("MV1001", "Deployment/nginx", "runAsNonRoot not set");
    const result = computeDelta([shared], [shared]);
    expect(result).toHaveLength(0);
  });

  it("returns only violations in cluster but not local", () => {
    const inBoth = v("MV1001", "Deployment/nginx", "runAsNonRoot not set");
    const onlyCluster = v("MV4001", "Deployment/nginx", "image tag is latest");
    const result = computeDelta([inBoth, onlyCluster], [inBoth]);
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("MV4001");
  });

  it("does not return violations only in local", () => {
    const onlyLocal = v("MV1001", "Deployment/nginx", "runAsNonRoot not set");
    const result = computeDelta([], [onlyLocal]);
    expect(result).toHaveLength(0);
  });

  it("matches violations by rule+resource+message fingerprint", () => {
    const clusterV = v("MV1001", "Deployment/app", "runAsNonRoot not set");
    const localV = v("MV1001", "Deployment/other", "runAsNonRoot not set");
    // Same rule+message but different resource — not a match
    const result = computeDelta([clusterV], [localV]);
    expect(result).toHaveLength(1);
  });

  it("handles multiple violations correctly", () => {
    const cluster = [
      v("MV1001", "Deployment/a", "runAsNonRoot not set"),
      v("MV1002", "Deployment/a", "allowPrivilegeEscalation"),
      v("MV4001", "Deployment/b", "latest tag"),
    ];
    const local = [
      v("MV1001", "Deployment/a", "runAsNonRoot not set"),
      v("MV4001", "Deployment/b", "latest tag"),
    ];
    const result = computeDelta(cluster, local);
    expect(result).toHaveLength(1);
    expect(result[0].rule).toBe("MV1002");
  });
});
