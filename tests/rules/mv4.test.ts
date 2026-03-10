import { describe, it, expect } from "vitest";
import { mv4Rules } from "../../src/rules/mv4";
import { parseYAML } from "../../src/parser/parser";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function checkRule(ruleId: string, yaml: string) {
  const { resources } = parseYAML(yaml);
  const rule = mv4Rules.find((r) => r.id === ruleId)!;
  return rule.check({ resource: resources[0], allResources: resources });
}

// ============================================================================
// MV4001 - Image tag is "latest" or missing
// ============================================================================
describe("MV4001 - Image tag is latest or missing", () => {
  it("should flag a container using the latest tag", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: latest-pod
spec:
  containers:
    - name: web
      image: nginx:latest
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4001");
    expect(violations[0].severity).toBe("error");
    expect(violations[0].message).toContain("web");
    expect(violations[0].message).toContain("nginx:latest");
    expect(violations[0].path).toBe("spec.containers[0].image");
    expect(violations[0].resource).toBe("Pod/latest-pod");
  });

  it("should flag a container with no tag at all", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: notag-pod
spec:
  containers:
    - name: app
      image: nginx
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4001");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("nginx");
  });

  it("should pass when image has a specific version tag", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: pinned-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when image uses a digest with a version tag", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: digest-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3@sha256:abc123def456
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag image with latest tag even if digest is present", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: latest-digest-pod
spec:
  containers:
    - name: web
      image: nginx:latest@sha256:abc123def456
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4001");
  });

  it("should flag multiple containers with unpinned images in a Deployment", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multi-deploy
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
          image: nginx:latest
        - name: sidecar
          image: envoy
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.template.spec.containers[0].image");
    expect(violations[1].path).toBe("spec.template.spec.containers[1].image");
  });

  it("should also flag init containers with latest/missing tag", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-pod
spec:
  initContainers:
    - name: setup
      image: busybox
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].image");
    expect(violations[0].message).toContain("setup");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV4001",
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

  it("should flag containers in a StatefulSet", () => {
    const violations = checkRule(
      "MV4001",
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
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.template.spec.containers[0].image");
    expect(violations[0].resource).toBe("StatefulSet/my-sts");
  });

  it("should include namespace in violation when present", () => {
    const violations = checkRule(
      "MV4001",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ns-pod
  namespace: production
spec:
  containers:
    - name: web
      image: nginx
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("production");
  });
});

