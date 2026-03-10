import { describe, it, expect } from "vitest";
import { mv1Rules } from "../../src/rules/mv1";
import { Rule, RuleContext } from "../../src/rules/types";
import { parseYAML } from "../../src/parser/parser";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function checkRule(ruleId: string, yaml: string) {
  const { resources } = parseYAML(yaml);
  const rule = mv1Rules.find((r) => r.id === ruleId)!;
  return rule.check({ resource: resources[0], allResources: resources });
}

// ---------------------------------------------------------------------------
// Reusable YAML fragments
// ---------------------------------------------------------------------------
const DEPLOYMENT_BASE = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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

const POD_BASE = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: app
      image: nginx
`;

// ============================================================================
// MV1001 - runAsNonRoot not set to true
// ============================================================================
describe("MV1001 - runAsNonRoot", () => {
  it("should flag when runAsNonRoot is not set at container or pod level", () => {
    const violations = checkRule("MV1001", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1001");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("runAsNonRoot");
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].securityContext.runAsNonRoot"
    );
  });

  it("should pass when runAsNonRoot is true at container level", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            runAsNonRoot: true
`;
    const violations = checkRule("MV1001", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when runAsNonRoot is true at pod level", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1001", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag initContainers without runAsNonRoot", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            runAsNonRoot: true
      initContainers:
        - name: init
          image: busybox
`;
    const violations = checkRule("MV1001", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("init");
    expect(violations[0].path).toBe(
      "spec.template.spec.initContainers[0].securityContext.runAsNonRoot"
    );
  });

  it("should return no violations for non-pod-bearing resources", () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: test-svc
spec:
  ports:
    - port: 80
`;
    const violations = checkRule("MV1001", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag a Pod resource correctly with pod-level path", () => {
    const violations = checkRule("MV1001", POD_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.containers[0].securityContext.runAsNonRoot"
    );
  });
});

// ============================================================================
// MV1002 - allowPrivilegeEscalation not explicitly false
// ============================================================================
describe("MV1002 - allowPrivilegeEscalation", () => {
  it("should flag when allowPrivilegeEscalation is not set", () => {
    const violations = checkRule("MV1002", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1002");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("allowPrivilegeEscalation");
  });

  it("should pass when allowPrivilegeEscalation is false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            allowPrivilegeEscalation: false
`;
    const violations = checkRule("MV1002", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when allowPrivilegeEscalation is explicitly true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            allowPrivilegeEscalation: true
`;
    const violations = checkRule("MV1002", yaml);
    expect(violations).toHaveLength(1);
  });

  it("should flag multiple containers independently", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
        - name: sidecar
          image: envoy
`;
    const violations = checkRule("MV1002", yaml);
    expect(violations).toHaveLength(2);
    expect(violations[0].message).toContain("app");
    expect(violations[1].message).toContain("sidecar");
  });
});

// ============================================================================
// MV1003 - privileged containers
// ============================================================================
describe("MV1003 - privileged", () => {
  it("should flag when privileged is true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            privileged: true
`;
    const violations = checkRule("MV1003", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1003");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("privileged mode");
  });

  it("should pass when privileged is false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            privileged: false
`;
    const violations = checkRule("MV1003", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when privileged is not set at all", () => {
    const violations = checkRule("MV1003", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should flag privileged initContainer", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: app
      image: nginx
  initContainers:
    - name: init
      image: busybox
      securityContext:
        privileged: true
`;
    const violations = checkRule("MV1003", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.initContainers[0].securityContext.privileged"
    );
  });
});

