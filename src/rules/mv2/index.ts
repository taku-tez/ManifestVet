import { Rule, RuleContext, Violation } from "../types";

// ---------------------------------------------------------------------------
// Kind guards
// ---------------------------------------------------------------------------

const ROLE_KINDS = ["Role", "ClusterRole"];
const BINDING_KINDS = ["RoleBinding", "ClusterRoleBinding"];

function isRoleKind(kind: string): boolean {
  return ROLE_KINDS.includes(kind);
}

function isBindingKind(kind: string): boolean {
  return BINDING_KINDS.includes(kind);
}

// ---------------------------------------------------------------------------
// MV2001 - Role/ClusterRole with wildcard (*) verbs
// ---------------------------------------------------------------------------
const mv2001: Rule = {
  id: "MV2001",
  severity: "high",
  description:
    "Role/ClusterRole should not use wildcard (*) verbs. Wildcard verbs grant all actions on the matched resources.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isRoleKind(resource.kind as string)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const rules: any[] = resource.rules ?? [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const verbs: string[] = rule.verbs ?? [];
      if (verbs.includes("*")) {
        violations.push({
          rule: "MV2001",
          severity: "high",
          message: `${resourceId} grants wildcard (*) verbs in rules[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `rules[${i}].verbs`,
          fix: "Replace the wildcard verb with an explicit list of required verbs (e.g. get, list, watch).",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV2002 - Role/ClusterRole with wildcard (*) resources
// ---------------------------------------------------------------------------
const mv2002: Rule = {
  id: "MV2002",
  severity: "high",
  description:
    "Role/ClusterRole should not use wildcard (*) resources. Wildcard resources grant access to every resource type.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isRoleKind(resource.kind as string)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const rules: any[] = resource.rules ?? [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const resources: string[] = rule.resources ?? [];
      if (resources.includes("*")) {
        violations.push({
          rule: "MV2002",
          severity: "high",
          message: `${resourceId} grants access to wildcard (*) resources in rules[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `rules[${i}].resources`,
          fix: "Replace the wildcard resource with an explicit list of required resources.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV2003 - Role/ClusterRole with wildcard (*) apiGroups
// ---------------------------------------------------------------------------
const mv2003: Rule = {
  id: "MV2003",
  severity: "medium",
  description:
    "Role/ClusterRole should not use wildcard (*) apiGroups. Wildcard apiGroups grant access across all API groups.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isRoleKind(resource.kind as string)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const rules: any[] = resource.rules ?? [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const apiGroups: string[] = rule.apiGroups ?? [];
      if (apiGroups.includes("*")) {
        violations.push({
          rule: "MV2003",
          severity: "medium",
          message: `${resourceId} uses wildcard (*) apiGroups in rules[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `rules[${i}].apiGroups`,
          fix: 'Replace the wildcard apiGroup with explicit API groups (e.g. "", "apps", "batch").',
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV2004 - ClusterRoleBinding binds to cluster-admin
// ---------------------------------------------------------------------------
const mv2004: Rule = {
  id: "MV2004",
  severity: "critical",
  description:
    "ClusterRoleBinding should not bind to the cluster-admin ClusterRole. This grants unrestricted superuser access.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "ClusterRoleBinding") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;

    if (resource.roleRef?.name === "cluster-admin") {
      return [
        {
          rule: "MV2004",
          severity: "critical",
          message: `${resourceId} binds to the cluster-admin ClusterRole, granting unrestricted superuser access.`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "roleRef.name",
          fix: "Bind to a more restrictive ClusterRole with only the permissions required.",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV2005 - ServiceAccount with automountServiceAccountToken not false
// ---------------------------------------------------------------------------
const mv2005: Rule = {
  id: "MV2005",
  severity: "medium",
  description:
    "ServiceAccount should explicitly set automountServiceAccountToken to false unless the token is required.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "ServiceAccount") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;

    // The field lives at the top level for ServiceAccount resources (not under spec).
    const automount = (resource as any).automountServiceAccountToken;

    if (automount !== false) {
      return [
        {
          rule: "MV2005",
          severity: "medium",
          message: `ServiceAccount "${resource.metadata.name}" does not set automountServiceAccountToken: false. All pods using this SA will mount the token unless overridden at the pod level (see MV1016).`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: "automountServiceAccountToken",
          fix: "Set automountServiceAccountToken: false on the ServiceAccount to disable token mounting for all pods using it. Alternatively, set it on each pod's spec (MV1016).",
        },
      ];
    }

    return [];
  },
};

// ---------------------------------------------------------------------------
// MV2006 - Role/ClusterRole grants access to secrets
// ---------------------------------------------------------------------------
const mv2006: Rule = {
  id: "MV2006",
  severity: "medium",
  description:
    "Role/ClusterRole should not grant access to secrets unless absolutely necessary.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isRoleKind(resource.kind as string)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const rules: any[] = resource.rules ?? [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const resources: string[] = rule.resources ?? [];
      if (resources.includes("secrets")) {
        violations.push({
          rule: "MV2006",
          severity: "medium",
          message: `${resourceId} grants access to secrets in rules[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `rules[${i}].resources`,
          fix: "Remove secrets from the resources list unless access is explicitly required.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV2007 - Role/ClusterRole grants exec to pods
// ---------------------------------------------------------------------------
const mv2007: Rule = {
  id: "MV2007",
  severity: "medium",
  description:
    "Role/ClusterRole should not grant exec access to pods. Pod exec allows arbitrary command execution inside containers.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isRoleKind(resource.kind as string)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const rules: any[] = resource.rules ?? [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const resources: string[] = rule.resources ?? [];
      if (resources.includes("pods/exec")) {
        violations.push({
          rule: "MV2007",
          severity: "medium",
          message: `${resourceId} grants exec access to pods in rules[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `rules[${i}].resources`,
          fix: "Remove pods/exec from the resources list unless exec access is explicitly required.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV2008 - ClusterRole with impersonation permissions
// ---------------------------------------------------------------------------
const mv2008: Rule = {
  id: "MV2008",
  severity: "medium",
  description:
    "ClusterRole should not grant impersonation permissions. Impersonation allows acting as other users, groups, or service accounts.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isRoleKind(resource.kind as string)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const rules: any[] = resource.rules ?? [];

    const impersonationResources = ["users", "groups", "serviceaccounts"];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const resources: string[] = rule.resources ?? [];
      const verbs: string[] = rule.verbs ?? [];

      const hasImpersonateVerb = verbs.includes("impersonate");
      const hasImpersonationResource = resources.some((r) =>
        impersonationResources.includes(r),
      );

      if (hasImpersonateVerb && hasImpersonationResource) {
        violations.push({
          rule: "MV2008",
          severity: "medium",
          message: `${resourceId} grants impersonation permissions in rules[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `rules[${i}].verbs`,
          fix: "Remove the impersonate verb or remove users/groups/serviceaccounts from the resources list.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV2009 - RoleBinding/ClusterRoleBinding binds to system:unauthenticated
//          or system:anonymous
// ---------------------------------------------------------------------------
const mv2009: Rule = {
  id: "MV2009",
  severity: "critical",
  description:
    "RoleBinding/ClusterRoleBinding should not bind to system:unauthenticated or system:anonymous.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (!isBindingKind(resource.kind as string)) return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const subjects: any[] = resource.subjects ?? [];

    const dangerousSubjects = ["system:unauthenticated", "system:anonymous"];

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      if (dangerousSubjects.includes(subject.name)) {
        violations.push({
          rule: "MV2009",
          severity: "critical",
          message: `${resourceId} binds to ${subject.name} in subjects[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `subjects[${i}].name`,
          fix: `Remove the ${subject.name} subject from the binding.`,
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// MV2010 - ClusterRole grants read access to all resources (get/list/watch on *)
// ---------------------------------------------------------------------------
const mv2010: Rule = {
  id: "MV2010",
  severity: "medium",
  description:
    "ClusterRole grants get/list/watch on all resources (*). This provides broad read access to sensitive data across the entire cluster (Secrets, ConfigMaps, etc.) and violates least-privilege.",
  check(ctx: RuleContext): Violation[] {
    const { resource } = ctx;
    if (resource.kind !== "ClusterRole") return [];

    const resourceId = `${resource.kind}/${resource.metadata.name}`;
    const violations: Violation[] = [];
    const rules: any[] = resource.rules ?? [];

    const readVerbs = new Set(["get", "list", "watch"]);

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const resources: string[] = rule.resources ?? [];
      const verbs: string[] = rule.verbs ?? [];

      if (
        resources.includes("*") &&
        readVerbs.size === [...readVerbs].filter(v => verbs.includes(v) || verbs.includes("*")).length
      ) {
        violations.push({
          rule: "MV2010",
          severity: "medium",
          message: `ClusterRole "${resource.metadata.name}" grants ${verbs.filter(v => readVerbs.has(v) || v === "*").join("/")} on all resources (*) in rules[${i}].`,
          resource: resourceId,
          namespace: resource.metadata.namespace,
          path: `rules[${i}].resources`,
          fix: "Replace the wildcard resource (*) with an explicit list of resources that this role actually needs to read.",
        });
      }
    }

    return violations;
  },
};

// ---------------------------------------------------------------------------
// Export all MV2 rules
// ---------------------------------------------------------------------------
export const mv2Rules: Rule[] = [
  mv2001,
  mv2002,
  mv2003,
  mv2004,
  mv2005,
  mv2006,
  mv2007,
  mv2008,
  mv2009,
  mv2010,
];