// ============================================================================
// MV4002 - Image has no digest (sha256)
// ============================================================================
describe("MV4002 - Image has no sha256 digest", () => {
  it("should flag a container image without a digest", () => {
    const violations = checkRule(
      "MV4002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-digest-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4002");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("web");
    expect(violations[0].message).toContain("nginx:1.25.3");
    expect(violations[0].message).toContain("without a sha256 digest");
    expect(violations[0].path).toBe("spec.containers[0].image");
    expect(violations[0].resource).toBe("Pod/no-digest-pod");
  });

  it("should pass when image has a sha256 digest", () => {
    const violations = checkRule(
      "MV4002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: digest-pod
spec:
  containers:
    - name: web
      image: nginx@sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when image has both tag and digest", () => {
    const violations = checkRule(
      "MV4002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: both-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3@sha256:abcdef1234567890
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag images with no tag and no digest", () => {
    const violations = checkRule(
      "MV4002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: bare-pod
spec:
  containers:
    - name: web
      image: nginx
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4002");
  });

  it("should flag init containers without digests", () => {
    const violations = checkRule(
      "MV4002",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-pod
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
  containers:
    - name: app
      image: myapp@sha256:abc123def456
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].image");
    expect(violations[0].message).toContain("setup");
  });

  it("should flag all containers without digest in a Deployment", () => {
    const violations = checkRule(
      "MV4002",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploy-no-digest
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
    expect(violations[0].path).toBe("spec.template.spec.containers[0].image");
    expect(violations[1].path).toBe("spec.template.spec.containers[1].image");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV4002",
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
});

// ============================================================================
// MV4003 - imagePullPolicy is "Never"
// ============================================================================
describe("MV4003 - imagePullPolicy is Never", () => {
  it("should flag a container with imagePullPolicy Never", () => {
    const violations = checkRule(
      "MV4003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: never-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
      imagePullPolicy: Never
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4003");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("web");
    expect(violations[0].message).toContain("Never");
    expect(violations[0].path).toBe("spec.containers[0].imagePullPolicy");
    expect(violations[0].resource).toBe("Pod/never-pod");
  });

  it("should pass when imagePullPolicy is Always", () => {
    const violations = checkRule(
      "MV4003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: always-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
      imagePullPolicy: Always
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when imagePullPolicy is IfNotPresent", () => {
    const violations = checkRule(
      "MV4003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ifnp-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
      imagePullPolicy: IfNotPresent
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when imagePullPolicy is not set (undefined)", () => {
    const violations = checkRule(
      "MV4003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: default-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag imagePullPolicy Never in init containers", () => {
    const violations = checkRule(
      "MV4003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-never-pod
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
      imagePullPolicy: Never
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].imagePullPolicy");
    expect(violations[0].message).toContain("setup");
  });

  it("should flag imagePullPolicy Never in a Deployment container", () => {
    const violations = checkRule(
      "MV4003",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: never-deploy
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
          image: myapp:1.0
          imagePullPolicy: Never
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].imagePullPolicy",
    );
    expect(violations[0].resource).toBe("Deployment/never-deploy");
  });

  it("should flag multiple containers with imagePullPolicy Never", () => {
    const violations = checkRule(
      "MV4003",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-never-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
      imagePullPolicy: Never
    - name: sidecar
      image: envoy:1.28
      imagePullPolicy: Never
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.containers[0].imagePullPolicy");
    expect(violations[1].path).toBe("spec.containers[1].imagePullPolicy");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV4003",
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
// MV4004 - imagePullPolicy IfNotPresent with no version pinning
// ============================================================================
describe("MV4004 - imagePullPolicy IfNotPresent without pinning", () => {
  it("should flag IfNotPresent with an untagged image", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ifnp-untagged
spec:
  containers:
    - name: web
      image: nginx
      imagePullPolicy: IfNotPresent
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4004");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("web");
    expect(violations[0].message).toContain("IfNotPresent");
    expect(violations[0].message).toContain("nginx");
    expect(violations[0].path).toBe("spec.containers[0].imagePullPolicy");
    expect(violations[0].resource).toBe("Pod/ifnp-untagged");
  });

  it("should flag IfNotPresent with latest tag", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ifnp-latest
spec:
  containers:
    - name: web
      image: nginx:latest
      imagePullPolicy: IfNotPresent
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4004");
    expect(violations[0].message).toContain("nginx:latest");
  });

  it("should pass when IfNotPresent is used with a specific version tag", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ifnp-pinned
spec:
  containers:
    - name: web
      image: nginx:1.25.3
      imagePullPolicy: IfNotPresent
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when IfNotPresent is used with a digest (no tag)", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ifnp-digest
spec:
  containers:
    - name: web
      image: nginx@sha256:abcdef1234567890
      imagePullPolicy: IfNotPresent
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag when imagePullPolicy is Always (even with unpinned image)", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: always-unpinned
spec:
  containers:
    - name: web
      image: nginx
      imagePullPolicy: Always
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag when imagePullPolicy is not set", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-policy
spec:
  containers:
    - name: web
      image: nginx
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag IfNotPresent in a Deployment with unpinned image", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ifnp-deploy
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
          image: myapp:latest
          imagePullPolicy: IfNotPresent
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.containers[0].imagePullPolicy",
    );
    expect(violations[0].resource).toBe("Deployment/ifnp-deploy");
  });

  it("should flag IfNotPresent in init containers with unpinned image", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ifnp-init
spec:
  initContainers:
    - name: setup
      image: busybox
      imagePullPolicy: IfNotPresent
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.initContainers[0].imagePullPolicy");
    expect(violations[0].message).toContain("setup");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV4004",
      `
apiVersion: v1
kind: ConfigMap
metadata:
  name: cfg
data:
  key: value
`,
    );
    expect(violations).toHaveLength(0);
  });
});

// ============================================================================
// MV4005 - Init container using latest tag
// ============================================================================
describe("MV4005 - Init container using latest or missing tag", () => {
  it("should flag an init container with the latest tag", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-latest-pod
spec:
  initContainers:
    - name: setup
      image: busybox:latest
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4005");
    expect(violations[0].severity).toBe("warning");
    expect(violations[0].message).toContain("setup");
    expect(violations[0].message).toContain("busybox:latest");
    expect(violations[0].path).toBe("spec.initContainers[0].image");
    expect(violations[0].resource).toBe("Pod/init-latest-pod");
  });

  it("should flag an init container with no tag", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-notag-pod
spec:
  initContainers:
    - name: setup
      image: busybox
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4005");
    expect(violations[0].message).toContain("setup");
    expect(violations[0].message).toContain("busybox");
  });

  it("should pass when init container has a specific version tag", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-pinned-pod
spec:
  initContainers:
    - name: setup
      image: busybox:1.36.1
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass when there are no init containers", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: no-init-pod
spec:
  containers:
    - name: app
      image: myapp:latest
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag regular containers (only init containers)", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: regular-latest-pod
spec:
  initContainers:
    - name: setup
      image: busybox:1.36
  containers:
    - name: app
      image: myapp:latest
`,
    );
    // MV4005 specifically only checks initContainers, not regular containers
    expect(violations).toHaveLength(0);
  });

  it("should flag multiple init containers with unpinned images", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-init-pod
spec:
  initContainers:
    - name: init1
      image: busybox
    - name: init2
      image: alpine:latest
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].path).toBe("spec.initContainers[0].image");
    expect(violations[1].path).toBe("spec.initContainers[1].image");
  });

  it("should flag init containers in a Deployment", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: init-deploy
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      initContainers:
        - name: migrate
          image: flyway
      containers:
        - name: app
          image: myapp:2.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe(
      "spec.template.spec.initContainers[0].image",
    );
    expect(violations[0].resource).toBe("Deployment/init-deploy");
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV4005",
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

  it("should include namespace in violation when present", () => {
    const violations = checkRule(
      "MV4005",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ns-init-pod
  namespace: staging
spec:
  initContainers:
    - name: setup
      image: busybox
  containers:
    - name: app
      image: myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].namespace).toBe("staging");
  });
});

// ============================================================================
// MV4006 - No imagePullSecrets for private registry
// ============================================================================
describe("MV4006 - No imagePullSecrets for private registry", () => {
  it("should flag a private registry image without imagePullSecrets", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: private-pod
spec:
  containers:
    - name: app
      image: gcr.io/my-project/myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4006");
    expect(violations[0].severity).toBe("info");
    expect(violations[0].message).toContain("app");
    expect(violations[0].message).toContain("gcr.io/my-project/myapp:1.0.0");
    expect(violations[0].message).toContain("no imagePullSecrets");
    expect(violations[0].path).toBe("spec.imagePullSecrets");
    expect(violations[0].resource).toBe("Pod/private-pod");
  });

  it("should pass when imagePullSecrets are defined for private registry", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: secret-pod
spec:
  imagePullSecrets:
    - name: gcr-credentials
  containers:
    - name: app
      image: gcr.io/my-project/myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass for Docker Hub images without imagePullSecrets", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: public-pod
spec:
  containers:
    - name: web
      image: nginx:1.25.3
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should pass for Docker Hub images with org prefix (no dot in registry)", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: dockerhub-org-pod
spec:
  containers:
    - name: web
      image: myorg/myapp:1.0.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag Azure Container Registry without imagePullSecrets", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: acr-pod
spec:
  containers:
    - name: app
      image: myregistry.azurecr.io/myapp:2.0.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4006");
    expect(violations[0].message).toContain("myregistry.azurecr.io/myapp:2.0.0");
  });

  it("should flag AWS ECR images without imagePullSecrets", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: ecr-pod
spec:
  containers:
    - name: app
      image: 123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4006");
  });

  it("should flag multiple private registry containers without imagePullSecrets", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: multi-private-pod
spec:
  containers:
    - name: app
      image: gcr.io/my-project/app:1.0
    - name: sidecar
      image: quay.io/my-org/proxy:2.0
`,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0].message).toContain("app");
    expect(violations[1].message).toContain("sidecar");
  });

  it("should flag private registry in init containers without imagePullSecrets", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: init-private-pod
spec:
  initContainers:
    - name: setup
      image: gcr.io/my-project/setup:1.0
  containers:
    - name: app
      image: nginx:1.25.3
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("setup");
    expect(violations[0].path).toBe("spec.imagePullSecrets");
  });

  it("should flag in a Deployment without imagePullSecrets", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: private-deploy
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
          image: gcr.io/my-project/webapp:3.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].path).toBe("spec.template.spec.imagePullSecrets");
    expect(violations[0].resource).toBe("Deployment/private-deploy");
  });

  it("should pass when imagePullSecrets is set even with multiple private images", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: secrets-pod
spec:
  imagePullSecrets:
    - name: registry-creds
  containers:
    - name: app
      image: gcr.io/proj/app:1.0
    - name: sidecar
      image: quay.io/org/sidecar:2.0
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag non-pod-bearing resources", () => {
    const violations = checkRule(
      "MV4006",
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

  it("should pass when imagePullSecrets is empty array and image is from public registry", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: empty-secrets-public
spec:
  imagePullSecrets: []
  containers:
    - name: web
      image: nginx:1.25.3
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should flag when imagePullSecrets is empty array and image is from private registry", () => {
    const violations = checkRule(
      "MV4006",
      `
apiVersion: v1
kind: Pod
metadata:
  name: empty-secrets-private
spec:
  imagePullSecrets: []
  containers:
    - name: app
      image: gcr.io/my-project/myapp:1.0
`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("MV4006");
  });
});

// ============================================================================
// MV4007 - Image uses implicit Docker Hub registry
// ============================================================================
describe("MV4007 - Image uses implicit Docker Hub registry", () => {
  it("should flag a short image name without registry prefix", () => {
    const violations = checkRule(
      "MV4007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: implicit-dockerhub
spec:
  containers:
    - name: app
      image: nginx:1.25
`,
    );
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule).toBe("MV4007");
  });

  it("should flag an image with library/ prefix but no registry", () => {
    const violations = checkRule(
      "MV4007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: library-image
spec:
  containers:
    - name: app
      image: library/ubuntu:22.04
`,
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it("should not flag an image with explicit registry (gcr.io)", () => {
    const violations = checkRule(
      "MV4007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: gcr-image
spec:
  containers:
    - name: app
      image: gcr.io/google-containers/pause:3.9
`,
    );
    expect(violations).toHaveLength(0);
  });

  it("should not flag an image with explicit docker.io registry", () => {
    const violations = checkRule(
      "MV4007",
      `
apiVersion: v1
kind: Pod
metadata:
  name: explicit-dockerhub
spec:
  containers:
    - name: app
      image: docker.io/library/nginx:1.25
`,
    );
    expect(violations).toHaveLength(0);
  });
});
