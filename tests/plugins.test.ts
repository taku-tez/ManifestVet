import { describe, it, expect } from "vitest";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { loadPlugin } from "../src/plugins";

function writeTmpPlugin(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-plugin-"));
  const p = path.join(dir, "plugin.js");
  fs.writeFileSync(p, content);
  return p;
}

describe("loadPlugin", () => {
  it("loads a valid plugin and returns its rules", () => {
    const pluginPath = writeTmpPlugin(`
module.exports = {
  name: "test-plugin",
  rules: [{
    id: "TEST001",
    severity: "warning",
    description: "Test rule",
    check() { return []; },
  }],
};
`);
    const rules = loadPlugin(pluginPath);
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("TEST001");
    expect(rules[0].severity).toBe("warning");
  });

  it("rule check function works correctly", () => {
    const pluginPath = writeTmpPlugin(`
module.exports = {
  rules: [{
    id: "TEST002",
    severity: "error",
    description: "Deployment must not be in default namespace",
    check({ resource }) {
      if (resource.kind === "Deployment" && resource.metadata.namespace === "default") {
        return [{
          rule: "TEST002",
          severity: "error",
          message: "Deployment must not be in default namespace",
          resource: resource.kind + "/" + resource.metadata.name,
        }];
      }
      return [];
    },
  }],
};
`);
    const rules = loadPlugin(pluginPath);
    const results = rules[0].check({
      resource: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: { name: "app", namespace: "default" },
      },
      allResources: [],
    });
    expect(results).toHaveLength(1);
    expect(results[0].rule).toBe("TEST002");
  });

  it("throws for missing rules export", () => {
    const pluginPath = writeTmpPlugin(`module.exports = { name: "bad" };`);
    expect(() => loadPlugin(pluginPath)).toThrow("rules");
  });

  it("throws for non-array rules", () => {
    const pluginPath = writeTmpPlugin(`module.exports = { rules: "not-an-array" };`);
    expect(() => loadPlugin(pluginPath)).toThrow("rules");
  });

  it("throws for rule without id", () => {
    const pluginPath = writeTmpPlugin(`
module.exports = {
  rules: [{ severity: "warning", check() { return []; } }],
};
`);
    expect(() => loadPlugin(pluginPath)).toThrow("id");
  });

  it("throws for rule without check function", () => {
    const pluginPath = writeTmpPlugin(`
module.exports = {
  rules: [{ id: "TEST003", severity: "warning" }],
};
`);
    expect(() => loadPlugin(pluginPath)).toThrow("check");
  });

  it("throws for nonexistent file", () => {
    expect(() => loadPlugin("/nonexistent/plugin.js")).toThrow();
  });
});
