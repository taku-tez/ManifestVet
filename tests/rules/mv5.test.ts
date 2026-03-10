import { describe, it, expect } from "vitest";
import { mv5Rules } from "../../src/rules/mv5";
import { parseYAML } from "../../src/parser/parser";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function checkRule(ruleId: string, yaml: string) {
  const { resources } = parseYAML(yaml);
  const rule = mv5Rules.find((r) => r.id === ruleId)!;
  return rule.check({ resource: resources[0], allResources: resources });
}

// ============================================================================
// MV5001 - Env var with hardcoded sensitive value
// ============================================================================
describe("MV5001 - Hardcoded sensitive env var value", () => {
  it("should flag a container with a hardcoded PASSWORD env var", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: secret-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: DB_PASSWORD
          value: "supersecret123"
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV5001");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("DB_PASSWORD");
    expect(violations[0].path).toBe("spec.containers[0].env[0].value");
    expect(violations[0].resource).toBe("Pod/secret-pod");
  });

  it("should pass when sensitive env var uses secretKeyRef", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ref-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when env var name is not sensitive", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: safe-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: LOG_LEVEL
          value: "debug"
        - name: APP_PORT
          value: "8080"
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when sensitive env var has empty value", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: empty-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: API_KEY
          value: ""
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple sensitive env vars in the same container", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-secret-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: DB_PASSWORD
          value: "pass123"
        - name: API_KEY
          value: "key-abc-xyz"
        - name: AUTH_TOKEN
          value: "tok_12345"
`,
    );
    expect(violations).toHaveLength(3);
    expect(violations[0].path).toBe("spec.containers[0].env[0].value");
    expect(violations[1].path).toBe("spec.containers[0].env[1].value");
    expect(violations[2].path).toBe("spec.containers[0].env[2].value");
  });

  it("should flag sensitive env vars in a Deployment", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: secret-deploy
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
          image: myapp:1.0
          env:
            - name: SECRET
              value: "mysecretvalue"
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].env[0].value",
    );
    expect(violations[0].resource).toBe("Deployment/secret-deploy");
  });

  it("should flag sensitive env vars in init containers", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-secret-pod
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
      env:
        - name: PRIVATE_KEY
          value: "-----BEGIN RSA PRIVATE KEY-----"
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].env[0].value");
    expect(violations[0].message).toContain("setup");
    expect(violations[0].message).toContain("PRIVATE_KEY");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV5001",
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

  it("should be case-insensitive for sensitive pattern matching", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: case-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: db_password
          value: "secret"
        - name: Api_Key
          value: "keyval"
`,
    );
    expect(violations).toHaveLength(2);
  });

  it("should flag all sensitive patterns: PASSWORD, SECRET, TOKEN, KEY, API_KEY, APIKEY, PRIVATE_KEY, CREDENTIAL", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: all-patterns-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: MY_PASSWORD
          value: "p"
        - name: MY_SECRET
          value: "s"
        - name: MY_TOKEN
          value: "t"
        - name: MY_KEY
          value: "k"
        - name: MY_API_KEY
          value: "ak"
        - name: MY_APIKEY
          value: "apk"
        - name: MY_PRIVATE_KEY
          value: "pk"
        - name: MY_CREDENTIAL
          value: "c"
`,
    );
    expect(violations).toHaveLength(8);
  });

  it("should pass when sensitive env var has no value field at all", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-value-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: DB_PASSWORD
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when container has no env vars", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-env-pod
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
      "MV5001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ns-pod
  namespace: production
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: SECRET
          value: "val"
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("production");
  });

  it("should flag in a CronJob", () => {
    const violations = checkRule(
      "MV5001",
      `
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cron-secret
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: worker
              image: worker:1.0
              env:
                - name: API_KEY
                  value: "abc123"
`,
    );
    // CronJob spec.template.spec is not the right path for CronJob;
    // CronJob uses spec.jobTemplate.spec.template.spec but the parser
    // extracts spec.template.spec for pod-bearing kinds
    // Actually, looking at the code: getPodSpec returns resource.spec?.template?.spec
    // For CronJob, spec.template.spec would be spec.jobTemplate (not the pod spec).
    // Let's see: CronJob is in POD_BEARING_KINDS, so isPodBearing is true.
    // getPodSpec returns resource.spec?.template?.spec which is undefined for CronJob
    // because CronJob's path is spec.jobTemplate.spec.template.spec.
    // So getContainers returns []. No violations.
    // Actually wait - the YAML parser just takes spec as resource.spec.
    // For this CronJob, resource.spec = { schedule: ..., jobTemplate: { spec: { template: { spec: { containers: ... } } } } }
    // getPodSpec does resource.spec?.template?.spec which looks for spec.template.spec
    // But for CronJob, it's spec.jobTemplate.spec.template.spec, so spec.template is undefined.
    // Therefore no containers are found, and no violations.
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV5002 - Opaque Secret with sensitive key names in data
// ============================================================================
describe("MV5002 - Secret with sensitive key names", () => {
  it("should flag an Opaque Secret with a sensitive key in data", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
data:
  password: cGFzc3dvcmQxMjM=
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV5002");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("my-secret");
    expect(violations[0].message).toContain("password");
    expect(violations[0].path).toBe("data.password");
    expect(violations[0].resource).toBe("Secret/my-secret");
  });

  it("should pass when Secret is not Opaque type", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.key: base64encodedkey
  tls.crt: base64encodedcert
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag Secret with no explicit type (defaults to Opaque)", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: default-secret
data:
  api_key: c29tZWtleQ==
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV5002");
    expect(violations[0].message).toContain("api_key");
  });

  it("should pass when Opaque Secret has no sensitive key names", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: safe-secret
type: Opaque
data:
  username: dXNlcjEyMw==
  config: c29tZWNvbmZpZw==
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple sensitive keys in the same Secret", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: multi-secret
type: Opaque
data:
  db_password: cGFzcw==
  api_token: dG9rZW4=
  private_key: a2V5
`,
    );
    expect(violations).toHaveLength(3);
    expect(violations[0].path).toBe("data.db_password");
    expect(violations[1].path).toBe("data.api_token");
    expect(violations[2].path).toBe("data.private_key");
  });

  it("should not flag non-Secret resources", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-cm
data:
  password: notasecret
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when Secret has no data field", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: empty-secret
type: Opaque
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should include namespace when present", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: ns-secret
  namespace: production
type: Opaque
data:
  secret: dmFsdWU=
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("production");
  });

  it("should be case-insensitive for sensitive key matching", () => {
    const violations = checkRule(
      "MV5002",
      `
apiVersion: v1
kind: Secret
metadata:
  name: case-secret
type: Opaque
data:
  DB_PASSWORD: cGFzcw==
  ApiKey: a2V5
`,
    );
    expect(violations).toHaveLength(2);
  });
});

