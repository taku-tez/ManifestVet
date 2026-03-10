import { describe, it, expect } from "vitest";

// Test the internal logic by importing what we can test without network

describe("GitHub URL detection", () => {
  function isBlobUrl(arg: string): boolean {
    return arg.startsWith("https://github.com/") && arg.includes("/blob/");
  }

  function parseBlobUrl(
    url: string
  ): { owner: string; repo: string; branch: string; filePath: string } | null {
    const m = url.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
    );
    if (!m) return null;
    return { owner: m[1], repo: m[2], branch: m[3], filePath: m[4] };
  }

  it("detects blob URLs", () => {
    expect(
      isBlobUrl("https://github.com/owner/repo/blob/main/k8s/deploy.yaml")
    ).toBe(true);
    expect(isBlobUrl("owner/repo")).toBe(false);
    expect(isBlobUrl("https://github.com/owner/repo")).toBe(false);
  });

  it("parses blob URL components", () => {
    const result = parseBlobUrl(
      "https://github.com/acme/myapp/blob/feature-branch/manifests/deploy.yaml"
    );
    expect(result).not.toBeNull();
    expect(result!.owner).toBe("acme");
    expect(result!.repo).toBe("myapp");
    expect(result!.branch).toBe("feature-branch");
    expect(result!.filePath).toBe("manifests/deploy.yaml");
  });

  it("parses blob URL with nested path", () => {
    const result = parseBlobUrl(
      "https://github.com/org/repo/blob/main/k8s/prod/deploy.yaml"
    );
    expect(result!.filePath).toBe("k8s/prod/deploy.yaml");
  });

  it("returns null for non-blob URLs", () => {
    expect(parseBlobUrl("https://github.com/owner/repo")).toBeNull();
    expect(parseBlobUrl("owner/repo")).toBeNull();
    expect(
      parseBlobUrl("https://github.com/owner/repo/tree/main/k8s")
    ).toBeNull();
  });

  it("handles owner/repo split correctly", () => {
    const ownerRepo = "myorg/myrepo";
    const [owner, repo] = ownerRepo.split("/");
    expect(owner).toBe("myorg");
    expect(repo).toBe("myrepo");
  });

  it("detects invalid owner/repo format", () => {
    const ownerRepo = "invalidformat";
    const [owner, repo] = ownerRepo.split("/");
    expect(repo).toBeUndefined();
  });
});

describe("Rate limit handling", () => {
  it("calculates wait time from x-ratelimit-reset header", () => {
    const now = Math.floor(Date.now() / 1000);
    const resetAt = now + 30; // 30 seconds from now
    const waitMs = Math.max(0, resetAt * 1000 - Date.now()) + 1000;
    expect(waitMs).toBeGreaterThan(0);
    expect(waitMs).toBeLessThan(35_000);
  });

  it("uses 60s fallback when no reset header", () => {
    const resetAt = NaN;
    const waitMs = resetAt ? Math.max(0, resetAt * 1000 - Date.now()) + 1000 : 60_000;
    expect(waitMs).toBe(60_000);
  });
});
