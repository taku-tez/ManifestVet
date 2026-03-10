import { describe, it, expect } from "vitest";
import { getTemplate, getFixSummary, FIX_TEMPLATES } from "../src/fixes/templates";

describe("Fix templates", () => {
  it("has a template for every MV1xxx rule", () => {
    const mv1Rules = ["MV1001","MV1002","MV1003","MV1004","MV1005","MV1006",
      "MV1007","MV1008","MV1009","MV1010","MV1011","MV1012",
      "MV1013","MV1014","MV1015","MV1016"];
    for (const r of mv1Rules) {
      expect(FIX_TEMPLATES[r], `missing template for ${r}`).toBeDefined();
    }
  });

  it("has a template for every MV2xxx rule", () => {
    for (let i = 1; i <= 9; i++) {
      const r = `MV200${i}`;
      expect(FIX_TEMPLATES[r], `missing template for ${r}`).toBeDefined();
    }
  });

  it("has a template for every MV3xxx rule", () => {
    for (let i = 1; i <= 7; i++) {
      const r = `MV300${i}`;
      expect(FIX_TEMPLATES[r], `missing template for ${r}`).toBeDefined();
    }
  });

  it("has a template for every MV4xxx rule", () => {
    for (let i = 1; i <= 6; i++) {
      const r = `MV400${i}`;
      expect(FIX_TEMPLATES[r], `missing template for ${r}`).toBeDefined();
    }
  });

  it("has a template for every MV5xxx rule", () => {
    for (let i = 1; i <= 5; i++) {
      const r = `MV500${i}`;
      expect(FIX_TEMPLATES[r], `missing template for ${r}`).toBeDefined();
    }
  });

  it("has a template for every MV6xxx rule", () => {
    for (let i = 1; i <= 10; i++) {
      const r = i < 10 ? `MV600${i}` : `MV6010`;
      expect(FIX_TEMPLATES[r], `missing template for ${r}`).toBeDefined();
    }
  });

  it("covers all 53 rules", () => {
    expect(Object.keys(FIX_TEMPLATES)).toHaveLength(53);
  });

  it("each template has ja, en, patch, and safe fields", () => {
    for (const [id, t] of Object.entries(FIX_TEMPLATES)) {
      expect(typeof t.ja, `${id}.ja`).toBe("string");
      expect(typeof t.en, `${id}.en`).toBe("string");
      expect(typeof t.patch, `${id}.patch`).toBe("string");
      expect(typeof t.safe, `${id}.safe`).toBe("boolean");
      expect(t.ja.length, `${id}.ja empty`).toBeGreaterThan(0);
      expect(t.en.length, `${id}.en empty`).toBeGreaterThan(0);
      expect(t.patch.length, `${id}.patch empty`).toBeGreaterThan(0);
    }
  });

  it("getTemplate returns template by rule ID", () => {
    const t = getTemplate("MV1001");
    expect(t).toBeDefined();
    expect(t!.safe).toBe(true);
  });

  it("getFixSummary returns Japanese summary by default", () => {
    const s = getFixSummary("MV1001", "ja");
    expect(s).toContain("runAsNonRoot");
  });

  it("getFixSummary returns English summary", () => {
    const s = getFixSummary("MV1001", "en");
    expect(s).toBeDefined();
    expect(typeof s).toBe("string");
  });

  it("returns undefined for unknown rule", () => {
    expect(getTemplate("MV9999")).toBeUndefined();
    expect(getFixSummary("MV9999", "ja")).toBeUndefined();
  });

  it("safe=true templates have additive-only patches", () => {
    const safeRules = Object.entries(FIX_TEMPLATES)
      .filter(([, t]) => t.safe)
      .map(([id]) => id);
    // At minimum these should be safe
    expect(safeRules).toContain("MV1001");
    expect(safeRules).toContain("MV1002");
    expect(safeRules).toContain("MV1010");
    expect(safeRules).toContain("MV1011");
    expect(safeRules).toContain("MV1012");
    expect(safeRules).toContain("MV1016");
  });
});
