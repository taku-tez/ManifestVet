import { describe, it, expect } from "vitest";
import { mv3Rules } from "../../src/rules/mv3";
import { parseYAML } from "../../src/parser/parser";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function checkRule(ruleId: string, yaml: string) {
  const { resources } = parseYAML(yaml);
  const rule = mv3Rules.find((r) => r.id === ruleId)!;
  return rule.check({ resource: resources[0], allResources: resources });
}

// ============================================================================
// MV3001 - Service type NodePort
// ============================================================================
describe("MV3001 - Service type NodePort", () => {
  it("should flag a Service with type NodePort", () => {
    const violations = checkRule(
      "MV3001",
      `
apiVersion: v1
kind: Service
metadata:
  name: my-svc
spec:
  type: NodePort
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3001");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("my-svc");
    expect(violations[0].message).toContain("NodePort");
    expect(violations[0].path).toBe("spec.type");
    expect(violations[0].resource).toBe("Service/my-svc");
  });

  it("should pass for a Service with type ClusterIP", () => {
    const violations = checkRule(
      "MV3001",
      `
apiVersion: v1
kind: Service
metadata:
  name: internal-svc
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass for a Service with no explicit type (defaults to ClusterIP)", () => {
    const violations = checkRule(
      "MV3001",
      `
apiVersion: v1
kind: Service
metadata:
  name: default-svc
spec:
  selector:
    app: web
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-Service resources", () => {
    const violations = checkRule(
      "MV3001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
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
        - name: app
          image: nginx
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass for a Service with type LoadBalancer", () => {
    const violations = checkRule(
      "MV3001",
      `
apiVersion: v1
kind: Service
metadata:
  name: lb-svc
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 443
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV3002 - hostPort set in container ports
// ============================================================================
describe("MV3002 - hostPort in containers", () => {
  it("should flag a Pod container that sets hostPort", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: host-pod
spec:
  containers:
    - name: web
      image: nginx
      ports:
        - containerPort: 80
          hostPort: 8080
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3002");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("web");
    expect(violations[0].message).toContain("8080");
    expect(violations[0].path).toBe("spec.containers[0].ports[0].hostPort");
    expect(violations[0].resource).toBe("Pod/host-pod");
  });

  it("should pass when no hostPort is set", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: clean-pod
spec:
  containers:
    - name: web
      image: nginx
      ports:
        - containerPort: 80
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag hostPort in a Deployment container", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
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
        - name: app
          image: nginx
          ports:
            - containerPort: 80
              hostPort: 9090
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].ports[0].hostPort",
    );
    expect(violations[0].message).toContain("9090");
  });

  it("should flag hostPort in initContainers", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-pod
spec:
  initContainers:
    - name: init
      image: busybox
      ports:
        - containerPort: 3000
          hostPort: 3000
  containers:
    - name: main
      image: nginx
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.initContainers[0].ports[0].hostPort",
    );
    expect(violations[0].message).toContain("init");
  });

  it("should flag multiple containers with hostPort in the same Pod", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-pod
spec:
  containers:
    - name: web
      image: nginx
      ports:
        - containerPort: 80
          hostPort: 8080
    - name: sidecar
      image: envoy
      ports:
        - containerPort: 15000
          hostPort: 15000
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.containers[0].ports[0].hostPort");
    expect(violations[1].path).toBe("spec.containers[1].ports[0].hostPort");
  });

  it("should flag multiple hostPort entries in a single container", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-port-pod
spec:
  containers:
    - name: web
      image: nginx
      ports:
        - containerPort: 80
          hostPort: 8080
        - containerPort: 443
          hostPort: 8443
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.containers[0].ports[0].hostPort");
    expect(violations[1].path).toBe("spec.containers[0].ports[1].hostPort");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: v1
kind: Service
metadata:
  name: svc
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when containers have ports but no hostPort", () => {
    const violations = checkRule(
      "MV3002",
      `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-sts
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
          image: postgres
          ports:
            - containerPort: 5432
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV3003 - NetworkPolicy allows all ingress
// ============================================================================
describe("MV3003 - NetworkPolicy allows all ingress", () => {
  it("should flag ingress rule with empty from array", () => {
    const violations = checkRule(
      "MV3003",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all-ingress
spec:
  podSelector: {}
  ingress:
    - from: []
  policyTypes:
    - Ingress
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3003");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("allow-all-ingress");
    expect(violations[0].message).toContain("empty array");
    expect(violations[0].path).toBe("spec.ingress[0].from");
  });

  it("should flag ingress rule with from containing an empty object", () => {
    const violations = checkRule(
      "MV3003",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: wide-open
spec:
  podSelector: {}
  ingress:
    - from:
        - {}
  policyTypes:
    - Ingress
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3003");
    expect(violations[0].message).toContain("empty object");
    expect(violations[0].path).toBe("spec.ingress[0].from");
  });

  it("should pass when ingress has explicit source selectors", () => {
    const violations = checkRule(
      "MV3003",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restricted
spec:
  podSelector:
    matchLabels:
      app: web
  ingress:
    - from:
        - podSelector:
            matchLabels:
              role: frontend
  policyTypes:
    - Ingress
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag ingress rule with no from field (allows all sources per K8s semantics)", () => {
    const violations = checkRule(
      "MV3003",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: no-from
spec:
  podSelector: {}
  ingress:
    - ports:
        - protocol: TCP
          port: 80
  policyTypes:
    - Ingress
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3003");
    expect(violations[0].path).toBe("spec.ingress[0]");
    expect(violations[0].message).toContain("no from field");
  });

  it("should not flag non-NetworkPolicy resources", () => {
    const violations = checkRule(
      "MV3003",
      `
apiVersion: v1
kind: Service
metadata:
  name: svc
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple ingress rules that allow all", () => {
    const violations = checkRule(
      "MV3003",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: double-open
spec:
  podSelector: {}
  ingress:
    - from: []
    - from:
        - {}
  policyTypes:
    - Ingress
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.ingress[0].from");
    expect(violations[0].message).toContain("empty array");
    expect(violations[1].path).toBe("spec.ingress[1].from");
    expect(violations[1].message).toContain("empty object");
  });

  it("should pass when no ingress rules are defined", () => {
    const violations = checkRule(
      "MV3003",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: no-ingress
spec:
  podSelector: {}
  policyTypes:
    - Egress
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV3004 - NetworkPolicy allows all egress
// ============================================================================
describe("MV3004 - NetworkPolicy allows all egress", () => {
  it("should flag egress rule with empty to array", () => {
    const violations = checkRule(
      "MV3004",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all-egress
spec:
  podSelector: {}
  egress:
    - to: []
  policyTypes:
    - Egress
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3004");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("allow-all-egress");
    expect(violations[0].message).toContain("empty array");
    expect(violations[0].path).toBe("spec.egress[0].to");
  });

  it("should flag egress rule with to containing an empty object", () => {
    const violations = checkRule(
      "MV3004",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: egress-open
spec:
  podSelector: {}
  egress:
    - to:
        - {}
  policyTypes:
    - Egress
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3004");
    expect(violations[0].message).toContain("empty object");
    expect(violations[0].path).toBe("spec.egress[0].to");
  });

  it("should pass when egress has explicit destination selectors", () => {
    const violations = checkRule(
      "MV3004",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restricted-egress
spec:
  podSelector:
    matchLabels:
      app: backend
  egress:
    - to:
        - ipBlock:
            cidr: 10.0.0.0/8
  policyTypes:
    - Egress
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag egress rule with no to field (allows all destinations per K8s semantics)", () => {
    const violations = checkRule(
      "MV3004",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: no-to
spec:
  podSelector: {}
  egress:
    - ports:
        - protocol: TCP
          port: 53
  policyTypes:
    - Egress
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3004");
    expect(violations[0].path).toBe("spec.egress[0]");
    expect(violations[0].message).toContain("no to field");
  });

  it("should not flag non-NetworkPolicy resources", () => {
    const violations = checkRule(
      "MV3004",
      `
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
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple egress rules that allow all", () => {
    const violations = checkRule(
      "MV3004",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: double-egress
spec:
  podSelector: {}
  egress:
    - to: []
    - to:
        - {}
  policyTypes:
    - Egress
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.egress[0].to");
    expect(violations[1].path).toBe("spec.egress[1].to");
  });

  it("should pass when no egress rules are defined", () => {
    const violations = checkRule(
      "MV3004",
      `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: no-egress
spec:
  podSelector: {}
  policyTypes:
    - Ingress
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV3005 - LoadBalancer without externalTrafficPolicy: Local
// ============================================================================
describe("MV3005 - LoadBalancer without externalTrafficPolicy Local", () => {
  it("should flag LoadBalancer Service without externalTrafficPolicy", () => {
    const violations = checkRule(
      "MV3005",
      `
apiVersion: v1
kind: Service
metadata:
  name: my-lb
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 443
      targetPort: 8443
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3005");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("my-lb");
    expect(violations[0].message).toContain("LoadBalancer");
    expect(violations[0].path).toBe("spec.externalTrafficPolicy");
    expect(violations[0].resource).toBe("Service/my-lb");
  });

  it("should flag LoadBalancer with externalTrafficPolicy set to Cluster", () => {
    const violations = checkRule(
      "MV3005",
      `
apiVersion: v1
kind: Service
metadata:
  name: cluster-lb
spec:
  type: LoadBalancer
  externalTrafficPolicy: Cluster
  selector:
    app: web
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3005");
    expect(violations[0].message).toContain("cluster-lb");
  });

  it("should pass when LoadBalancer has externalTrafficPolicy Local", () => {
    const violations = checkRule(
      "MV3005",
      `
apiVersion: v1
kind: Service
metadata:
  name: local-lb
spec:
  type: LoadBalancer
  externalTrafficPolicy: Local
  selector:
    app: web
  ports:
    - port: 443
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag ClusterIP Services", () => {
    const violations = checkRule(
      "MV3005",
      `
apiVersion: v1
kind: Service
metadata:
  name: cluster-svc
spec:
  type: ClusterIP
  selector:
    app: web
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag NodePort Services", () => {
    const violations = checkRule(
      "MV3005",
      `
apiVersion: v1
kind: Service
metadata:
  name: np-svc
spec:
  type: NodePort
  selector:
    app: web
  ports:
    - port: 80
      nodePort: 30000
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-Service resources", () => {
    const violations = checkRule(
      "MV3005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: app
      image: nginx
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should include namespace in violation when present", () => {
    const violations = checkRule(
      "MV3005",
      `
apiVersion: v1
kind: Service
metadata:
  name: namespaced-lb
  namespace: production
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
    - port: 443
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("production");
  });
});

// ============================================================================
// MV3006 - Pod with hostAliases
// ============================================================================
describe("MV3006 - hostAliases in pods", () => {
  it("should flag a Pod with hostAliases", () => {
    const violations = checkRule(
      "MV3006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: alias-pod
spec:
  hostAliases:
    - ip: "127.0.0.1"
      hostnames:
        - "foo.local"
  containers:
    - name: app
      image: nginx
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3006");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("alias-pod");
    expect(violations[0].message).toContain("hostAliases");
    expect(violations[0].path).toBe("spec.hostAliases");
    expect(violations[0].resource).toBe("Pod/alias-pod");
  });

  it("should pass when no hostAliases are set", () => {
    const violations = checkRule(
      "MV3006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: clean-pod
spec:
  containers:
    - name: app
      image: nginx
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag hostAliases in a Deployment", () => {
    const violations = checkRule(
      "MV3006",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploy-alias
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      hostAliases:
        - ip: "10.0.0.1"
          hostnames:
            - "db.local"
      containers:
        - name: app
          image: nginx
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.template.spec.hostAliases");
    expect(violations[0].resource).toBe("Deployment/deploy-alias");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV3006",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  key: value
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when hostAliases is an empty array", () => {
    const violations = checkRule(
      "MV3006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: empty-aliases
spec:
  hostAliases: []
  containers:
    - name: app
      image: nginx
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag hostAliases with multiple entries", () => {
    const violations = checkRule(
      "MV3006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-alias
spec:
  hostAliases:
    - ip: "10.0.0.1"
      hostnames:
        - "db.local"
    - ip: "10.0.0.2"
      hostnames:
        - "cache.local"
  containers:
    - name: app
      image: nginx
`,
    );
    // Only one violation per resource, not per hostAlias entry
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3006");
  });

  it("should flag hostAliases in a DaemonSet", () => {
    const violations = checkRule(
      "MV3006",
      `
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: ds-alias
spec:
  selector:
    matchLabels:
      app: agent
  template:
    metadata:
      labels:
        app: agent
    spec:
      hostAliases:
        - ip: "192.168.1.1"
          hostnames:
            - "custom.host"
      containers:
        - name: agent
          image: agent:latest
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.template.spec.hostAliases");
    expect(violations[0].resource).toBe("DaemonSet/ds-alias");
  });
});

// ============================================================================
// MV3007 - Ingress without TLS configured
// ============================================================================
describe("MV3007 - Ingress without TLS", () => {
  it("should flag an Ingress without TLS", () => {
    const violations = checkRule(
      "MV3007",
      `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: no-tls-ingress
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3007");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("no-tls-ingress");
    expect(violations[0].message).toContain("TLS");
    expect(violations[0].path).toBe("spec.tls");
    expect(violations[0].resource).toBe("Ingress/no-tls-ingress");
  });

  it("should pass when Ingress has TLS configured", () => {
    const violations = checkRule(
      "MV3007",
      `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-ingress
spec:
  tls:
    - hosts:
        - example.com
      secretName: example-tls
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 443
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag an Ingress with an empty tls array", () => {
    const violations = checkRule(
      "MV3007",
      `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: empty-tls
spec:
  tls: []
  rules:
    - host: example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV3007");
    expect(violations[0].path).toBe("spec.tls");
  });

  it("should not flag non-Ingress resources", () => {
    const violations = checkRule(
      "MV3007",
      `
apiVersion: v1
kind: Service
metadata:
  name: svc
spec:
  type: ClusterIP
  ports:
    - port: 80
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when Ingress has multiple TLS entries", () => {
    const violations = checkRule(
      "MV3007",
      `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: multi-tls
spec:
  tls:
    - hosts:
        - app1.example.com
      secretName: app1-tls
    - hosts:
        - app2.example.com
      secretName: app2-tls
  rules:
    - host: app1.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app1
                port:
                  number: 443
    - host: app2.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: app2
                port:
                  number: 443
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should include namespace in violation when present", () => {
    const violations = checkRule(
      "MV3007",
      `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ns-ingress
  namespace: staging
spec:
  rules:
    - host: staging.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("staging");
  });
});
