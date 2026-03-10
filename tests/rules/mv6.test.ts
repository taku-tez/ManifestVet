import { describe, it, expect } from "vitest";
import { mv6Rules } from "../../src/rules/mv6";
import { parseYAML } from "../../src/parser/parser";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function checkRule(ruleId: string, yaml: string) {
  const { resources } = parseYAML(yaml);
  const rule = mv6Rules.find((r) => r.id === ruleId)!;
  return rule.check({ resource: resources[0], allResources: resources });
}

// ============================================================================
// MV6001 - Deployment/StatefulSet missing recommended labels
// ============================================================================
describe("MV6001 - Missing recommended labels", () => {
  it("should flag a Deployment with no metadata.labels at all", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-labels-deploy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6001");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("no metadata.labels");
    expect(violations[0].message).toContain("no-labels-deploy");
    expect(violations[0].path).toBe("metadata.labels");
    expect(violations[0].resource).toBe("Deployment/no-labels-deploy");
  });

  it("should flag a Deployment with labels but none of the recommended ones", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: custom-labels-deploy
  labels:
    team: backend
    env: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6001");
    expect(violations[0].message).toContain("missing all recommended labels");
    expect(violations[0].path).toBe("metadata.labels");
  });

  it("should pass when Deployment has at least one recommended label (app.kubernetes.io/name)", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: labeled-deploy
  labels:
    app.kubernetes.io/name: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when Deployment has app.kubernetes.io/version label", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: versioned-deploy
  labels:
    app.kubernetes.io/version: "1.0.0"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when Deployment has app.kubernetes.io/managed-by label", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: managed-deploy
  labels:
    app.kubernetes.io/managed-by: helm
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag a StatefulSet with no recommended labels", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: no-labels-sts
  labels:
    team: infra
spec:
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: db
          image: postgres:15
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("StatefulSet/no-labels-sts");
    expect(violations[0].message).toContain("StatefulSet");
  });

  it("should not flag a Service (non-Deployment/StatefulSet kind)", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag a DaemonSet", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: my-ds
spec:
  selector:
    matchLabels:
      app: agent
  template:
    metadata:
      labels:
        app: agent
    spec:
      containers:
        - name: agent
          image: agent:1.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should include namespace in violation when present", () => {
    const violations = checkRule(
      "MV6001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ns-deploy
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("production");
  });
});