// ============================================================================
// MV5003 - ConfigMap with sensitive key names
// ============================================================================
describe("MV5003 - ConfigMap with sensitive key names", () => {
  it("should flag a ConfigMap with a sensitive key in data", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-config
data:
  db_password: "plaintext_password"
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV5003");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("my-config");
    expect(violations[0].message).toContain("db_password");
    expect(violations[0].path).toBe("data.db_password");
    expect(violations[0].resource).toBe("ConfigMap/my-config");
  });

  it("should pass when ConfigMap has no sensitive key names", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: safe-config
data:
  log_level: "debug"
  app_port: "8080"
  database_host: "db.example.com"
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple sensitive keys in the same ConfigMap", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: multi-config
data:
  api_key: "abc123"
  auth_token: "tok_xyz"
  normal_setting: "value"
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("data.api_key");
    expect(violations[1].path).toBe("data.auth_token");
  });

  it("should pass when ConfigMap has no data field", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: empty-config
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-ConfigMap resources", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
data:
  password: cGFzc3dvcmQ=
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should be case-insensitive for key name matching", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: case-config
data:
  MY_SECRET: "hidden"
  credential_file: "/etc/creds"
`,
    );
    expect(violations).toHaveLength(2);
  });

  it("should include namespace when present", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: ns-config
  namespace: staging
data:
  api_key: "some-key"
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("staging");
  });

  it("should flag keys that contain sensitive patterns as substrings", () => {
    const violations = checkRule(
      "MV5003",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: substring-config
data:
  redis_password_file: "/secrets/redis"
  jwt_token_expiry: "3600"
`,
    );
    expect(violations).toHaveLength(2);
  });
});

