import { describe, it, expect } from "vitest";

// Test the AdmissionReview protocol shapes without starting a server
describe("AdmissionReview protocol", () => {
  interface AdmissionResponse {
    apiVersion: string;
    kind: string;
    response: {
      uid: string;
      allowed: boolean;
      status?: { code: number; message: string };
      warnings?: string[];
    };
  }

  function buildResponse(uid: string, allowed: boolean, message?: string): AdmissionResponse {
    const r: AdmissionResponse = {
      apiVersion: "admission.k8s.io/v1",
      kind: "AdmissionReview",
      response: { uid, allowed },
    };
    if (!allowed && message) {
      r.response.status = { code: 403, message };
    }
    return r;
  }

  it("builds an allowed response", () => {
    const r = buildResponse("abc-123", true);
    expect(r.response.allowed).toBe(true);
    expect(r.response.uid).toBe("abc-123");
    expect(r.response.status).toBeUndefined();
  });

  it("builds a denied response with status", () => {
    const r = buildResponse("abc-456", false, "MV1001: runAsNonRoot not set");
    expect(r.response.allowed).toBe(false);
    expect(r.response.status?.code).toBe(403);
    expect(r.response.status?.message).toContain("MV1001");
  });

  it("preserves uid from request", () => {
    const uid = "test-uid-xyz";
    const r = buildResponse(uid, true);
    expect(r.response.uid).toBe(uid);
  });
});

describe("Webhook resource parsing", () => {
  interface K8sResourceLike {
    apiVersion: string;
    kind: string;
    metadata?: { name?: string; namespace?: string };
  }

  function isValidResource(obj: any): obj is K8sResourceLike {
    return obj && typeof obj.apiVersion === "string" && typeof obj.kind === "string";
  }

  it("validates a well-formed resource", () => {
    const obj = { apiVersion: "apps/v1", kind: "Deployment", metadata: { name: "app" } };
    expect(isValidResource(obj)).toBe(true);
  });

  it("rejects resource without apiVersion", () => {
    const obj = { kind: "Deployment", metadata: { name: "app" } };
    expect(isValidResource(obj)).toBe(false);
  });

  it("rejects resource without kind", () => {
    const obj = { apiVersion: "apps/v1", metadata: { name: "app" } };
    expect(isValidResource(obj)).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isValidResource(null)).toBeFalsy();
    expect(isValidResource(undefined)).toBeFalsy();
  });
});
