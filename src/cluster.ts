import { spawnSync } from "child_process";
import * as yaml from "js-yaml";

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

/**
 * `kubectl get <kind> -o yaml` always returns a List object when fetching
 * multiple resources. Unwrap the items and return each as an individual
 * YAML document so the parser never sees a bare `kind: List` object.
 */
function unwrapList(raw: string, basePath: string): { path: string; content: string }[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}") return [];

  let parsed: unknown;
  try {
    parsed = yaml.load(trimmed);
  } catch {
    // Not valid YAML — return as-is and let the parser report the error
    return [{ path: basePath, content: raw }];
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as Record<string, unknown>).kind === "List"
  ) {
    const items = (parsed as Record<string, unknown>).items;
    if (!Array.isArray(items) || items.length === 0) return [];
    return items.map((item, i) => ({
      path: `${basePath}[${i}]`,
      content: yaml.dump(item),
    }));
  }

  return [{ path: basePath, content: raw }];
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
      const raw = kubectl(args);
      const basePath = `cluster://${clusterLabel}/${nsLabel}/${kind}`;
      results.push(...unwrapList(raw, basePath));
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
      const raw = kubectl(args);
      const basePath = `cluster://${clusterLabel}/${kind}`;
      results.push(...unwrapList(raw, basePath));
    } catch (err) {
      // continue
    }
  }

  return results;
}
