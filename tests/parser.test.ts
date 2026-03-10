import { describe, it, expect } from "vitest";
import { parseYAML, parseMultipleFiles } from "../src/parser/parser";

describe("parseYAML", () => {
  // ---------------------------------------------------------------
  // 1. Parse single Deployment
  // ---------------------------------------------------------------
  it("should parse a single Deployment resource", () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:1.25
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const dep = result.resources[0];
    expect(dep.apiVersion).toBe("apps/v1");
    expect(dep.kind).toBe("Deployment");
    expect(dep.metadata.name).toBe("my-app");
    expect(dep.spec).toBeDefined();
    expect(dep.spec.replicas).toBe(3);
    expect(dep.spec.selector.matchLabels.app).toBe("my-app");
    expect(dep.spec.template.spec.containers[0].image).toBe("nginx:1.25");
  });

  // ---------------------------------------------------------------
  // 2. Parse multi-document YAML (--- separated)
  // ---------------------------------------------------------------
  it("should parse multi-document YAML separated by ---", () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: svc-a
spec:
  ports:
    - port: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dep-a
spec:
  replicas: 1
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(2);
    expect(result.resources[0].kind).toBe("Service");
    expect(result.resources[0].metadata.name).toBe("svc-a");
    expect(result.resources[1].kind).toBe("Deployment");
    expect(result.resources[1].metadata.name).toBe("dep-a");
  });

  // ---------------------------------------------------------------
  // 3. Handle empty documents between ---
  // ---------------------------------------------------------------
  it("should skip empty documents between --- separators", () => {
    const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm-1
data:
  key: value
---
---
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm-2
data:
  other: data
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(2);
    expect(result.resources[0].metadata.name).toBe("cm-1");
    expect(result.resources[1].metadata.name).toBe("cm-2");
  });

  // ---------------------------------------------------------------
  // 4. Handle invalid YAML (returns errors)
  // ---------------------------------------------------------------
  it("should return errors for invalid YAML", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: bad-pod
  labels:
    bad indentation
      nested: wrong
`;

    const result = parseYAML(yaml);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toBeDefined();
    expect(typeof result.errors[0].message).toBe("string");
  });

  it("should collect errors from one document but still parse valid documents", () => {
    const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: good-cm
data:
  key: value
---
this is: [not: valid: yaml: {{{{
---
apiVersion: v1
kind: Service
metadata:
  name: good-svc
spec:
  ports:
    - port: 443
`;

    const result = parseYAML(yaml);

    expect(result.resources).toHaveLength(2);
    expect(result.resources[0].metadata.name).toBe("good-cm");
    expect(result.resources[1].metadata.name).toBe("good-svc");
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // 5. Parse Pod with all fields
  // ---------------------------------------------------------------
  it("should parse a Pod with all common fields", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: full-pod
  namespace: production
  labels:
    app: web
    tier: frontend
  annotations:
    description: "A fully-specified pod"
spec:
  containers:
    - name: app
      image: myapp:latest
      ports:
        - containerPort: 8080
      env:
        - name: LOG_LEVEL
          value: debug
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
  restartPolicy: Always
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const pod = result.resources[0];
    expect(pod.apiVersion).toBe("v1");
    expect(pod.kind).toBe("Pod");
    expect(pod.metadata.name).toBe("full-pod");
    expect(pod.metadata.namespace).toBe("production");
    expect(pod.metadata.labels).toEqual({ app: "web", tier: "frontend" });
    expect(pod.metadata.annotations).toEqual({
      description: "A fully-specified pod",
    });
    expect(pod.spec.containers).toHaveLength(1);
    expect(pod.spec.containers[0].name).toBe("app");
    expect(pod.spec.containers[0].image).toBe("myapp:latest");
    expect(pod.spec.containers[0].ports[0].containerPort).toBe(8080);
    expect(pod.spec.containers[0].env[0].name).toBe("LOG_LEVEL");
    expect(pod.spec.containers[0].resources.limits.memory).toBe("128Mi");
    expect(pod.spec.restartPolicy).toBe("Always");
  });

  // ---------------------------------------------------------------
  // 6. Parse Service resource
  // ---------------------------------------------------------------
  it("should parse a Service resource", () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: ClusterIP
  selector:
    app: my-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
    - protocol: TCP
      port: 443
      targetPort: 8443
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const svc = result.resources[0];
    expect(svc.apiVersion).toBe("v1");
    expect(svc.kind).toBe("Service");
    expect(svc.metadata.name).toBe("my-service");
    expect(svc.spec.type).toBe("ClusterIP");
    expect(svc.spec.selector.app).toBe("my-app");
    expect(svc.spec.ports).toHaveLength(2);
    expect(svc.spec.ports[0].port).toBe(80);
    expect(svc.spec.ports[0].targetPort).toBe(8080);
    expect(svc.spec.ports[1].port).toBe(443);
  });

  // ---------------------------------------------------------------
  // 7. Parse ConfigMap with data
  // ---------------------------------------------------------------
  it("should parse a ConfigMap with data", () => {
    const yaml = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DATABASE_HOST: db.example.com
  DATABASE_PORT: "5432"
  config.yaml: |
    server:
      host: 0.0.0.0
      port: 8080
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const cm = result.resources[0];
    expect(cm.apiVersion).toBe("v1");
    expect(cm.kind).toBe("ConfigMap");
    expect(cm.metadata.name).toBe("app-config");
    expect(cm.data).toBeDefined();
    expect(cm.data.DATABASE_HOST).toBe("db.example.com");
    expect(cm.data.DATABASE_PORT).toBe("5432");
    expect(cm.data["config.yaml"]).toContain("server:");
  });

  // ---------------------------------------------------------------
  // 8. Parse Secret with type
  // ---------------------------------------------------------------
  it("should parse a Secret with type and stringData", () => {
    const yaml = `
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: kubernetes.io/basic-auth
stringData:
  username: admin
  password: s3cret
data:
  extra-key: c29tZWRhdGE=
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const secret = result.resources[0];
    expect(secret.apiVersion).toBe("v1");
    expect(secret.kind).toBe("Secret");
    expect(secret.metadata.name).toBe("db-credentials");
    expect(secret.type).toBe("kubernetes.io/basic-auth");
    expect(secret.stringData).toEqual({
      username: "admin",
      password: "s3cret",
    });
    expect(secret.data).toEqual({ "extra-key": "c29tZWRhdGE=" });
  });

  it("should parse an Opaque Secret", () => {
    const yaml = `
apiVersion: v1
kind: Secret
metadata:
  name: opaque-secret
type: Opaque
data:
  token: dG9rZW4xMjM=
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].type).toBe("Opaque");
    expect(result.resources[0].data.token).toBe("dG9rZW4xMjM=");
  });

  // ---------------------------------------------------------------
  // 9. Parse Role with rules array
  // ---------------------------------------------------------------
  it("should parse a Role with rules array", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "watch", "list"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const role = result.resources[0];
    expect(role.apiVersion).toBe("rbac.authorization.k8s.io/v1");
    expect(role.kind).toBe("Role");
    expect(role.metadata.name).toBe("pod-reader");
    expect(role.metadata.namespace).toBe("default");
    expect(role.rules).toBeDefined();
    expect(role.rules).toHaveLength(2);
    expect(role.rules![0].apiGroups).toEqual([""]);
    expect(role.rules![0].resources).toEqual(["pods"]);
    expect(role.rules![0].verbs).toEqual(["get", "watch", "list"]);
    expect(role.rules![1].apiGroups).toEqual(["apps"]);
    expect(role.rules![1].resources).toEqual(["deployments"]);
    expect(role.rules![1].verbs).toEqual(["get", "list"]);
  });

  // ---------------------------------------------------------------
  // 10. Parse ClusterRoleBinding with roleRef and subjects
  // ---------------------------------------------------------------
  it("should parse a ClusterRoleBinding with roleRef and subjects", () => {
    const yaml = `
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-pods-global
subjects:
  - kind: User
    name: jane
    apiGroup: rbac.authorization.k8s.io
  - kind: ServiceAccount
    name: default
    namespace: kube-system
roleRef:
  kind: ClusterRole
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const binding = result.resources[0];
    expect(binding.apiVersion).toBe("rbac.authorization.k8s.io/v1");
    expect(binding.kind).toBe("ClusterRoleBinding");
    expect(binding.metadata.name).toBe("read-pods-global");

    expect(binding.roleRef).toBeDefined();
    expect(binding.roleRef.kind).toBe("ClusterRole");
    expect(binding.roleRef.name).toBe("pod-reader");
    expect(binding.roleRef.apiGroup).toBe("rbac.authorization.k8s.io");

    expect(binding.subjects).toBeDefined();
    expect(binding.subjects).toHaveLength(2);
    expect(binding.subjects![0]).toEqual({
      kind: "User",
      name: "jane",
      apiGroup: "rbac.authorization.k8s.io",
    });
    expect(binding.subjects![1]).toEqual({
      kind: "ServiceAccount",
      name: "default",
      namespace: "kube-system",
    });
  });

  // ---------------------------------------------------------------
  // 11. Parse resource with labels and annotations
  // ---------------------------------------------------------------
  it("should parse a resource with labels and annotations", () => {
    const yaml = `
apiVersion: v1
kind: Namespace
metadata:
  name: team-alpha
  labels:
    team: alpha
    environment: staging
    cost-center: "12345"
  annotations:
    contact: "alpha-team@example.com"
    description: "Namespace for team alpha staging workloads"
    kubectl.kubernetes.io/last-applied-configuration: "{}"
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);

    const ns = result.resources[0];
    expect(ns.kind).toBe("Namespace");
    expect(ns.metadata.name).toBe("team-alpha");

    expect(ns.metadata.labels).toEqual({
      team: "alpha",
      environment: "staging",
      "cost-center": "12345",
    });

    expect(ns.metadata.annotations).toEqual({
      contact: "alpha-team@example.com",
      description: "Namespace for team alpha staging workloads",
      "kubectl.kubernetes.io/last-applied-configuration": "{}",
    });
  });

  // ---------------------------------------------------------------
  // 12. Parse resource with namespace
  // ---------------------------------------------------------------
  it("should parse a resource with namespace", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: namespaced-pod
  namespace: kube-system
spec:
  containers:
    - name: busybox
      image: busybox
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].metadata.name).toBe("namespaced-pod");
    expect(result.resources[0].metadata.namespace).toBe("kube-system");
  });

  it("should leave namespace undefined when not specified", () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: no-ns-pod
spec:
  containers:
    - name: busybox
      image: busybox
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].metadata.namespace).toBeUndefined();
  });

  // ---------------------------------------------------------------
  // 15. Handle completely empty input
  // ---------------------------------------------------------------
  it("should handle completely empty input", () => {
    const result = parseYAML("");

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle whitespace-only input", () => {
    const result = parseYAML("   \n\n  \n   ");

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // 16. Handle YAML with only comments
  // ---------------------------------------------------------------
  it("should handle YAML with only comments", () => {
    const yaml = `
# This file is intentionally left empty
# TODO: add resources later
# See: https://example.com/docs
`;

    const result = parseYAML(yaml);

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle YAML with comments between separators", () => {
    const yaml = `
# header comment
---
# just a comment in a doc
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: after-comments
data:
  key: value
`;

    const result = parseYAML(yaml);

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].metadata.name).toBe("after-comments");
    expect(result.errors).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------
  it("should skip documents missing apiVersion", () => {
    const yaml = `
kind: ConfigMap
metadata:
  name: no-api-version
data:
  key: value
`;

    const result = parseYAML(yaml);

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should skip documents missing kind", () => {
    const yaml = `
apiVersion: v1
metadata:
  name: no-kind
data:
  key: value
`;

    const result = parseYAML(yaml);

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should default metadata.name to empty string when missing", () => {
    const yaml = `
apiVersion: v1
kind: ConfigMap
metadata: {}
data:
  key: value
`;

    const result = parseYAML(yaml);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].metadata.name).toBe("");
  });

  it("should skip YAML arrays (non-object documents)", () => {
    const yaml = `
- item1
- item2
- item3
`;

    const result = parseYAML(yaml);

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should skip plain scalar YAML documents", () => {
    const yaml = `just a string`;

    const result = parseYAML(yaml);

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe("parseMultipleFiles", () => {
  // ---------------------------------------------------------------
  // 13. parseMultipleFiles combines resources from multiple files
  // ---------------------------------------------------------------
  it("should combine resources from multiple files", () => {
    const files = [
      {
        path: "deployment.yaml",
        content: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
`,
      },
      {
        path: "service.yaml",
        content: `
apiVersion: v1
kind: Service
metadata:
  name: web-svc
spec:
  ports:
    - port: 80
`,
      },
      {
        path: "config.yaml",
        content: `
apiVersion: v1
kind: ConfigMap
metadata:
  name: web-config
data:
  env: production
`,
      },
    ];

    const result = parseMultipleFiles(files);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(3);
    expect(result.resources[0].kind).toBe("Deployment");
    expect(result.resources[0].metadata.name).toBe("web");
    expect(result.resources[1].kind).toBe("Service");
    expect(result.resources[1].metadata.name).toBe("web-svc");
    expect(result.resources[2].kind).toBe("ConfigMap");
    expect(result.resources[2].metadata.name).toBe("web-config");
  });

  it("should handle multi-document YAML within individual files", () => {
    const files = [
      {
        path: "combined.yaml",
        content: `
apiVersion: v1
kind: Service
metadata:
  name: svc
spec:
  ports:
    - port: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dep
spec:
  replicas: 1
`,
      },
      {
        path: "standalone.yaml",
        content: `
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm
data:
  key: val
`,
      },
    ];

    const result = parseMultipleFiles(files);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(3);
    expect(result.resources[0].metadata.name).toBe("svc");
    expect(result.resources[1].metadata.name).toBe("dep");
    expect(result.resources[2].metadata.name).toBe("cm");
  });

  // ---------------------------------------------------------------
  // 14. parseMultipleFiles prefixes errors with file path
  // ---------------------------------------------------------------
  it("should prefix errors with file path", () => {
    const files = [
      {
        path: "manifests/bad.yaml",
        content: `
not valid: yaml: {{{{
`,
      },
      {
        path: "manifests/good.yaml",
        content: `
apiVersion: v1
kind: Pod
metadata:
  name: ok-pod
spec:
  containers:
    - name: app
      image: nginx
`,
      },
    ];

    const result = parseMultipleFiles(files);

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].metadata.name).toBe("ok-pod");

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toMatch(/^manifests\/bad\.yaml: /);
  });

  it("should prefix errors from multiple bad files with their respective paths", () => {
    const files = [
      {
        path: "a.yaml",
        content: `bad: yaml: {{{{`,
      },
      {
        path: "b.yaml",
        content: `also: bad: yaml: [[[[`,
      },
    ];

    const result = parseMultipleFiles(files);

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toMatch(/^a\.yaml: /);
    expect(result.errors[1].message).toMatch(/^b\.yaml: /);
  });

  it("should handle an empty files array", () => {
    const result = parseMultipleFiles([]);

    expect(result.resources).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("should handle files with empty content", () => {
    const files = [
      { path: "empty.yaml", content: "" },
      {
        path: "real.yaml",
        content: `
apiVersion: v1
kind: ConfigMap
metadata:
  name: real-cm
data:
  key: value
`,
      },
    ];

    const result = parseMultipleFiles(files);

    expect(result.errors).toHaveLength(0);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].metadata.name).toBe("real-cm");
  });
});
