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

const DANGEROUS_CAPABILITIES = [
  "NET_ADMIN",
  "SYS_ADMIN",
  "SYS_PTRACE",
  "SYS_MODULE",
  "DAC_OVERRIDE",
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
// MV1001 - runAsNonRoot not set to true
// ---------------------------------------------------------------------------
const mv1001: Rule = {
  id: "MV1001",
  severity: "error",
  description:
    "Containers should set securityContext.runAsNonRoot to true to prevent running as the root user.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const podSpec = getPodSpec(resource);
    const podLevelRunAsNonRoot = podSpec?.securityContext?.runAsNonRoot === true;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const containerRunAsNonRoot =
        container.securityContext?.runAsNonRoot === true;

      if (!containerRunAsNonRoot && !podLevelRunAsNonRoot) {
        violations.push({
          rule: "MV1001",
          severity: "error",
          message: `Container "${container.name ?? index}" does not set runAsNonRoot to true (neither at container nor pod level).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "securityContext.runAsNonRoot"),
          fix: "Set securityContext.runAsNonRoot to true on the container or pod spec.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1002 - allowPrivilegeEscalation not explicitly false
// ---------------------------------------------------------------------------
const mv1002: Rule = {
  id: "MV1002",
  severity: "error",
  description:
    "Containers should explicitly set allowPrivilegeEscalation to false. The default is true.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.securityContext?.allowPrivilegeEscalation !== false) {
        violations.push({
          rule: "MV1002",
          severity: "error",
          message: `Container "${container.name ?? index}" does not explicitly set allowPrivilegeEscalation to false.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(
            resource,
            prefix,
            index,
            "securityContext.allowPrivilegeEscalation",
          ),
          fix: "Set securityContext.allowPrivilegeEscalation to false.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1003 - privileged containers
// ---------------------------------------------------------------------------
const mv1003: Rule = {
  id: "MV1003",
  severity: "error",
  description: "Containers should not run in privileged mode.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.securityContext?.privileged === true) {
        violations.push({
          rule: "MV1003",
          severity: "error",
          message: `Container "${container.name ?? index}" is running in privileged mode.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(
            resource,
            prefix,
            index,
            "securityContext.privileged",
          ),
          fix: "Remove privileged: true or set it to false.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1004 - hostNetwork enabled
// ---------------------------------------------------------------------------
const mv1004: Rule = {
  id: "MV1004",
  severity: "warning",
  description: "Pod should not use the host network namespace.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (podSpec?.hostNetwork === true) {
      const resourceId = `${resource.kind}/${resource.metadata.name}`;
      return [
        {
          rule: "MV1004",
          severity: "warning",
          message: `${resourceId} has hostNetwork enabled.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "hostNetwork"),
          fix: "Remove hostNetwork or set it to false.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV1005 - hostPID enabled
// ---------------------------------------------------------------------------
const mv1005: Rule = {
  id: "MV1005",
  severity: "warning",
  description: "Pod should not use the host PID namespace.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (podSpec?.hostPID === true) {
      const resourceId = `${resource.kind}/${resource.metadata.name}`;
      return [
        {
          rule: "MV1005",
          severity: "warning",
          message: `${resourceId} has hostPID enabled.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "hostPID"),
          fix: "Remove hostPID or set it to false.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV1006 - hostIPC enabled
// ---------------------------------------------------------------------------
const mv1006: Rule = {
  id: "MV1006",
  severity: "warning",
  description: "Pod should not use the host IPC namespace.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (podSpec?.hostIPC === true) {
      const resourceId = `${resource.kind}/${resource.metadata.name}`;
      return [
        {
          rule: "MV1006",
          severity: "warning",
          message: `${resourceId} has hostIPC enabled.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "hostIPC"),
          fix: "Remove hostIPC or set it to false.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV1007 - dangerous capabilities added
// ---------------------------------------------------------------------------
const mv1007: Rule = {
  id: "MV1007",
  severity: "error",
  description:
    "Containers should not add dangerous Linux capabilities (NET_ADMIN, SYS_ADMIN, SYS_PTRACE, SYS_MODULE, DAC_OVERRIDE).",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const added: string[] = container.securityContext?.capabilities?.add ?? [];
      for (const cap of added) {
        const upper = cap.toUpperCase();
        if (DANGEROUS_CAPABILITIES.includes(upper)) {
          violations.push({
            rule: "MV1007",
            severity: "error",
            message: `Container "${container.name ?? index}" adds dangerous capability "${upper}".`,
            resource: resourceId,
            namespace: resource.metadata.namespace,
            path: containerPath(
              resource,
              prefix,
              index,
              "securityContext.capabilities.add",
            ),
            fix: `Remove "${upper}" from capabilities.add.`,
          });
        }
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1008 - missing resource limits
// ---------------------------------------------------------------------------
const mv1008: Rule = {
  id: "MV1008",
  severity: "warning",
  description:
    "Containers should define resource limits for both CPU and memory.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const limits = container.resources?.limits;
      const missingCpu = !limits?.cpu;
      const missingMemory = !limits?.memory;

      if (missingCpu || missingMemory) {
        const missing: string[] = [];
        if (missingCpu) missing.push("cpu");
        if (missingMemory) missing.push("memory");

        violations.push({
          rule: "MV1008",
          severity: "warning",
          message: `Container "${container.name ?? index}" is missing resource limits for: ${missing.join(", ")}.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "resources.limits"),
          fix: `Set resources.limits.${missing.join(" and resources.limits.")}.`,
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1009 - missing resource requests
// ---------------------------------------------------------------------------
const mv1009: Rule = {
  id: "MV1009",
  severity: "info",
  description:
    "Containers should define resource requests for both CPU and memory.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const requests = container.resources?.requests;
      const missingCpu = !requests?.cpu;
      const missingMemory = !requests?.memory;

      if (missingCpu || missingMemory) {
        const missing: string[] = [];
        if (missingCpu) missing.push("cpu");
        if (missingMemory) missing.push("memory");

        violations.push({
          rule: "MV1009",
          severity: "info",
          message: `Container "${container.name ?? index}" is missing resource requests for: ${missing.join(", ")}.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, "resources.requests"),
          fix: `Set resources.requests.${missing.join(" and resources.requests.")}.`,
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1010 - readOnlyRootFilesystem not true
// ---------------------------------------------------------------------------
const mv1010: Rule = {
  id: "MV1010",
  severity: "warning",
  description:
    "Containers should set readOnlyRootFilesystem to true in securityContext.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.securityContext?.readOnlyRootFilesystem !== true) {
        violations.push({
          rule: "MV1010",
          severity: "warning",
          message: `Container "${container.name ?? index}" does not set readOnlyRootFilesystem to true.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(
            resource,
            prefix,
            index,
            "securityContext.readOnlyRootFilesystem",
          ),
          fix: "Set securityContext.readOnlyRootFilesystem to true.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1011 - default seccomp profile not set
// ---------------------------------------------------------------------------
const mv1011: Rule = {
  id: "MV1011",
  severity: "info",
  description:
    'Pod should set a seccomp profile (RuntimeDefault or Localhost) at the pod level.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    const profileType = podSpec?.securityContext?.seccompProfile?.type;

    if (profileType !== "RuntimeDefault" && profileType !== "Localhost") {
      const resourceId = `${resource.kind}/${resource.metadata.name}`;
      return [
        {
          rule: "MV1011",
          severity: "info",
          message: `${resourceId} does not set a seccomp profile at the pod level (expected RuntimeDefault or Localhost).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "securityContext.seccompProfile.type"),
          fix: 'Set securityContext.seccompProfile.type to "RuntimeDefault" or "Localhost" at the pod level.',
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV1012 - capabilities.drop does not include ALL
// ---------------------------------------------------------------------------
const mv1012: Rule = {
  id: "MV1012",
  severity: "warning",
  description:
    'Containers should drop ALL capabilities via securityContext.capabilities.drop: ["ALL"].',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      const drop: string[] =
        container.securityContext?.capabilities?.drop ?? [];
      const dropsAll = drop.some((d: string) => d.toUpperCase() === "ALL");

      if (!dropsAll) {
        violations.push({
          rule: "MV1012",
          severity: "warning",
          message: `Container "${container.name ?? index}" does not drop ALL capabilities.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(
            resource,
            prefix,
            index,
            "securityContext.capabilities.drop",
          ),
          fix: 'Add "ALL" to securityContext.capabilities.drop.',
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1013 - runAsUser set to 0 (root)
// ---------------------------------------------------------------------------
const mv1013: Rule = {
  id: "MV1013",
  severity: "error",
  description:
    "Containers should not explicitly run as root (runAsUser: 0).",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const podSpec = getPodSpec(resource);
    const violations: Violation[] = [];

    // Check pod-level securityContext
    if (podSpec?.securityContext?.runAsUser === 0) {
      violations.push({
        rule: "MV1013",
        severity: "error",
        message: `${resourceId} sets runAsUser to 0 (root) at the pod level.`,
        resource: resourceId,
        namespace: resource.metadata.namespace,
        path: podSpecPath(resource, "securityContext.runAsUser"),
        fix: "Set runAsUser to a non-zero UID or remove it.",
      });
    }

    // Check container-level securityContext
    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.securityContext?.runAsUser === 0) {
        violations.push({
          rule: "MV1013",
          severity: "error",
          message: `Container "${container.name ?? index}" sets runAsUser to 0 (root).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(
            resource,
            prefix,
            index,
            "securityContext.runAsUser",
          ),
          fix: "Set runAsUser to a non-zero UID or remove it.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1014 - procMount set to Unmasked
// ---------------------------------------------------------------------------
const mv1014: Rule = {
  id: "MV1014",
  severity: "error",
  description:
    'Containers should not set procMount to "Unmasked".',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.securityContext?.procMount === "Unmasked") {
        violations.push({
          rule: "MV1014",
          severity: "error",
          message: `Container "${container.name ?? index}" sets procMount to "Unmasked".`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(
            resource,
            prefix,
            index,
            "securityContext.procMount",
          ),
          fix: 'Remove procMount or set it to "Default".',
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV1015 - serviceAccountName is "default"
// ---------------------------------------------------------------------------
const mv1015: Rule = {
  id: "MV1015",
  severity: "warning",
  description:
    'Pods should not use the "default" service account. When serviceAccountName is not set, Kubernetes implicitly assigns the "default" service account.',
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    const resourceId = `${resource.kind}/${resource.metadata.name}`;

    // Explicit "default"
    if (podSpec?.serviceAccountName === "default") {
      return [
        {
          rule: "MV1015",
          severity: "warning",
          message: `${resourceId} explicitly uses the "default" service account.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "serviceAccountName"),
          fix: "Create and assign a dedicated service account.",
        },
      ];
    }

    // Implicit "default": serviceAccountName not set at all.
    // When the SA is not specified, Kubernetes automatically uses "default".
    // Flag only when automountServiceAccountToken is not explicitly false,
    // because that combination means the default SA token is mounted in the pod.
    if (
      !podSpec?.serviceAccountName &&
      podSpec?.automountServiceAccountToken !== false
    ) {
      return [
        {
          rule: "MV1015",
          severity: "warning",
          message: `${resourceId} does not set serviceAccountName, so it implicitly uses the "default" service account with its token auto-mounted.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "serviceAccountName"),
          fix: "Create a dedicated service account and set serviceAccountName, or set automountServiceAccountToken: false if no SA token is needed.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV1016 - automountServiceAccountToken not explicitly false
// ---------------------------------------------------------------------------
const mv1016: Rule = {
  id: "MV1016",
  severity: "warning",
  description:
    "Pods should explicitly set automountServiceAccountToken to false unless the service account token is required.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (podSpec?.automountServiceAccountToken !== false) {
      const resourceId = `${resource.kind}/${resource.metadata.name}`;
      return [
        {
          rule: "MV1016",
          severity: "warning",
          message: `${resourceId} does not set automountServiceAccountToken: false on the pod spec. The service account token will be auto-mounted even if the pod does not use it (also check MV2005 to disable at the ServiceAccount level).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "automountServiceAccountToken"),
          fix: "Set automountServiceAccountToken: false on the pod spec to prevent token mounting for this workload, or set it on the ServiceAccount (MV2005) to disable it for all pods using that SA.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV1017 - shareProcessNamespace enabled
// ---------------------------------------------------------------------------
const mv1017: Rule = {
  id: "MV1017",
  severity: "warning",
  description:
    "Pod should not enable shareProcessNamespace. When enabled, all containers in the pod share the same PID namespace, allowing one container to inspect and signal processes in other containers.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const podSpec = getPodSpec(resource);
    if (podSpec?.shareProcessNamespace === true) {
      const resourceId = `${resource.kind}/${resource.metadata.name}`;
      return [
        {
          rule: "MV1017",
          severity: "warning",
          message: `${resourceId} has shareProcessNamespace enabled, allowing containers to inspect each other's processes.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: podSpecPath(resource, "shareProcessNamespace"),
          fix: "Remove shareProcessNamespace or set it to false unless cross-container process sharing is explicitly required.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV1018 - Container with stdin or tty enabled
// ---------------------------------------------------------------------------
const mv1018: Rule = {
  id: "MV1018",
  severity: "warning",
  description: "Container should not have stdin or tty enabled. These allow interactive shell access which may be used for container escape or lateral movement.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isPodBearing(resource)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];

    for (const { container, index, prefix } of getContainers(resource)) {
      if (container.stdin === true || container.tty === true) {
        const flags = [container.stdin && "stdin", container.tty && "tty"].filter(Boolean).join(" and ");
        violations.push({
          rule: "MV1018",
          severity: "warning",
          message: `Container "${container.name ?? index}" has ${flags} enabled, allowing interactive shell access.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: containerPath(resource, prefix, index, container.stdin ? "stdin" : "tty"),
          fix: "Remove stdin and tty from the container spec unless interactive access is explicitly required.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// Export all MV1 rules
// ---------------------------------------------------------------------------
export const mv1Rules: Rule[] = [
  mv1001,
  mv1002,
  mv1003,
  mv1004,
  mv1005,
  mv1006,
  mv1007,
  mv1008,
  mv1009,
  mv1010,
  mv1011,
  mv1012,
  mv1013,
  mv1014,
  mv1015,
  mv1016,
  mv1017,
  mv1018,
];
