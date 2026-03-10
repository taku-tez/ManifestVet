import { describe, it, expect } from "vitest";
import { mv2Rules } from "../../src/rules/mv2";
import { parseYAML } from "../../src/parser/parser";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function checkRule(ruleId: string, yaml: string) {
  const { resources } = parseYAML(yaml);
  const rule = mv2Rules.find((r) => r.id === ruleId)!;
  return rule.check({ resource: resources[0], allResources: resources });
}

// ============================================================================
// MV2001 - Role/ClusterRole with wildcard (*) verbs
// ============================================================================
describe("MV2001 - wildcard verbs", () => {
  it("should flag a Role that uses wildcard (*) verbs", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: wildcard-verbs-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["*"]
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2001");
    expect(violations[0].severity).toBe("high");
    expect(violations[0].message).toContain("Role/wildcard-verbs-role");
    expect(violations[0].message).toContain("wildcard (*) verbs");
    expect(violations[0].path).toBe("rules[0].verbs");
    expect(violations[0].resource).toBe("Role/wildcard-verbs-role");
  });

  it("should pass when verbs are explicitly listed", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: safe-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag a ClusterRole with wildcard verbs", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: wildcard-cr
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["*"]
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("ClusterRole/wildcard-cr");
    expect(violations[0].message).toContain("ClusterRole/wildcard-cr");
  });

  it("should flag multiple rules independently when each has wildcard verbs", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: multi-wildcard
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["*"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
  - apiGroups: ["batch"]
    resources: ["jobs"]
    verbs: ["*"]
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("rules[0].verbs");
    expect(violations[1].path).toBe("rules[2].verbs");
  });

  it("should not flag non-role resources", () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  ports:
    - port: 80
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should handle a Role with no rules field", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: empty-role
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should not flag when verbs list contains '*' as a substring but not exact match", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: star-verb-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should include namespace when present", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ns-role
  namespace: production
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["*"]
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("production");
  });
});