// ============================================================================
// MV6002 - Deployment with replicas: 1 (no HA)
// ============================================================================
describe("MV6002 - Deployment with replicas: 1", () => {
  it("should flag a Deployment with replicas explicitly set to 1", () => {
    const violations = checkRule(
      "MV6002",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: single-replica
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6002");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("replicas set to 1");
    expect(violations[0].resource).toBe("Deployment/single-replica");
    expect(violations[0].path).toBe("spec.replicas");
  });

  it("should flag a Deployment with no replicas specified (defaults to 1)", () => {
    const violations = checkRule(
      "MV6002",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-replicas
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("no replicas specified");
    expect(violations[0].message).toContain("defaults to 1");
  });

  it("should pass when Deployment has replicas >= 2", () => {
    const violations = checkRule(
      "MV6002",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ha-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when Deployment has replicas set to 2", () => {
    const violations = checkRule(
      "MV6002",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: two-replicas
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag a StatefulSet with replicas: 1", () => {
    const violations = checkRule(
      "MV6002",
      `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: single-sts
spec:
  replicas: 1
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: db
          image: postgres:15
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-Deployment resources", () => {
    const violations = checkRule(
      "MV6002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV6003 - Containers missing livenessProbe
// ============================================================================
describe("MV6003 - Missing livenessProbe", () => {
  it("should flag a container without a livenessProbe", () => {
    const violations = checkRule(
      "MV6003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-liveness
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6003");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("livenessProbe");
    expect(violations[0].path).toBe("spec.containers[0].livenessProbe");
    expect(violations[0].resource).toBe("Pod/no-liveness");
  });

  it("should pass when container has a livenessProbe", () => {
    const violations = checkRule(
      "MV6003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: with-liveness
spec:
  containers:
    - name: app
      image: myapp:1.0
      livenessProbe:
        httpGet:
          path: /healthz
          port: 8080
        initialDelaySeconds: 10
        periodSeconds: 5
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple containers each missing livenessProbe", () => {
    const violations = checkRule(
      "MV6003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-container
spec:
  containers:
    - name: app
      image: myapp:1.0
    - name: sidecar
      image: envoy:1.28
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.containers[0].livenessProbe");
    expect(violations[1].path).toBe("spec.containers[1].livenessProbe");
  });

  it("should flag missing livenessProbe in Deployment containers", () => {
    const violations = checkRule(
      "MV6003",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploy-no-liveness
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].livenessProbe",
    );
    expect(violations[0].resource).toBe("Deployment/deploy-no-liveness");
  });

  it("should flag initContainers missing livenessProbe", () => {
    const violations = checkRule(
      "MV6003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-no-liveness
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
  containers:
    - name: app
      image: myapp:1.0
      livenessProbe:
        tcpSocket:
          port: 8080
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].livenessProbe");
    expect(violations[0].message).toContain("setup");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV6003",
      `
apiVersion: v1
kind: Service
metadata:
  name: my-svc
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV6004 - Containers missing readinessProbe
// ============================================================================
describe("MV6004 - Missing readinessProbe", () => {
  it("should flag a container without a readinessProbe", () => {
    const violations = checkRule(
      "MV6004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-readiness
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6004");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("readinessProbe");
    expect(violations[0].path).toBe("spec.containers[0].readinessProbe");
    expect(violations[0].resource).toBe("Pod/no-readiness");
  });

  it("should pass when container has a readinessProbe", () => {
    const violations = checkRule(
      "MV6004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: with-readiness
spec:
  containers:
    - name: app
      image: myapp:1.0
      readinessProbe:
        httpGet:
          path: /ready
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple containers each missing readinessProbe", () => {
    const violations = checkRule(
      "MV6004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-no-readiness
spec:
  containers:
    - name: app
      image: myapp:1.0
    - name: sidecar
      image: envoy:1.28
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.containers[0].readinessProbe");
    expect(violations[1].path).toBe("spec.containers[1].readinessProbe");
  });

  it("should flag missing readinessProbe in Deployment containers", () => {
    const violations = checkRule(
      "MV6004",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploy-no-readiness
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].readinessProbe",
    );
    expect(violations[0].resource).toBe("Deployment/deploy-no-readiness");
  });

  it("should flag initContainers missing readinessProbe", () => {
    const violations = checkRule(
      "MV6004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-no-readiness
spec:
  initContainers:
    - name: init
      image: busybox:1.36
  containers:
    - name: app
      image: myapp:1.0
      readinessProbe:
        exec:
          command:
            - cat
            - /tmp/healthy
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].readinessProbe");
    expect(violations[0].message).toContain("init");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV6004",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-cm
data:
  key: value
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV6005 - Deployment missing podAntiAffinity
// ============================================================================
describe("MV6005 - Missing podAntiAffinity", () => {
  it("should flag a Deployment without any affinity defined", () => {
    const violations = checkRule(
      "MV6005",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-affinity
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6005");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("no-affinity");
    expect(violations[0].message).toContain("podAntiAffinity");
    expect(violations[0].path).toBe(
      "spec.template.spec.affinity.podAntiAffinity",
    );
    expect(violations[0].resource).toBe("Deployment/no-affinity");
  });

  it("should flag a Deployment with affinity but no podAntiAffinity", () => {
    const violations = checkRule(
      "MV6005",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-affinity-only
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
              - matchExpressions:
                  - key: kubernetes.io/os
                    operator: In
                    values:
                      - linux
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6005");
  });

  it("should pass when Deployment has podAntiAffinity defined", () => {
    const violations = checkRule(
      "MV6005",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: with-anti-affinity
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - web
                topologyKey: kubernetes.io/hostname
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag a StatefulSet (only Deployment)", () => {
    const violations = checkRule(
      "MV6005",
      `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-sts
spec:
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: db
          image: postgres:15
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag a Pod", () => {
    const violations = checkRule(
      "MV6005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should include namespace when present", () => {
    const violations = checkRule(
      "MV6005",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ns-deploy
  namespace: staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("staging");
  });
});

// ============================================================================
// MV6006 - Deployment without rollingUpdate strategy
// ============================================================================
describe("MV6006 - No rollingUpdate strategy", () => {
  it("should flag a Deployment with no strategy defined at all", () => {
    const violations = checkRule(
      "MV6006",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-strategy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6006");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("does not define a deployment strategy");
    expect(violations[0].path).toBe("spec.strategy");
    expect(violations[0].resource).toBe("Deployment/no-strategy");
  });

  it("should flag a Deployment with strategy type Recreate", () => {
    const violations = checkRule(
      "MV6006",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: recreate-deploy
spec:
  replicas: 3
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("Recreate");
    expect(violations[0].path).toBe("spec.strategy.type");
  });

  it("should pass when strategy type is RollingUpdate", () => {
    const violations = checkRule(
      "MV6006",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rolling-deploy
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when strategy type is RollingUpdate without rollingUpdate config", () => {
    const violations = checkRule(
      "MV6006",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rolling-no-config
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when rollingUpdate config exists without explicit type", () => {
    const violations = checkRule(
      "MV6006",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: implicit-rolling
spec:
  replicas: 3
  strategy:
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag a StatefulSet", () => {
    const violations = checkRule(
      "MV6006",
      `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-sts
spec:
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: db
          image: postgres:15
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV6007 - Containers missing lifecycle.preStop hook
// ============================================================================
describe("MV6007 - Missing preStop hook", () => {
  it("should flag a container without a lifecycle.preStop hook", () => {
    const violations = checkRule(
      "MV6007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-prestop
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6007");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("preStop");
    expect(violations[0].path).toBe("spec.containers[0].lifecycle.preStop");
    expect(violations[0].resource).toBe("Pod/no-prestop");
  });

  it("should pass when container has a lifecycle.preStop hook", () => {
    const violations = checkRule(
      "MV6007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: with-prestop
spec:
  containers:
    - name: app
      image: myapp:1.0
      lifecycle:
        preStop:
          exec:
            command:
              - /bin/sh
              - -c
              - sleep 10
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag container with lifecycle but no preStop", () => {
    const violations = checkRule(
      "MV6007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: lifecycle-no-prestop
spec:
  containers:
    - name: app
      image: myapp:1.0
      lifecycle:
        postStart:
          exec:
            command:
              - /bin/sh
              - -c
              - echo started
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6007");
    expect(violations[0].message).toContain("app");
  });

  it("should flag multiple containers missing preStop in a Deployment", () => {
    const violations = checkRule(
      "MV6007",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploy-no-prestop
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
        - name: sidecar
          image: envoy:1.28
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].lifecycle.preStop",
    );
    expect(violations[1].path).toBe(
      "spec.template.spec.containers[1].lifecycle.preStop",
    );
  });

  it("should flag initContainers missing preStop", () => {
    const violations = checkRule(
      "MV6007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-no-prestop
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
  containers:
    - name: app
      image: myapp:1.0
      lifecycle:
        preStop:
          exec:
            command:
              - sleep
              - "5"
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].lifecycle.preStop");
    expect(violations[0].message).toContain("setup");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV6007",
      `
apiVersion: v1
kind: Service
metadata:
  name: my-svc
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV6008 - Namespace is "default"
// ============================================================================
describe("MV6008 - Default namespace", () => {
  it("should flag a resource in the default namespace", () => {
    const violations = checkRule(
      "MV6008",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: default-ns-deploy
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6008");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("default");
    expect(violations[0].message).toContain("default-ns-deploy");
    expect(violations[0].path).toBe("metadata.namespace");
    expect(violations[0].resource).toBe("Deployment/default-ns-deploy");
    expect(violations[0].namespace).toBe("default");
  });

  it("should pass when resource is in a non-default namespace", () => {
    const violations = checkRule(
      "MV6008",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prod-deploy
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when resource has no namespace specified", () => {
    const violations = checkRule(
      "MV6008",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-ns-deploy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag a Pod in the default namespace", () => {
    const violations = checkRule(
      "MV6008",
      `
apiVersion: v1
kind: Pod
metadata:
  name: default-pod
  namespace: default
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("Pod/default-pod");
  });

  it("should flag a Service in the default namespace", () => {
    const violations = checkRule(
      "MV6008",
      `
apiVersion: v1
kind: Service
metadata:
  name: default-svc
  namespace: default
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("Service/default-svc");
  });

  it("should flag a ConfigMap in the default namespace", () => {
    const violations = checkRule(
      "MV6008",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: default-cm
  namespace: default
data:
  key: value
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("ConfigMap/default-cm");
  });
});

// ============================================================================
// MV6009 - metadata.name missing or empty
// ============================================================================
describe("MV6009 - Missing or empty metadata.name", () => {
  it("should flag a resource with empty metadata.name", () => {
    const violations = checkRule(
      "MV6009",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ""
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6009");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("missing or empty metadata.name");
    expect(violations[0].path).toBe("metadata.name");
    expect(violations[0].resource).toBe("Deployment/");
  });

  it("should pass when resource has a valid metadata.name", () => {
    const violations = checkRule(
      "MV6009",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag a resource with no metadata.name field (parser defaults to empty string)", () => {
    // The parser sets name to obj.metadata?.name ?? "" so a missing name becomes ""
    const violations = checkRule(
      "MV6009",
      `
apiVersion: v1
kind: Pod
metadata:
  namespace: production
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6009");
    expect(violations[0].message).toContain("Pod");
    expect(violations[0].message).toContain("missing or empty metadata.name");
  });

  it("should flag any kind of resource with missing name", () => {
    const violations = checkRule(
      "MV6009",
      `
apiVersion: v1
kind: Service
metadata:
  name: ""
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].resource).toBe("Service/");
    expect(violations[0].message).toContain("Service");
  });

  it("should include namespace in violation when present", () => {
    const violations = checkRule(
      "MV6009",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: ""
  namespace: kube-system
data:
  key: value
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("kube-system");
  });
});

// ============================================================================
// MV6010 - Deployment without minReadySeconds
// ============================================================================
describe("MV6010 - No minReadySeconds", () => {
  it("should flag a Deployment with no minReadySeconds", () => {
    const violations = checkRule(
      "MV6010",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-min-ready
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6010");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("no-min-ready");
    expect(violations[0].message).toContain("minReadySeconds");
    expect(violations[0].path).toBe("spec.minReadySeconds");
    expect(violations[0].resource).toBe("Deployment/no-min-ready");
  });

  it("should flag a Deployment with minReadySeconds set to 0", () => {
    const violations = checkRule(
      "MV6010",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zero-min-ready
spec:
  replicas: 3
  minReadySeconds: 0
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV6010");
    expect(violations[0].message).toContain("set to 0");
  });

  it("should pass when Deployment has a positive minReadySeconds", () => {
    const violations = checkRule(
      "MV6010",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: with-min-ready
spec:
  replicas: 3
  minReadySeconds: 10
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass with a large minReadySeconds value", () => {
    const violations = checkRule(
      "MV6010",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: large-min-ready
spec:
  replicas: 3
  minReadySeconds: 300
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag a StatefulSet without minReadySeconds", () => {
    const violations = checkRule(
      "MV6010",
      `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: sts-no-min-ready
spec:
  replicas: 3
  selector:
    matchLabels:
      app: db
  template:
    metadata:
      labels:
        app: db
    spec:
      containers:
        - name: db
          image: postgres:15
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag a Pod", () => {
    const violations = checkRule(
      "MV6010",
      `
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should include namespace in violation when present", () => {
    const violations = checkRule(
      "MV6010",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ns-deploy
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx:1.25
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("production");
  });
});
