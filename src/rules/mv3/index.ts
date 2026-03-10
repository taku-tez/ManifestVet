import { Rule, RuleContext, Violation } from "../types";

// ---------------------------------------------------------------------------
// Pod-bearing resource kinds
// ---------------------------------------------------------------------------
const POD_BEARING_KINDS = [
  "Pod",
  "Deployment",
  "StatefulSet",
  "DaemonSet",
  "ReplicaSet",
  "Job",
  "CronJob",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPodBearing(resource: RuleContext["resource"]): boolean {
  return POD_BEARING_KINDS.includes(resource.kind as string);
}

/**
 * Returns the pod-level spec for a resource.
 *   Pod        -> spec
 *   All others -> spec.template.spec
 */
function getPodSpec(resource: RuleContext["resource"]): any | undefined {
  if (!resource.spec) return undefined;
  if (resource.kind === "Pod") {
    return resource.spec;
  }
  return resource.spec?.template?.spec;
}

interface ContainerInfo {
  container: any;
  index: number;
  prefix: string;
}

/**
 * Extracts all containers (regular + init) from pod-bearing resources.
 * Returns an array of { container, index, prefix } where prefix is
 * "containers" or "initContainers".
 */
function getContainers(resource: RuleContext["resource"]): ContainerInfo[] {
  const podSpec = getPodSpec(resource);
  if (!podSpec) return [];

  const result: ContainerInfo[] = [];

  const containers: any[] = podSpec.containers ?? [];
  containers.forEach((c: any, i: number) => {
    result.push({ container: c, index: i, prefix: "containers" });
  });

  const initContainers: any[] = podSpec.initContainers ?? [];
  initContainers.forEach((c: any, i: number) => {
    result.push({ container: c, index: i, prefix: "initContainers" });
  });

  return result;
}

/**
 * Build the dotted path to a container inside the manifest.
 *   Pod        -> spec.<prefix>[<index>]
 *   All others -> spec.template.spec.<prefix>[<index>]
 */
function containerPath(
  resource: RuleContext["resource"],
  prefix: string,
  index: number,
  suffix?: string,
): string {
  const base =
    resource.kind === "Pod"
      ? `spec.${prefix}[${index}]`
      : `spec.template.spec.${prefix}[${index}]`;
  return suffix ? `${base}.${suffix}` : base;
}

/**
 * Build the dotted path to the pod spec level.
 */
function podSpecPath(resource: RuleContext["resource"], suffix?: string): string {
  const base = resource.kind === "Pod" ? "spec" : "spec.template.spec";
  return suffix ? `${base}.${suffix}` : base;
}

// ---------------------------------------------------------------------------
// MV3001 - Service type NodePort
// ---------------------------------------------------------------------------
const mv3001: Rule = {
  id: "MV3001",
  severity: "warning",
  description:
    "Service should not use type NodePort. NodePort exposes the service on each node's IP at a static port, widening the attack surface.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Service") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;

    if (resource.spec?.type === "NodePort") {
      return [
        {
          rule: "MV3001",
          severity: "warning",
          message: `${resourceId} uses Service type NodePort, which exposes the service on every node's IP.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.type",
          fix: "Use ClusterIP or LoadBalancer instead of NodePort where possible.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV3002 - hostPort set in container ports
// ---------------------------------------------------------------------------
const mv3002: Rule = {
  id: "MV3002",
  severity: "warning",
  description:
    "Containers should not set hostPort. Using hostPort binds the container port directly to the host, limiting scheduling and expanding attack surface.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const ports: any[] = container.ports ?? [];
      for (let p = 0; p < ports.length; p++) {
        if (ports[p].hostPort) {
          violations.push({
            rule: "MV3002",
            severity: "warning",
            message: `Container "${container.name ?? index}" sets hostPort ${ports[p].hostPort} in ports[${p}].`,
            resource: resourceId,
            namespace: resource.metadata.namespace,
            path: containerPath(resource, prefix, index, `ports[${p}].hostPort`),
            fix: "Remove hostPort from the container port definition. Use a Service to expose the port instead.",
          });
        }
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV3003 - NetworkPolicy allows all ingress
// ---------------------------------------------------------------------------
const mv3003: Rule = {
  id: "MV3003",
  severity: "error",
  description:
    "NetworkPolicy should not allow all ingress traffic. An ingress rule with an empty from array or from containing an empty object permits traffic from any source.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "NetworkPolicy") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const ingressRules: any[] = resource.spec?.ingress ?? [];

    for (let i = 0; i < ingressRules.length; i++) {
      const rule = ingressRules[i];
      const from: any[] | undefined = rule.from;

      if (from === undefined) {
        // No from field at all - this is not the same as empty from; skip.
        continue;
      }

      // Empty from array means allow all sources
      if (Array.isArray(from) && from.length === 0) {
        violations.push({
          rule: "MV3003",
          severity: "error",
          message: `${resourceId} allows all ingress traffic in spec.ingress[${i}] (from is an empty array).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `spec.ingress[${i}].from`,
          fix: "Specify explicit ingress sources in the from array or remove the ingress rule.",
        });
        continue;
      }

      // from contains an empty object {} which matches all sources
      if (Array.isArray(from) && from.some((entry: any) => typeof entry === "object" && entry !== null && Object.keys(entry).length === 0)) {
        violations.push({
          rule: "MV3003",
          severity: "error",
          message: `${resourceId} allows all ingress traffic in spec.ingress[${i}] (from contains an empty object).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `spec.ingress[${i}].from`,
          fix: "Replace the empty object in from with explicit source selectors (podSelector, namespaceSelector, ipBlock).",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV3004 - NetworkPolicy allows all egress
// ---------------------------------------------------------------------------
const mv3004: Rule = {
  id: "MV3004",
  severity: "error",
  description:
    "NetworkPolicy should not allow all egress traffic. An egress rule with an empty to array or to containing an empty object permits traffic to any destination.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "NetworkPolicy") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const egressRules: any[] = resource.spec?.egress ?? [];

    for (let i = 0; i < egressRules.length; i++) {
      const rule = egressRules[i];
      const to: any[] | undefined = rule.to;

      if (to === undefined) {
        continue;
      }

      // Empty to array means allow all destinations
      if (Array.isArray(to) && to.length === 0) {
        violations.push({
          rule: "MV3004",
          severity: "error",
          message: `${resourceId} allows all egress traffic in spec.egress[${i}] (to is an empty array).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `spec.egress[${i}].to`,
          fix: "Specify explicit egress destinations in the to array or remove the egress rule.",
        });
        continue;
      }

      // to contains an empty object {} which matches all destinations
      if (Array.isArray(to) && to.some((entry: any) => typeof entry === "object" && entry !== null && Object.keys(entry).length === 0)) {
        violations.push({
          rule: "MV3004",
          severity: "error",
          message: `${resourceId} allows all egress traffic in spec.egress[${i}] (to contains an empty object).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `spec.egress[${i}].to`,
          fix: "Replace the empty object in to with explicit destination selectors (podSelector, namespaceSelector, ipBlock).",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV3005 - Service type LoadBalancer without externalTrafficPolicy: Local
// ---------------------------------------------------------------------------
const mv3005: Rule = {
  id: "MV3005",
  severity: "info",
  description:
    'Service of type LoadBalancer should set externalTrafficPolicy to "Local" to preserve client source IPs and avoid extra network hops.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Service") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;

    if (
      resource.spec?.type === "LoadBalancer" &&
      resource.spec?.externalTrafficPolicy !== "Local"
    ) {
      return [
        {
          rule: "MV3005",
          severity: "info",
          message: `${resourceId} is a LoadBalancer service without externalTrafficPolicy set to "Local".`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.externalTrafficPolicy",
          fix: 'Set spec.externalTrafficPolicy to "Local" to preserve client source IPs.',
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV3006 - Pod with hostAliases
// ---------------------------------------------------------------------------
const mv3006: Rule = {
  id: "MV3006",
  severity: "info",
  description:
    "Pod should not use hostAliases. hostAliases modify the pod's /etc/hosts file which can be used to redirect traffic or bypass DNS.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    const hostAliases: any[] = podSpec?.hostAliases ?? [];

    if (hostAliases.length > 0) {
      const resourceId = `${resource.kind}/${resource.metadata.name}`;
      return [
        {
          rule: "MV3006",
          severity: "info",
          message: `${resourceId} defines hostAliases, which modifies the pod's /etc/hosts file.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "hostAliases"),
          fix: "Remove hostAliases and use DNS or a Service to resolve hostnames instead.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV3007 - Ingress without TLS configured
// ---------------------------------------------------------------------------
const mv3007: Rule = {
  id: "MV3007",
  severity: "warning",
  description:
    "Ingress should have TLS configured to ensure encrypted traffic.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "Ingress") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const tls: any[] | undefined = resource.spec?.tls;

    if (!tls || (Array.isArray(tls) && tls.length === 0)) {
      return [
        {
          rule: "MV3007",
          severity: "warning",
          message: `${resourceId} does not have TLS configured.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "spec.tls",
          fix: "Add a spec.tls section with a valid secret reference and hosts to enable HTTPS.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// Export all MV3 rules
// ---------------------------------------------------------------------------
export const mv3Rules: Rule[] = [
  mv3001,
  mv3002,
  mv3003,
  mv3004,
  mv3005,
  mv3006,
  mv3007,
];