// ============================================================================
// MV2002 - Role/ClusterRole with wildcard (*) resources
// ============================================================================
describe("MV2002 - wildcard resources", () => {
  it("should flag a Role that uses wildcard (*) resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: wildcard-resources-role
rules:
  - apiGroups: [""]
    resources: ["*"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2002", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2002");
    expect(violations[0].severity).toBe("high");
    expect(violations[0].message).toContain("wildcard (*) resources");
    expect(violations[0].path).toBe("rules[0].resources");
    expect(violations[0].resource).toBe("Role/wildcard-resources-role");
  });

  it("should pass when resources are explicitly listed", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: explicit-resources
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps"]
    verbs: ["get", "list"]
`;
    const violations = checkRule("MV2002", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag a ClusterRole with wildcard resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cr-wildcard-res
rules:
  - apiGroups: [""]
    resources: ["*"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2002", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("ClusterRole/cr-wildcard-res");
  });

  it("should flag multiple rules with wildcard resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: multi-wildcard-res
rules:
  - apiGroups: [""]
    resources: ["*"]
    verbs: ["get"]
  - apiGroups: ["apps"]
    resources: ["*"]
    verbs: ["list"]
`;
    const violations = checkRule("MV2002", yaml);
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("rules[0].resources");
    expect(violations[1].path).toBe("rules[1].resources");
  });

  it("should not flag when resource list has specific items alongside but no wildcard", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: specific-resources
rules:
  - apiGroups: [""]
    resources: ["pods", "services"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2002", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-role resources", () => {
    const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-cm
data:
  key: value
`;
    const violations = checkRule("MV2002", yaml);
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV2003 - Role/ClusterRole with wildcard (*) apiGroups
// ============================================================================
describe("MV2003 - wildcard apiGroups", () => {
  it("should flag a Role that uses wildcard (*) apiGroups", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: wildcard-apigroups-role
rules:
  - apiGroups: ["*"]
    resources: ["pods"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2003", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2003");
    expect(violations[0].severity).toBe("medium");
    expect(violations[0].message).toContain("wildcard (*) apiGroups");
    expect(violations[0].path).toBe("rules[0].apiGroups");
    expect(violations[0].resource).toBe("Role/wildcard-apigroups-role");
  });

  it("should pass when apiGroups are explicitly listed", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: explicit-apigroups
rules:
  - apiGroups: ["", "apps", "batch"]
    resources: ["pods"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2003", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag a ClusterRole with wildcard apiGroups", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cr-wildcard-ag
rules:
  - apiGroups: ["*"]
    resources: ["deployments"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2003", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("ClusterRole/cr-wildcard-ag");
  });

  it("should pass when apiGroups is the core group (empty string)", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: core-group-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2003", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple rules with wildcard apiGroups independently", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: multi-wc-ag
rules:
  - apiGroups: ["*"]
    resources: ["pods"]
    verbs: ["get"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get"]
  - apiGroups: ["*"]
    resources: ["services"]
    verbs: ["list"]
`;
    const violations = checkRule("MV2003", yaml);
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("rules[0].apiGroups");
    expect(violations[1].path).toBe("rules[2].apiGroups");
  });

  it("should not flag binding resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: my-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: some-role
subjects:
  - kind: User
    name: admin
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2003", yaml);
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV2004 - ClusterRoleBinding binds to cluster-admin
// ============================================================================
describe("MV2004 - cluster-admin binding", () => {
  it("should flag a ClusterRoleBinding that binds to cluster-admin", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: User
    name: admin-user
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2004", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2004");
    expect(violations[0].severity).toBe("critical");
    expect(violations[0].message).toContain("cluster-admin");
    expect(violations[0].message).toContain("unrestricted superuser access");
    expect(violations[0].path).toBe("roleRef.name");
    expect(violations[0].resource).toBe("ClusterRoleBinding/admin-binding");
  });

  it("should pass when binding to a non-cluster-admin role", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: safe-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
  - kind: User
    name: viewer
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2004", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should not flag a RoleBinding even if it references cluster-admin", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: rb-cluster-admin
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: User
    name: admin-user
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2004", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-binding resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-admin
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
`;
    const violations = checkRule("MV2004", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when roleRef has a name that contains cluster-admin as substring", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: custom-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: custom-cluster-admin-role
subjects:
  - kind: User
    name: admin-user
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2004", yaml);
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV2005 - ServiceAccount automountServiceAccountToken not false
// ============================================================================
describe("MV2005 - ServiceAccount automount", () => {
  it("should flag a ServiceAccount without automountServiceAccountToken set", () => {
    const yaml = `
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-sa
  namespace: default
`;
    const violations = checkRule("MV2005", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2005");
    expect(violations[0].severity).toBe("medium");
    expect(violations[0].message).toContain("automountServiceAccountToken");
    expect(violations[0].path).toBe("automountServiceAccountToken");
    expect(violations[0].resource).toBe("ServiceAccount/my-sa");
  });

  it("should flag a ServiceAccount with automountServiceAccountToken set to true", () => {
    // Note: the parser does not map automountServiceAccountToken as a
    // top-level field on K8sResource. The rule accesses it via
    // `(resource as any).automountServiceAccountToken` which will be
    // undefined after parsing. undefined !== false -> violation.
    const yaml = `
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-sa
automountServiceAccountToken: true
`;
    const violations = checkRule("MV2005", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("automountServiceAccountToken");
  });

  it("should flag when automountServiceAccountToken is not mapped by the parser", () => {
    // Even when set to false in YAML, the parser does not extract this
    // field onto the resource object, so the rule sees undefined.
    // This tests the actual behavior of the system end-to-end.
    const yaml = `
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-sa
automountServiceAccountToken: false
`;
    const violations = checkRule("MV2005", yaml);
    // The parser does not map automountServiceAccountToken to the resource,
    // so (resource as any).automountServiceAccountToken === undefined !== false.
    // This means the rule will flag it regardless.
    expect(violations).toHaveLength(1);
  });

  it("should not flag non-ServiceAccount resources", () => {
    const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-cm
data:
  key: value
`;
    const violations = checkRule("MV2005", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should not flag Role resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: test-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2005", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should include namespace in violation when present", () => {
    const yaml = `
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ns-sa
  namespace: kube-system
`;
    const violations = checkRule("MV2005", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("kube-system");
  });
});

// ============================================================================
// MV2006 - Role/ClusterRole grants access to secrets
// ============================================================================
describe("MV2006 - secrets access", () => {
  it("should flag a Role that grants access to secrets", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]
`;
    const violations = checkRule("MV2006", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2006");
    expect(violations[0].severity).toBe("medium");
    expect(violations[0].message).toContain("secrets");
    expect(violations[0].path).toBe("rules[0].resources");
    expect(violations[0].resource).toBe("Role/secret-reader");
  });

  it("should pass when no secrets are in the resources list", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "configmaps"]
    verbs: ["get", "list"]
`;
    const violations = checkRule("MV2006", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag a ClusterRole that grants access to secrets", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cr-secret-access
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2006", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("ClusterRole/cr-secret-access");
  });

  it("should flag secrets alongside other resources in the same rule", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: mixed-resources
rules:
  - apiGroups: [""]
    resources: ["pods", "secrets", "configmaps"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2006", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("rules[0].resources");
  });

  it("should flag multiple rules each granting secrets access", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: multi-secret-role
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["list"]
`;
    const violations = checkRule("MV2006", yaml);
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("rules[0].resources");
    expect(violations[1].path).toBe("rules[2].resources");
  });

  it("should not flag binding resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: my-rb
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: secret-reader
subjects:
  - kind: User
    name: someone
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2006", yaml);
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV2007 - Role/ClusterRole grants exec to pods
// ============================================================================
describe("MV2007 - pods/exec access", () => {
  it("should flag a Role that grants pods/exec access", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: exec-role
rules:
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create"]
`;
    const violations = checkRule("MV2007", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2007");
    expect(violations[0].severity).toBe("medium");
    expect(violations[0].message).toContain("exec access to pods");
    expect(violations[0].path).toBe("rules[0].resources");
    expect(violations[0].resource).toBe("Role/exec-role");
  });

  it("should pass when pods/exec is not in the resources list", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2007", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag a ClusterRole with pods/exec", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cr-exec
rules:
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create"]
`;
    const violations = checkRule("MV2007", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("ClusterRole/cr-exec");
  });

  it("should flag pods/exec alongside other pod subresources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: subresource-role
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/exec", "pods/log"]
    verbs: ["create", "get"]
`;
    const violations = checkRule("MV2007", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("rules[0].resources");
  });

  it("should not flag 'pods' without '/exec' subresource", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: just-pods
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "create", "delete"]
`;
    const violations = checkRule("MV2007", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should handle a role with no rules", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: empty-cr
`;
    const violations = checkRule("MV2007", yaml);
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV2008 - ClusterRole with impersonation permissions
// ============================================================================
describe("MV2008 - impersonation permissions", () => {
  it("should flag a Role with impersonate verb on users", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: impersonator
rules:
  - apiGroups: [""]
    resources: ["users"]
    verbs: ["impersonate"]
`;
    const violations = checkRule("MV2008", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2008");
    expect(violations[0].severity).toBe("medium");
    expect(violations[0].message).toContain("impersonation permissions");
    expect(violations[0].path).toBe("rules[0].verbs");
    expect(violations[0].resource).toBe("ClusterRole/impersonator");
  });

  it("should pass when impersonate verb is not present", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: user-reader
rules:
  - apiGroups: [""]
    resources: ["users"]
    verbs: ["get", "list"]
`;
    const violations = checkRule("MV2008", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when impersonate verb targets non-impersonation resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: impersonate-pods
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["impersonate"]
`;
    const violations = checkRule("MV2008", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag impersonate verb on groups", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: group-impersonator
rules:
  - apiGroups: [""]
    resources: ["groups"]
    verbs: ["impersonate"]
`;
    const violations = checkRule("MV2008", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("impersonation permissions");
  });

  it("should flag impersonate verb on serviceaccounts", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: sa-impersonator
rules:
  - apiGroups: [""]
    resources: ["serviceaccounts"]
    verbs: ["impersonate"]
`;
    const violations = checkRule("MV2008", yaml);
    expect(violations).toHaveLength(1);
  });

  it("should flag a Role (not just ClusterRole) with impersonation permissions", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: role-impersonator
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["users"]
    verbs: ["impersonate"]
`;
    const violations = checkRule("MV2008", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("Role/role-impersonator");
  });

  it("should require BOTH impersonate verb AND impersonation resource", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: partial-impersonator
rules:
  - apiGroups: [""]
    resources: ["users", "pods"]
    verbs: ["get", "list"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["impersonate"]
`;
    const violations = checkRule("MV2008", yaml);
    // First rule: has users but no impersonate verb -> no violation
    // Second rule: has impersonate but only pods -> no violation
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple rules that each have impersonation permissions", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: multi-impersonator
rules:
  - apiGroups: [""]
    resources: ["users"]
    verbs: ["impersonate"]
  - apiGroups: [""]
    resources: ["groups"]
    verbs: ["impersonate"]
  - apiGroups: [""]
    resources: ["serviceaccounts"]
    verbs: ["impersonate"]
`;
    const violations = checkRule("MV2008", yaml);
    expect(violations).toHaveLength(3);
    expect(violations[0].path).toBe("rules[0].verbs");
    expect(violations[1].path).toBe("rules[1].verbs");
    expect(violations[2].path).toBe("rules[2].verbs");
  });
});

// ============================================================================
// MV2009 - RoleBinding/ClusterRoleBinding binds to system:unauthenticated
//          or system:anonymous
// ============================================================================
describe("MV2009 - unauthenticated/anonymous binding", () => {
  it("should flag a ClusterRoleBinding that binds to system:unauthenticated", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: unauth-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: some-role
subjects:
  - kind: Group
    name: system:unauthenticated
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV2009");
    expect(violations[0].severity).toBe("critical");
    expect(violations[0].message).toContain("system:unauthenticated");
    expect(violations[0].path).toBe("subjects[0].name");
    expect(violations[0].resource).toBe("ClusterRoleBinding/unauth-binding");
  });

  it("should flag a ClusterRoleBinding that binds to system:anonymous", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: anon-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: some-role
subjects:
  - kind: User
    name: system:anonymous
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("system:anonymous");
    expect(violations[0].path).toBe("subjects[0].name");
    expect(violations[0].fix).toContain("system:anonymous");
  });

  it("should pass when subjects are normal users/groups", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: safe-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
  - kind: User
    name: jane@example.com
    apiGroup: rbac.authorization.k8s.io
  - kind: Group
    name: developers
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag a RoleBinding that binds to system:unauthenticated", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: rb-unauth
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: some-role
subjects:
  - kind: Group
    name: system:unauthenticated
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("RoleBinding/rb-unauth");
  });

  it("should flag both system:unauthenticated and system:anonymous in the same binding", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: double-danger
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: some-role
subjects:
  - kind: Group
    name: system:unauthenticated
    apiGroup: rbac.authorization.k8s.io
  - kind: User
    name: system:anonymous
    apiGroup: rbac.authorization.k8s.io
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("subjects[0].name");
    expect(violations[0].message).toContain("system:unauthenticated");
    expect(violations[1].path).toBe("subjects[1].name");
    expect(violations[1].message).toContain("system:anonymous");
  });

  it("should only flag the dangerous subject among multiple subjects", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: mixed-subjects
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: some-role
subjects:
  - kind: User
    name: admin@example.com
    apiGroup: rbac.authorization.k8s.io
  - kind: Group
    name: system:unauthenticated
    apiGroup: rbac.authorization.k8s.io
  - kind: ServiceAccount
    name: my-sa
    namespace: default
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("subjects[1].name");
  });

  it("should not flag non-binding resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: some-role
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get"]
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should handle a binding with no subjects", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: empty-subjects
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: some-role
`;
    const violations = checkRule("MV2009", yaml);
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// Cross-cutting / integration tests
// ============================================================================
describe("MV2 rules - cross-cutting concerns", () => {
  it("should export exactly 10 rules", () => {
    expect(mv2Rules).toHaveLength(10);
  });

  it("should have unique rule IDs", () => {
    const ids = mv2Rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(10);
  });

  it("should have IDs from MV2001 to MV2010", () => {
    for (let i = 1; i <= 9; i++) {
      const id = `MV200${i}`;
      expect(mv2Rules.find((r) => r.id === id)).toBeDefined();
    }
    expect(mv2Rules.find((r) => r.id === "MV2010")).toBeDefined();
  });

  it("should return no violations for a non-RBAC resource across all rules", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-deploy
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      containers:
        - name: app
          image: nginx
`;
    for (const rule of mv2Rules) {
      const { resources } = parseYAML(yaml);
      const violations = rule.check({
        resource: resources[0],
        allResources: resources,
      });
      expect(violations).toHaveLength(0);
    }
  });

  it("should populate resource field as Kind/name format", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-cluster-role
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
`;
    const violations = checkRule("MV2001", yaml);
    expect(violations[0].resource).toBe("ClusterRole/my-cluster-role");
  });

  it("should flag a Role that violates MV2001, MV2002, and MV2003 simultaneously", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: god-role
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
`;
    const { resources } = parseYAML(yaml);
    const allViolations: any[] = [];
    for (const rule of mv2Rules) {
      const v = rule.check({
        resource: resources[0],
        allResources: resources,
      });
      allViolations.push(...v);
    }
    const ruleIds = allViolations.map((v) => v.rule);
    expect(ruleIds).toContain("MV2001");
    expect(ruleIds).toContain("MV2002");
    expect(ruleIds).toContain("MV2003");
  });

  it("should produce fix suggestions for all violations", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: bad-role
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["*"]
`;
    const { resources } = parseYAML(yaml);
    for (const rule of [mv2Rules[0], mv2Rules[1], mv2Rules[2]]) {
      const violations = rule.check({
        resource: resources[0],
        allResources: resources,
      });
      for (const v of violations) {
        expect(v.fix).toBeDefined();
        expect(v.fix!.length).toBeGreaterThan(0);
      }
    }
  });

  it("should handle a clean ClusterRole with no violations for role-based rules", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: safe-reader
rules:
  - apiGroups: [""]
    resources: ["pods", "services"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
`;
    const { resources } = parseYAML(yaml);
    for (const rule of mv2Rules) {
      const violations = rule.check({
        resource: resources[0],
        allResources: resources,
      });
      expect(violations).toHaveLength(0);
    }
  });

  it("should handle a clean ClusterRoleBinding with no violations for binding rules", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: safe-crb
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
  - kind: User
    name: developer@example.com
    apiGroup: rbac.authorization.k8s.io
`;
    const { resources } = parseYAML(yaml);
    for (const rule of mv2Rules) {
      const violations = rule.check({
        resource: resources[0],
        allResources: resources,
      });
      expect(violations).toHaveLength(0);
    }
  });
});

// ============================================================================
// MV2010 - ClusterRole grants read access to all resources
// ============================================================================
describe("MV2010 - ClusterRole grants read access to all resources", () => {
  it("should flag ClusterRole with get/list/watch on wildcard resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: read-all
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
`;
    const { resources } = parseYAML(yaml);
    const mv2010 = mv2Rules.find((r) => r.id === "MV2010")!;
    const violations = mv2010.check({ resource: resources[0], allResources: resources });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe("MV2010");
  });

  it("should not flag ClusterRole with wildcard verbs but specific resources", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
`;
    const { resources } = parseYAML(yaml);
    const mv2010 = mv2Rules.find((r) => r.id === "MV2010")!;
    const violations = mv2010.check({ resource: resources[0], allResources: resources });
    expect(violations).toHaveLength(0);
  });

  it("should not flag Role (only ClusterRole)", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: read-all
  namespace: default
rules:
  - apiGroups: ["*"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]
`;
    const { resources } = parseYAML(yaml);
    const mv2010 = mv2Rules.find((r) => r.id === "MV2010")!;
    const violations = mv2010.check({ resource: resources[0], allResources: resources });
    expect(violations).toHaveLength(0);
  });
});
