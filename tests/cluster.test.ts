import { describe, it, expect, vi, beforeEach } from "vitest";

// Test cluster option building logic without running kubectl
describe("Cluster kubectl args builder", () => {
  interface ClusterOptions {
    context?: string;
    namespace?: string;
    allNamespaces?: boolean;
  }

  function buildArgs(baseArgs: string[], opts: ClusterOptions): string[] {
    const args = [...baseArgs];
    if (opts.context) {
      args.push("--context", opts.context);
    }
    if (opts.allNamespaces) {
      args.push("--all-namespaces");
    } else if (opts.namespace) {
      args.push("-n", opts.namespace);
    }
    return args;
  }

  it("builds args with no options", () => {
    const args = buildArgs(["get", "Deployment", "-o", "yaml"], {});
    expect(args).toEqual(["get", "Deployment", "-o", "yaml"]);
  });

  it("adds --context flag", () => {
    const args = buildArgs(["get", "Deployment", "-o", "yaml"], {
      context: "production",
    });
    expect(args).toContain("--context");
    expect(args).toContain("production");
  });

  it("adds -n flag for namespace", () => {
    const args = buildArgs(["get", "Deployment", "-o", "yaml"], {
      namespace: "my-ns",
    });
    expect(args).toContain("-n");
    expect(args).toContain("my-ns");
  });

  it("adds --all-namespaces flag", () => {
    const args = buildArgs(["get", "Deployment", "-o", "yaml"], {
      allNamespaces: true,
    });
    expect(args).toContain("--all-namespaces");
  });

  it("prefers allNamespaces over namespace when both set", () => {
    const args = buildArgs(["get", "Deployment", "-o", "yaml"], {
      namespace: "my-ns",
      allNamespaces: true,
    });
    expect(args).toContain("--all-namespaces");
    expect(args).not.toContain("-n");
  });

  it("builds args with context and namespace", () => {
    const args = buildArgs(["get", "Deployment", "-o", "yaml"], {
      context: "staging",
      namespace: "app",
    });
    expect(args).toContain("--context");
    expect(args).toContain("staging");
    expect(args).toContain("-n");
    expect(args).toContain("app");
  });
});

describe("Cluster label generation", () => {
  interface ClusterOptions {
    context?: string;
    namespace?: string;
    allNamespaces?: boolean;
  }

  function getLabels(
    opts: ClusterOptions
  ): { clusterLabel: string; nsLabel: string } {
    return {
      clusterLabel: opts.context ?? "current-context",
      nsLabel: opts.allNamespaces
        ? "all-namespaces"
        : opts.namespace ?? "default",
    };
  }

  it("uses current-context as default cluster label", () => {
    const { clusterLabel } = getLabels({});
    expect(clusterLabel).toBe("current-context");
  });

  it("uses provided context name", () => {
    const { clusterLabel } = getLabels({ context: "prod" });
    expect(clusterLabel).toBe("prod");
  });

  it("uses all-namespaces label", () => {
    const { nsLabel } = getLabels({ allNamespaces: true });
    expect(nsLabel).toBe("all-namespaces");
  });

  it("uses provided namespace", () => {
    const { nsLabel } = getLabels({ namespace: "kube-system" });
    expect(nsLabel).toBe("kube-system");
  });

  it("uses default namespace when none specified", () => {
    const { nsLabel } = getLabels({});
    expect(nsLabel).toBe("default");
  });
});
