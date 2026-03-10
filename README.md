# ManifestVet

Kubernetes manifest security linter. Detects misconfigurations, policy violations, and security risks in YAML manifests before deployment.

```
$ manifestvet deployment.yaml

deployment.yaml
  MV1001  error    Deployment/nginx  containers[0]: runAsNonRoot not set to true
  MV1002  error    Deployment/nginx  containers[0]: allowPrivilegeEscalation not disabled
  MV1008  warning  Deployment/nginx  containers[0]: no resource limits set (cpu, memory)
  MV4001  error    Deployment/nginx  containers[0]: image tag is "latest"
  MV6003  warning  Deployment/nginx  containers[0]: no livenessProbe defined

5 errors, 2 warnings across 1 resource
```

## Installation

```bash
npm install -g manifestvet
```

## Usage

```bash
# Scan files
manifestvet deployment.yaml service.yaml

# Scan all manifests in a directory
manifestvet --dir ./k8s/

# Read from stdin
kubectl get deployment -o yaml | manifestvet --stdin

# Scan a GitHub repository
manifestvet --github owner/repo
manifestvet --github owner/repo --branch main --path k8s/

# Output formats
manifestvet --format tty   deployment.yaml   # colored terminal (default)
manifestvet --format json  deployment.yaml   # JSON
manifestvet --format sarif deployment.yaml   # SARIF 2.1 (for GitHub Code Scanning)
```

## Rules

53 rules across 6 categories:

| Prefix | Category | Count |
|--------|----------|-------|
| MV1xxx | Pod Security | 16 |
| MV2xxx | RBAC | 9 |
| MV3xxx | Network | 7 |
| MV4xxx | Image Security | 6 |
| MV5xxx | Secrets & Config | 5 |
| MV6xxx | Best Practices | 10 |

### MV1xxx — Pod Security

| ID | Severity | Description |
|----|----------|-------------|
| MV1001 | error | `runAsNonRoot` not set to `true` |
| MV1002 | error | `allowPrivilegeEscalation` not set to `false` |
| MV1003 | error | Privileged container (`privileged: true`) |
| MV1004 | error | `hostNetwork: true` |
| MV1005 | error | `hostPID: true` |
| MV1006 | error | `hostIPC: true` |
| MV1007 | error | Dangerous capabilities added (NET_ADMIN, SYS_ADMIN, etc.) |
| MV1008 | warning | No resource limits (cpu, memory) |
| MV1009 | warning | No resource requests (cpu, memory) |
| MV1010 | warning | `readOnlyRootFilesystem` not set to `true` |
| MV1011 | warning | Seccomp profile not configured |
| MV1012 | warning | `capabilities.drop` does not include ALL |
| MV1013 | error | `runAsUser: 0` (explicit root) |
| MV1014 | warning | `procMount: Unmasked` |
| MV1015 | warning | `serviceAccountName: default` |
| MV1016 | warning | `automountServiceAccountToken` not explicitly `false` |

### MV2xxx — RBAC

| ID | Severity | Description |
|----|----------|-------------|
| MV2001 | error | Wildcard `*` in verbs |
| MV2002 | error | Wildcard `*` in resources |
| MV2003 | warning | Wildcard `*` in apiGroups |
| MV2004 | error | ClusterRoleBinding to `cluster-admin` |
| MV2005 | warning | ServiceAccount `automountServiceAccountToken` not `false` |
| MV2006 | warning | Role grants access to `secrets` |
| MV2007 | error | Role grants `exec` on pods |
| MV2008 | error | ClusterRole with impersonation permissions |
| MV2009 | error | RoleBinding to `system:unauthenticated` or `system:anonymous` |

### MV3xxx — Network

| ID | Severity | Description |
|----|----------|-------------|
| MV3001 | warning | Service type `NodePort` |
| MV3002 | warning | `hostPort` set in container ports |
| MV3003 | error | NetworkPolicy allows all ingress (`from: [{}]`) |
| MV3004 | error | NetworkPolicy allows all egress (`to: [{}]`) |
| MV3005 | warning | LoadBalancer without `externalTrafficPolicy: Local` |
| MV3006 | info | Pod uses `hostAliases` |
| MV3007 | warning | Ingress without TLS configured |

### MV4xxx — Image Security

| ID | Severity | Description |
|----|----------|-------------|
| MV4001 | error | Image tag is `latest` or missing |
| MV4002 | warning | Image has no digest (`sha256:`) |
| MV4003 | error | `imagePullPolicy: Never` |
| MV4004 | info | `imagePullPolicy: IfNotPresent` without version pinning |
| MV4005 | error | Init container uses `latest` tag |
| MV4006 | info | No `imagePullSecrets` |

### MV5xxx — Secrets & Config

| ID | Severity | Description |
|----|----------|-------------|
| MV5001 | error | Hardcoded sensitive env var (PASSWORD, SECRET, TOKEN, KEY) |
| MV5002 | error | Secret with plain-text sensitive key names |
| MV5003 | warning | ConfigMap with sensitive key patterns |
| MV5004 | warning | Volume using `hostPath` |
| MV5005 | warning | Sensitive env var sourced from ConfigMap instead of Secret |

### MV6xxx — Best Practices

| ID | Severity | Description |
|----|----------|-------------|
| MV6001 | info | Missing recommended labels (app.kubernetes.io/name, version) |
| MV6002 | warning | Deployment with `replicas: 1` (no HA) |
| MV6003 | warning | Container missing `livenessProbe` |
| MV6004 | warning | Container missing `readinessProbe` |
| MV6005 | info | Deployment missing `podAntiAffinity` |
| MV6006 | warning | Deployment without rolling update strategy |
| MV6007 | info | Container missing `lifecycle.preStop` |
| MV6008 | info | Resource in `default` namespace |
| MV6009 | error | `metadata.name` missing or empty |
| MV6010 | info | Deployment without `minReadySeconds` |

## Configuration

Create `.manifestvet.yaml` in your project root:

```yaml
# Ignore specific rules
ignore:
  - MV6001
  - MV6005

# Override severity
override:
  MV6002:
    severity: error
  MV3001:
    severity: info

# Trusted registries (suppress MV4006)
trustedRegistries:
  - gcr.io/my-project
  - registry.internal.example.com
```

## CI Integration

### GitHub Actions

```yaml
- name: Scan Kubernetes manifests
  run: |
    npm install -g manifestvet
    manifestvet --format sarif --dir ./k8s/ > results.sarif

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

## License

MIT
