import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { insertIgnoreComment } from "../src/interactive";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mv-interactive-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// insertIgnoreComment
// ---------------------------------------------------------------------------
describe("insertIgnoreComment", () => {
  it("inserts ignore comment at the top of a single-document file when resource found", () => {
    const filePath = path.join(tmpDir, "test.yaml");
    fs.writeFileSync(
      filePath,
      `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: app
      image: nginx:latest
`
    );

    insertIgnoreComment(filePath, "MV4001", "my-pod");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("# manifestvet-ignore: MV4001");
  });

  it("inserts comment before the correct document in multi-doc file", () => {
    const filePath = path.join(tmpDir, "multi.yaml");
    fs.writeFileSync(
      filePath,
      `apiVersion: v1
kind: ConfigMap
metadata:
  name: first-resource
data:
  key: value
---
apiVersion: v1
kind: Pod
metadata:
  name: target-pod
spec:
  containers:
    - name: app
      image: nginx:latest
`
    );

    insertIgnoreComment(filePath, "MV4001", "target-pod");
    const content = fs.readFileSync(filePath, "utf-8");

    // Comment should appear before target-pod's document, not at file start
    const commentIndex = content.indexOf("# manifestvet-ignore: MV4001");
    const configMapIndex = content.indexOf("name: first-resource");
    expect(commentIndex).toBeGreaterThan(configMapIndex);
  });

  it("inserts comment at start of file when resource name not found", () => {
    const filePath = path.join(tmpDir, "notfound.yaml");
    fs.writeFileSync(
      filePath,
      `apiVersion: v1
kind: Pod
metadata:
  name: some-pod
spec:
  containers:
    - name: app
      image: nginx
`
    );

    insertIgnoreComment(filePath, "MV1001", "nonexistent");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content.startsWith("# manifestvet-ignore: MV1001\n")).toBe(true);
  });

  it("preserves original content after inserting comment", () => {
    const filePath = path.join(tmpDir, "preserve.yaml");
    const original = `apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  containers:
    - name: app
      image: nginx:1.25
`;
    fs.writeFileSync(filePath, original);

    insertIgnoreComment(filePath, "MV4002", "my-app");
    const content = fs.readFileSync(filePath, "utf-8");

    // Original content should still be present
    expect(content).toContain("kind: Pod");
    expect(content).toContain("name: my-app");
    expect(content).toContain("nginx:1.25");
  });
});
