import { describe, it, expect } from "vitest";
import { parseInterval } from "../src/watch";

describe("parseInterval", () => {
  it("parses seconds", () => {
    expect(parseInterval("30s")).toBe(30_000);
    expect(parseInterval("1s")).toBe(1_000);
    expect(parseInterval("60s")).toBe(60_000);
  });

  it("parses minutes", () => {
    expect(parseInterval("5m")).toBe(300_000);
    expect(parseInterval("1m")).toBe(60_000);
    expect(parseInterval("10m")).toBe(600_000);
  });

  it("parses hours", () => {
    expect(parseInterval("1h")).toBe(3_600_000);
    expect(parseInterval("2h")).toBe(7_200_000);
  });

  it("trims whitespace", () => {
    expect(parseInterval("  5m  ")).toBe(300_000);
  });

  it("throws on invalid format", () => {
    expect(() => parseInterval("5")).toThrow(/Invalid interval/);
    expect(() => parseInterval("5d")).toThrow(/Invalid interval/);
    expect(() => parseInterval("abc")).toThrow(/Invalid interval/);
    expect(() => parseInterval("")).toThrow(/Invalid interval/);
  });
});