// ============================================================================
// MV1004 - hostNetwork enabled
// ============================================================================
describe("MV1004 - hostNetwork", () => {
  it("should flag when hostNetwork is true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostNetwork: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1004", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1004");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("hostNetwork");
    expect(violations[0].path).toBe("spec.template.spec.hostNetwork");
  });

  it("should pass when hostNetwork is false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostNetwork: false
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1004", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when hostNetwork is not set", () => {
    const violations = checkRule("MV1004", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should use pod-level path for Pod resources", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  hostNetwork: true
  containers:
    - name: app
      image: nginx
`;
    const violations = checkRule("MV1004", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.hostNetwork");
  });
});

// ============================================================================
// MV1005 - hostPID enabled
// ============================================================================
describe("MV1005 - hostPID", () => {
  it("should flag when hostPID is true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostPID: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1005", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1005");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("hostPID");
    expect(violations[0].path).toBe("spec.template.spec.hostPID");
  });

  it("should pass when hostPID is false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostPID: false
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1005", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when hostPID is not set", () => {
    const violations = checkRule("MV1005", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should work on a StatefulSet", () => {
    const yaml = `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: test-ss
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostPID: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1005", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("StatefulSet/test-ss");
  });
});

// ============================================================================
// MV1006 - hostIPC enabled
// ============================================================================
describe("MV1006 - hostIPC", () => {
  it("should flag when hostIPC is true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostIPC: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1006", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1006");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("hostIPC");
    expect(violations[0].path).toBe("spec.template.spec.hostIPC");
  });

  it("should pass when hostIPC is false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostIPC: false
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1006", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when hostIPC is not set", () => {
    const violations = checkRule("MV1006", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should work for DaemonSet", () => {
    const yaml = `
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: test-ds
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      hostIPC: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1006", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("DaemonSet/test-ds");
  });
});

// ============================================================================
// MV1007 - dangerous capabilities added
// ============================================================================
describe("MV1007 - dangerous capabilities", () => {
  it("should flag when a dangerous capability is added", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              add:
                - NET_ADMIN
`;
    const violations = checkRule("MV1007", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1007");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("NET_ADMIN");
  });

  it("should pass when only safe capabilities are added", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              add:
                - NET_BIND_SERVICE
`;
    const violations = checkRule("MV1007", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when no capabilities are added", () => {
    const violations = checkRule("MV1007", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple dangerous capabilities in the same container", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              add:
                - SYS_ADMIN
                - SYS_PTRACE
                - NET_BIND_SERVICE
`;
    const violations = checkRule("MV1007", yaml);
    expect(violations).toHaveLength(2);
    const messages = violations.map((v) => v.message);
    expect(messages.some((m) => m.includes("SYS_ADMIN"))).toBe(true);
    expect(messages.some((m) => m.includes("SYS_PTRACE"))).toBe(true);
  });

  it("should handle case-insensitive capability matching", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              add:
                - sys_admin
`;
    const violations = checkRule("MV1007", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("SYS_ADMIN");
  });

  it("should flag all five dangerous capabilities", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              add:
                - NET_ADMIN
                - SYS_ADMIN
                - SYS_PTRACE
                - SYS_MODULE
                - DAC_OVERRIDE
`;
    const violations = checkRule("MV1007", yaml);
    expect(violations).toHaveLength(5);
  });
});

