import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { saveBaseline, loadBaseline, diffBaseline, fixedSinceBaseline } from "../src/baseline";
import { Violation } from "../src/rules/types";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-baseline-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function v(rule: string, resource = "Deployment/app", message = "test"): Violation {
  return { rule, severity: "error", message, resource };
}

describe("saveBaseline / loadBaseline", () => {
  it("saves and loads violations round-trip", () => {
    const violations = [v("MV1001"), v("MV4001", "Deployment/web", "latest tag")];
    const p = path.join(tmpDir, "baseline.json");
    saveBaseline(violations, p);
    const loaded = loadBaseline(p);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].rule).toBe("MV1001");
    expect(loaded[1].rule).toBe("MV4001");
  });

  it("returns empty array when baseline file does not exist", () => {
    const loaded = loadBaseline(path.join(tmpDir, "nonexistent.json"));
    expect(loaded).toEqual([]);
  });

  it("returns empty array for corrupt baseline file", () => {
    const p = path.join(tmpDir, "bad.json");
    fs.writeFileSync(p, "not json");
    const loaded = loadBaseline(p);
    expect(loaded).toEqual([]);
  });
});

describe("diffBaseline", () => {
  it("returns only new violations not in baseline", () => {
    const baseline = [v("MV1001"), v("MV4001")];
    const current = [v("MV1001"), v("MV4001"), v("MV1002")];
    const diff = diffBaseline(current, baseline);
    expect(diff).toHaveLength(1);
    expect(diff[0].rule).toBe("MV1002");
  });

  it("returns all current violations when baseline is empty", () => {
    const current = [v("MV1001"), v("MV4001")];
    const diff = diffBaseline(current, []);
    expect(diff).toHaveLength(2);
  });

  it("returns empty when all violations are in baseline", () => {
    const violations = [v("MV1001"), v("MV4001")];
    const diff = diffBaseline(violations, violations);
    expect(diff).toHaveLength(0);
  });

  it("distinguishes violations by resource", () => {
    const baseline = [v("MV1001", "Deployment/app-a")];
    const current = [v("MV1001", "Deployment/app-a"), v("MV1001", "Deployment/app-b")];
    const diff = diffBaseline(current, baseline);
    expect(diff).toHaveLength(1);
    expect(diff[0].resource).toBe("Deployment/app-b");
  });

  it("distinguishes violations by message", () => {
    const baseline = [v("MV1001", "Deployment/app", "message A")];
    const current = [v("MV1001", "Deployment/app", "message A"), v("MV1001", "Deployment/app", "message B")];
    const diff = diffBaseline(current, baseline);
    expect(diff).toHaveLength(1);
    expect(diff[0].message).toBe("message B");
  });
});

describe("fixedSinceBaseline", () => {
  it("returns violations present in baseline but not in current", () => {
    const baseline = [v("MV1001"), v("MV4001")];
    const current = [v("MV4001")];
    const fixed = fixedSinceBaseline(current, baseline);
    expect(fixed).toHaveLength(1);
    expect(fixed[0].rule).toBe("MV1001");
  });

  it("returns empty when no violations were fixed", () => {
    const violations = [v("MV1001")];
    const fixed = fixedSinceBaseline(violations, violations);
    expect(fixed).toHaveLength(0);
  });

  it("returns all baseline violations when current is empty", () => {
    const baseline = [v("MV1001"), v("MV4001")];
    const fixed = fixedSinceBaseline([], baseline);
    expect(fixed).toHaveLength(2);
  });
});