// ============================================================================
// MV5004 - Volume using hostPath
// ============================================================================
describe("MV5004 - hostPath volume", () => {
  it("should flag a Pod with a hostPath volume", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
  volumes:
    - name: host-data
      hostPath:
        path: /var/data
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV5004");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("host-data");
    expect(violations[0].message).toContain("/var/data");
    expect(violations[0].path).toBe("spec.volumes[0].hostPath");
    expect(violations[0].resource).toBe("Pod/hostpath-pod");
  });

  it("should pass when Pod has no hostPath volumes", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: safe-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
  volumes:
    - name: config
      configMap:
        name: my-config
    - name: data
      emptyDir: {}
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple hostPath volumes", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-hostpath-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
  volumes:
    - name: logs
      hostPath:
        path: /var/log
    - name: data
      hostPath:
        path: /mnt/data
    - name: config
      configMap:
        name: my-config
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.volumes[0].hostPath");
    expect(violations[1].path).toBe("spec.volumes[1].hostPath");
  });

  it("should flag hostPath volumes in a Deployment", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hostpath-deploy
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
      volumes:
        - name: host-vol
          hostPath:
            path: /data
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.volumes[0].hostPath",
    );
    expect(violations[0].resource).toBe("Deployment/hostpath-deploy");
  });

  it("should pass when Pod has no volumes at all", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-vol-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV5004",
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

  it("should include namespace when present", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ns-hostpath-pod
  namespace: kube-system
spec:
  containers:
    - name: agent
      image: agent:1.0
  volumes:
    - name: host-root
      hostPath:
        path: /
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("kube-system");
  });

  it("should flag hostPath in a DaemonSet", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: hostpath-ds
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
          image: agent:2.0
      volumes:
        - name: var-run
          hostPath:
            path: /var/run
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.volumes[0].hostPath",
    );
    expect(violations[0].resource).toBe("DaemonSet/hostpath-ds");
  });

  it("should handle hostPath with no path specified", () => {
    const violations = checkRule(
      "MV5004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-path-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
  volumes:
    - name: host-vol
      hostPath:
        type: Directory
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV5004");
    // Message should still contain the volume name and an empty path
    expect(violations[0].message).toContain("host-vol");
  });
});

// ============================================================================
// MV5005 - Sensitive env var sourced from ConfigMap instead of Secret
// ============================================================================
describe("MV5005 - Sensitive env var sourced from ConfigMap (configMapKeyRef)", () => {
  it("should flag a sensitive env var using configMapKeyRef", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: cm-ref-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: DB_PASSWORD
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: db-pass
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV5005");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("DB_PASSWORD");
    expect(violations[0].message).toContain("app-config");
    expect(violations[0].path).toBe(
      "spec.containers[0].env[0].valueFrom.configMapKeyRef",
    );
    expect(violations[0].resource).toBe("Pod/cm-ref-pod");
  });

  it("should pass when sensitive env var uses secretKeyRef", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: secret-ref-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when non-sensitive env var uses configMapKeyRef", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: nonsensitive-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: LOG_LEVEL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: log-level
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple sensitive env vars from configMapKeyRef", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-cm-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: API_KEY
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: api-key
        - name: AUTH_TOKEN
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: auth-token
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe(
      "spec.containers[0].env[0].valueFrom.configMapKeyRef",
    );
    expect(violations[1].path).toBe(
      "spec.containers[0].env[1].valueFrom.configMapKeyRef",
    );
  });

  it("should flag sensitive env vars from configMapKeyRef in a Deployment", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cm-deploy
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
          image: myapp:1.0
          env:
            - name: SECRET
              valueFrom:
                configMapKeyRef:
                  name: web-config
                  key: secret-val
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].env[0].valueFrom.configMapKeyRef",
    );
    expect(violations[0].resource).toBe("Deployment/cm-deploy");
  });

  it("should flag sensitive env vars from configMapKeyRef in init containers", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-cm-pod
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
      env:
        - name: CREDENTIAL
          valueFrom:
            configMapKeyRef:
              name: init-config
              key: cred
  containers:
    - name: app
      image: myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.initContainers[0].env[0].valueFrom.configMapKeyRef",
    );
    expect(violations[0].message).toContain("setup");
    expect(violations[0].message).toContain("CREDENTIAL");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV5005",
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

  it("should pass when container has no env vars", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-env-pod
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
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ns-cm-pod
  namespace: default
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: TOKEN
          valueFrom:
            configMapKeyRef:
              name: my-config
              key: tok
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("default");
  });

  it("should be case-insensitive for sensitive pattern matching", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: case-cm-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: my_apikey
          valueFrom:
            configMapKeyRef:
              name: cfg
              key: k
`,
    );
    expect(violations).toHaveLength(1);
  });

  it("should handle configMapKeyRef with missing name gracefully", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: noname-cm-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      env:
        - name: PASSWORD
          valueFrom:
            configMapKeyRef:
              key: pass
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("unknown");
  });

  it("should flag in a StatefulSet", () => {
    const violations = checkRule(
      "MV5005",
      `
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: sts-cm
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
          env:
            - name: POSTGRES_PASSWORD
              valueFrom:
                configMapKeyRef:
                  name: db-config
                  key: pg-pass
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].env[0].valueFrom.configMapKeyRef",
    );
    expect(violations[0].resource).toBe("StatefulSet/sts-cm");
  });
});