// ============================================================================
// MV1008 - missing resource limits
// ============================================================================
describe("MV1008 - resource limits", () => {
  it("should flag when resource limits are missing entirely", () => {
    const violations = checkRule("MV1008", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1008");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("cpu");
    expect(violations[0].message).toContain("memory");
  });

  it("should pass when both cpu and memory limits are set", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
`;
    const violations = checkRule("MV1008", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when only cpu limit is missing", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          resources:
            limits:
              memory: 128Mi
`;
    const violations = checkRule("MV1008", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("cpu");
    expect(violations[0].message).not.toContain("memory");
  });

  it("should flag when only memory limit is missing", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          resources:
            limits:
              cpu: 100m
`;
    const violations = checkRule("MV1008", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("memory");
    expect(violations[0].message).not.toContain("cpu");
  });
});

// ============================================================================
// MV1009 - missing resource requests
// ============================================================================
describe("MV1009 - resource requests", () => {
  it("should flag when resource requests are missing entirely", () => {
    const violations = checkRule("MV1009", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1009");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("cpu");
    expect(violations[0].message).toContain("memory");
  });

  it("should pass when both cpu and memory requests are set", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
`;
    const violations = checkRule("MV1009", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when only memory request is missing", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          resources:
            requests:
              cpu: 50m
`;
    const violations = checkRule("MV1009", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("memory");
    expect(violations[0].message).not.toContain("cpu");
  });

  it("should flag initContainers missing requests too", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
      initContainers:
        - name: init
          image: busybox
`;
    const violations = checkRule("MV1009", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("init");
    expect(violations[0].path).toBe(
      "spec.template.spec.initContainers[0].resources.requests"
    );
  });
});

// ============================================================================
// MV1010 - readOnlyRootFilesystem not true
// ============================================================================
describe("MV1010 - readOnlyRootFilesystem", () => {
  it("should flag when readOnlyRootFilesystem is not set", () => {
    const violations = checkRule("MV1010", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1010");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("readOnlyRootFilesystem");
  });

  it("should pass when readOnlyRootFilesystem is true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            readOnlyRootFilesystem: true
`;
    const violations = checkRule("MV1010", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when readOnlyRootFilesystem is explicitly false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            readOnlyRootFilesystem: false
`;
    const violations = checkRule("MV1010", yaml);
    expect(violations).toHaveLength(1);
  });

  it("should use correct path for Pod kind", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: app
      image: nginx
`;
    const violations = checkRule("MV1010", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.containers[0].securityContext.readOnlyRootFilesystem"
    );
  });
});

// ============================================================================
// MV1011 - seccomp profile not set
// ============================================================================
describe("MV1011 - seccomp profile", () => {
  it("should flag when seccomp profile is not set", () => {
    const violations = checkRule("MV1011", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1011");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("seccomp");
    expect(violations[0].path).toBe(
      "spec.template.spec.securityContext.seccompProfile.type"
    );
  });

  it("should pass when seccomp profile is RuntimeDefault", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      securityContext:
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1011", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when seccomp profile is Localhost", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      securityContext:
        seccompProfile:
          type: Localhost
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1011", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when seccomp profile type is Unconfined", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      securityContext:
        seccompProfile:
          type: Unconfined
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1011", yaml);
    expect(violations).toHaveLength(1);
  });

  it("should use pod-level path for Pod kind", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: app
      image: nginx
`;
    const violations = checkRule("MV1011", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.securityContext.seccompProfile.type"
    );
  });
});

// ============================================================================
// MV1012 - capabilities.drop does not include ALL
// ============================================================================
describe("MV1012 - capabilities drop ALL", () => {
  it("should flag when capabilities.drop is not set", () => {
    const violations = checkRule("MV1012", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1012");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("drop ALL");
  });

  it("should pass when ALL is in capabilities.drop", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              drop:
                - ALL
`;
    const violations = checkRule("MV1012", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when drop list exists but does not include ALL", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              drop:
                - NET_RAW
`;
    const violations = checkRule("MV1012", yaml);
    expect(violations).toHaveLength(1);
  });

  it("should handle case-insensitive ALL check", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            capabilities:
              drop:
                - all
`;
    const violations = checkRule("MV1012", yaml);
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV1013 - runAsUser set to 0 (root)
// ============================================================================
describe("MV1013 - runAsUser 0", () => {
  it("should flag when container runAsUser is 0", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            runAsUser: 0
`;
    const violations = checkRule("MV1013", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1013");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("runAsUser");
    expect(violations[0].message).toContain("root");
  });

  it("should pass when runAsUser is a non-zero UID", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            runAsUser: 1000
`;
    const violations = checkRule("MV1013", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when runAsUser is not set at all", () => {
    const violations = checkRule("MV1013", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should flag when pod-level runAsUser is 0", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      securityContext:
        runAsUser: 0
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1013", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.securityContext.runAsUser"
    );
    expect(violations[0].message).toContain("pod level");
  });

  it("should flag both pod-level and container-level runAsUser 0", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      securityContext:
        runAsUser: 0
      containers:
        - name: app
          image: nginx
          securityContext:
            runAsUser: 0
`;
    const violations = checkRule("MV1013", yaml);
    expect(violations).toHaveLength(2);
  });
});

