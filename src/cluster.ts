import { spawnSync } from "child_process";

export interface ClusterOptions {
  context?: string;
  namespace?: string;
  allNamespaces?: boolean;
}

const WORKLOAD_KINDS = [
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "Job",
  "CronJob",
  "Pod",
  "Service",
  "ServiceAccount",
  "Role",
  "ClusterRole",
  "RoleBinding",
  "ClusterRoleBinding",
  "NetworkPolicy",
  "ConfigMap",
  "Secret",
  "Ingress",
  "Namespace",
  "PersistentVolumeClaim",
];

function kubectl(args: string[]): string {
  const result = spawnSync("kubectl", args, { encoding: "utf-8" });
  if (result.error) {
    throw new Error(`kubectl not found: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const msg = result.stderr?.trim() || `kubectl exited with code ${result.status}`;
    throw new Error(msg);
  }
  return result.stdout;
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

export async function fetchManifestsFromCluster(
  opts: ClusterOptions
): Promise<{ path: string; content: string }[]> {
  const results: { path: string; content: string }[] = [];

  const clusterLabel = opts.context ?? "current-context";
  const nsLabel = opts.allNamespaces
    ? "all-namespaces"
    : opts.namespace ?? "default";

  // Fetch namespace-scoped kinds
  const namespacedKinds = WORKLOAD_KINDS.filter(
    (k) =>
      !["ClusterRole", "ClusterRoleBinding", "Namespace"].includes(k)
  );

  // Fetch cluster-scoped kinds (no namespace flags)
  const clusterScopedKinds = ["ClusterRole", "ClusterRoleBinding", "Namespace"];

  for (const kind of namespacedKinds) {
    try {
      const args = buildArgs(
        ["get", kind, "-o", "yaml", "--ignore-not-found"],
        opts
      );
      const content = kubectl(args);
      if (content && content.trim() && content.trim() !== "{}") {
        results.push({
          path: `cluster://${clusterLabel}/${nsLabel}/${kind}`,
          content,
        });
      }
    } catch (err) {
      // Some kinds may not exist in this cluster version; continue
    }
  }

  for (const kind of clusterScopedKinds) {
    try {
      const args: string[] = ["get", kind, "-o", "yaml", "--ignore-not-found"];
      if (opts.context) {
        args.push("--context", opts.context);
      }
      const content = kubectl(args);
      if (content && content.trim() && content.trim() !== "{}") {
        results.push({
          path: `cluster://${clusterLabel}/${kind}`,
          content,
        });
      }
    } catch (err) {
      // continue
    }
  }

  return results;
}