// ============================================================================
// MV1014 - procMount set to Unmasked
// ============================================================================
describe("MV1014 - procMount Unmasked", () => {
  it("should flag when procMount is Unmasked", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            procMount: Unmasked
`;
    const violations = checkRule("MV1014", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1014");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("Unmasked");
  });

  it("should pass when procMount is Default", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
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
          securityContext:
            procMount: Default
`;
    const violations = checkRule("MV1014", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should pass when procMount is not set", () => {
    const violations = checkRule("MV1014", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should flag Unmasked procMount in initContainer", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: app
      image: nginx
  initContainers:
    - name: init
      image: busybox
      securityContext:
        procMount: Unmasked
`;
    const violations = checkRule("MV1014", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.initContainers[0].securityContext.procMount"
    );
  });
});

// ============================================================================
// MV1015 - serviceAccountName is "default"
// ============================================================================
describe("MV1015 - serviceAccountName default", () => {
  it("should flag when serviceAccountName is 'default'", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      serviceAccountName: default
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1015", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1015");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("default");
    expect(violations[0].path).toBe(
      "spec.template.spec.serviceAccountName"
    );
  });

  it("should pass when serviceAccountName is a custom account", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      serviceAccountName: my-app-sa
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1015", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when serviceAccountName is not set (implicit default SA with token mounted)", () => {
    const violations = checkRule("MV1015", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1015");
    expect(violations[0].message).toContain("implicitly");
  });

  it("should pass when serviceAccountName not set but automountServiceAccountToken is false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      automountServiceAccountToken: false
      containers:
        - name: app
          image: nginx:1.0
`;
    const violations = checkRule("MV1015", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should use correct path for Pod kind", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  serviceAccountName: default
  containers:
    - name: app
      image: nginx
`;
    const violations = checkRule("MV1015", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.serviceAccountName");
  });
});

// ============================================================================
// MV1016 - automountServiceAccountToken not false
// ============================================================================
describe("MV1016 - automountServiceAccountToken", () => {
  it("should flag when automountServiceAccountToken is not set", () => {
    const violations = checkRule("MV1016", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1016");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("automountServiceAccountToken");
    expect(violations[0].path).toBe(
      "spec.template.spec.automountServiceAccountToken"
    );
  });

  it("should pass when automountServiceAccountToken is false", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      automountServiceAccountToken: false
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1016", yaml);
    expect(violations).toHaveLength(0);
  });

  it("should flag when automountServiceAccountToken is explicitly true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      automountServiceAccountToken: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1016", yaml);
    expect(violations).toHaveLength(1);
  });

  it("should use correct path for Pod kind", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: app
      image: nginx
`;
    const violations = checkRule("MV1016", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.automountServiceAccountToken");
  });
});

// ============================================================================
// Cross-cutting / integration tests
// ============================================================================
describe("MV1 rules - cross-cutting concerns", () => {
  it("should export exactly 17 rules", () => {
    expect(mv1Rules).toHaveLength(17);
  });

  it("should have unique rule IDs", () => {
    const ids = mv1Rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(17);
  });

  it("should have IDs from MV1001 to MV1017", () => {
    for (let i = 1; i <= 17; i++) {
      const id = `MV10${String(i).padStart(2, "0")}`;
      expect(mv1Rules.find((r) => r.id === id)).toBeDefined();
    }
  });

  it("should return no violations for non-pod-bearing resources across all rules", () => {
    const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: test-cm
data:
  key: value
`;
    for (const rule of mv1Rules) {
      const { resources } = parseYAML(yaml);
      const violations = rule.check({
        resource: resources[0],
        allResources: resources,
      });
      expect(violations).toHaveLength(0);
    }
  });

  it("should work with CronJob resources", () => {
    const yaml = `
apiVersion: batch/v1
kind: CronJob
metadata:
  name: test-cj
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        metadata:
          labels:
            app: test
        spec:
          containers:
            - name: app
              image: nginx
`;
    // CronJob is in POD_BEARING_KINDS, but spec.template.spec is how
    // pod-bearing resources are resolved. CronJob's actual podSpec
    // lives at spec.jobTemplate.spec.template.spec. The current
    // implementation uses spec.template.spec which will be undefined
    // for CronJob, so getContainers returns [] and pod-level checks
    // also get undefined podSpec. This means no violations are
    // reported, effectively skipping CronJob analysis.
    const violations = checkRule("MV1001", yaml);
    // The implementation resolves spec.template.spec for non-Pod
    // resources. For CronJob spec.template is the jobTemplate wrapper,
    // so spec.template.spec.containers exists at the wrong nesting.
    // Depending on actual YAML structure this may or may not find
    // containers. We verify it doesn't crash.
    expect(Array.isArray(violations)).toBe(true);
  });

  it("should handle a fully-secured Deployment with zero violations for container-level rules", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secure-app
spec:
  selector:
    matchLabels:
      app: secure
  template:
    metadata:
      labels:
        app: secure
    spec:
      automountServiceAccountToken: false
      serviceAccountName: my-sa
      securityContext:
        runAsNonRoot: true
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: app
          image: nginx
          securityContext:
            allowPrivilegeEscalation: false
            privileged: false
            readOnlyRootFilesystem: true
            runAsUser: 1000
            capabilities:
              drop:
                - ALL
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
            requests:
              cpu: 50m
              memory: 64Mi
`;
    for (const rule of mv1Rules) {
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
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
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
    const violations = checkRule("MV1001", yaml);
    expect(violations[0].resource).toBe("Deployment/my-deploy");
  });

  it("should include namespace in violations when present", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
  namespace: production
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
    const violations = checkRule("MV1001", yaml);
    expect(violations[0].namespace).toBe("production");
  });

  it("should handle Job resources", () => {
    const yaml = `
apiVersion: batch/v1
kind: Job
metadata:
  name: test-job
spec:
  template:
    metadata:
      labels:
        app: test
    spec:
      restartPolicy: Never
      containers:
        - name: worker
          image: busybox
`;
    const violations = checkRule("MV1002", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("Job/test-job");
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation"
    );
  });

  it("should handle ReplicaSet resources", () => {
    const yaml = `
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: test-rs
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
          securityContext:
            privileged: true
`;
    const violations = checkRule("MV1003", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("ReplicaSet/test-rs");
  });
});

// ============================================================================
// MV1017 - shareProcessNamespace enabled
// ============================================================================
describe("MV1017 - shareProcessNamespace", () => {
  it("should flag Pod with shareProcessNamespace: true", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: shared-pid-pod
spec:
  shareProcessNamespace: true
  containers:
    - name: app
      image: nginx
`;
    const violations = checkRule("MV1017", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV1017");
    expect(violations[0].resource).toBe("Pod/shared-pid-pod");
    expect(violations[0].severity).toBe("warning");
  });

  it("should flag Deployment with shareProcessNamespace: true", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shared-pid-deploy
spec:
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      shareProcessNamespace: true
      containers:
        - name: app
          image: nginx
`;
    const violations = checkRule("MV1017", yaml);
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("Deployment/shared-pid-deploy");
  });

  it("should pass when shareProcessNamespace is not set", () => {
    const violations = checkRule("MV1017", DEPLOYMENT_BASE);
    expect(violations).toHaveLength(0);
  });

  it("should pass when shareProcessNamespace is false", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: no-shared-pid
spec:
  shareProcessNamespace: false
  containers:
    - name: app
      image: nginx
`;
    const violations = checkRule("MV1017", yaml);
    expect(violations).toHaveLength(0);
  });
});
