# ManifestVet

Kubernetes manifest security linter. Detects misconfigurations, policy violations, and security risks in YAML manifests before deployment.

```
$ manifestvet deployment.yaml

deployment.yaml
  MV1003  critical  Deployment/nginx  spec.template.spec.containers[0].securityContext.privileged
    → Containers should not run in privileged mode.

  MV1001  high      Deployment/nginx  spec.template.spec.containers[0].securityContext.runAsNonRoot
    → Containers should set runAsNonRoot to true.

  MV1008  medium    Deployment/nginx  spec.template.spec.containers[0].resources
    → Containers should define resource limits for both CPU and memory.

  MV4001  medium    Deployment/nginx  spec.template.spec.containers[0].image
    → Image tag is "latest" or missing.

3 critical, 1 high, 2 medium across 1 resource
```

## Features

- **65 rules** across 6 categories (Pod Security, RBAC, Network, Image, Secrets, Best Practices)
- **Multiple input sources**: local files, directories, stdin, GitHub repos, live cluster
- **Multiple output formats**: TTY (colored), JSON, SARIF, HTML, Markdown
- **Helm & Kustomize** support (renders and scans templates)
- **Live cluster scanning** via kubeconfig
- **Fix suggestions**: per-rule YAML patches, optional LLM-augmented explanations
- **Interactive mode**: review and fix violations one by one
- **Admission webhook**: validate manifests on `kubectl apply`
- **Watch mode**: continuous monitoring with diff output
- **Custom rules**: JS plugin API and OPA/Rego policies
- **Baseline diffs**: track new violations over time
- **Pre-commit hook**: block commits with violations

---

## Installation

```bash
npm install -g manifestvet
```

---

## Usage

### Scan local files

```bash
manifestvet deployment.yaml service.yaml
manifestvet --dir ./k8s/
manifestvet --stdin < deployment.yaml
kubectl get deployment -o yaml | manifestvet --stdin
```

### Scan a GitHub repository

```bash
manifestvet --github owner/repo
manifestvet --github owner/repo --branch main --path k8s/
manifestvet --github https://github.com/owner/repo/blob/main/deploy.yaml
```

Authenticated requests (higher rate limit):
```bash
GITHUB_TOKEN=ghp_xxx manifestvet --github owner/repo
```

### Scan a live cluster

```bash
manifestvet --cluster
manifestvet --cluster --context my-cluster --namespace production
manifestvet --cluster --all-namespaces
```

Delta mode — show violations in the cluster that are absent from local manifests:
```bash
manifestvet --cluster --delta --dir ./k8s/
```

### Scan Helm charts

```bash
manifestvet --helm ./charts/myapp
manifestvet --helm ./charts/myapp --helm-values prod-values.yaml --helm-set image.tag=1.2.3
```

### Scan Kustomize overlays

```bash
manifestvet --kustomize ./overlays/production
```

---

## Output formats

```bash
manifestvet --format tty      deployment.yaml   # colored terminal (default)
manifestvet --format json     deployment.yaml   # JSON array of violations
manifestvet --format sarif    deployment.yaml   # SARIF 2.1 (GitHub Code Scanning)
manifestvet --format html     deployment.yaml   # standalone HTML report
manifestvet --format markdown deployment.yaml   # Markdown summary for PR comments
```

Save to file:
```bash
manifestvet --format html -o report.html deployment.yaml
```

Show violation summary:
```bash
manifestvet --summary deployment.yaml
```

---

## Fix suggestions

```bash
manifestvet --fix deployment.yaml              # append fix snippets to output
manifestvet --fix --fix-lang en deployment.yaml  # English explanations (default: ja)
manifestvet --fix --llm deployment.yaml        # LLM-powered suggestions (needs ANTHROPIC_API_KEY)
manifestvet --apply-fixes deployment.yaml      # auto-apply safe fixes (creates .bak backups)
```

---

## Subcommands

### Interactive mode

Review violations one by one in the terminal:

```bash
manifestvet --interactive deployment.yaml
# [F]ix  [I]gnore  [S]kip  [Q]uit
```

### Watch mode

Continuous monitoring with diff output (shows only new/resolved violations):

```bash
manifestvet watch --dir ./k8s/
manifestvet watch --cluster --interval 10m
```

### Pre-commit hook

```bash
manifestvet hook install    # install into .git/hooks/pre-commit
manifestvet hook uninstall
manifestvet hook config     # print hook configuration
```

### Admission webhook

Run as a Kubernetes validating admission webhook:

```bash
manifestvet webhook --port 8443 --cert cert.pem --key key.pem --severity high
```

### List rules

```bash
manifestvet rules                        # all rules (TTY format)
manifestvet rules --filter MV1           # filter by category
manifestvet rules --filter high          # filter by severity
manifestvet rules --format json          # JSON output
manifestvet rules --format markdown      # Markdown table
```

---

## Configuration

Create `.manifestvet.yaml` (or `.manifestvet.yml`) in your project root. Use `--config <file>` to specify a custom path.

```yaml
# Minimum severity to report (critical|high|medium|low|info, default: info)
severity: medium

# Output format (tty|json|sarif|html|markdown, default: tty)
format: tty

# Rules to ignore entirely
ignore:
  - MV6007   # preStop hook (too noisy for your team)
  - MV4002   # sha256 digest (not enforced yet)

# Per-rule severity overrides (case-insensitive rule IDs)
severityOverrides:
  MV6009: critical   # promote missing name to critical
  MV4001: high       # promote latest-tag to high

# Target Kubernetes version for deprecated API detection
k8sVersion: "1.28"

# Allowed image registries (MV4008 fires for anything outside this list)
allowedRegistries:
  - gcr.io/my-company
  - harbor.internal.example.com

# Namespaces to skip entirely
namespaceExclusions:
  - kube-system
  - monitoring

# Custom rule plugins (JS files exporting { rules: Rule[] })
plugins:
  - ./rules/my-custom-rules.js

# Write report to file
outputFile: report.html

# Fix suggestion language (ja|en, default: ja)
fixLang: en
```

### Inline ignores (per-file)

Add comments anywhere in a YAML file to suppress rules:

```yaml
# manifestvet-ignore: MV1001, MV1002
# manifestvet-ignore-all
apiVersion: apps/v1
kind: Deployment
...
```

---

## Rules

65 rules across 6 categories.

### Severity levels

| Level | Meaning |
|-------|---------|
| `critical` | Exploitable — immediate remediation required |
| `high` | Significant risk — fix before production |
| `medium` | Notable weakness — fix soon |
| `low` | Best-practice gap — fix when convenient |
| `info` | Informational / hardening opportunity |

---

### MV1xxx — Pod Security (18 rules)

| ID | Severity | Description |
|----|----------|-------------|
| MV1001 | high | `runAsNonRoot` not set to `true` |
| MV1002 | high | `allowPrivilegeEscalation` not set to `false` |
| MV1003 | critical | Container running in privileged mode |
| MV1004 | critical | `hostNetwork: true` |
| MV1005 | critical | `hostPID: true` |
| MV1006 | critical | `hostIPC: true` |
| MV1007 | high | Dangerous capabilities added (NET_ADMIN, SYS_ADMIN, SYS_PTRACE, …) |
| MV1008 | medium | No resource limits (cpu/memory) |
| MV1009 | info | No resource requests (cpu/memory) |
| MV1010 | low | `readOnlyRootFilesystem` not set to `true` |
| MV1011 | low | Seccomp profile not configured |
| MV1012 | medium | `capabilities.drop` does not include ALL |
| MV1013 | critical | `runAsUser: 0` (explicit root) |
| MV1014 | critical | `procMount: Unmasked` |
| MV1015 | low | Default service account token likely auto-mounted |
| MV1016 | medium | `automountServiceAccountToken` not explicitly `false` |
| MV1017 | low | `shareProcessNamespace: true` |
| MV1018 | low | `stdin` or `tty` enabled in container |

### MV2xxx — RBAC (10 rules)

| ID | Severity | Description |
|----|----------|-------------|
| MV2001 | high | Wildcard `*` in verbs |
| MV2002 | high | Wildcard `*` in resources |
| MV2003 | medium | Wildcard `*` in apiGroups |
| MV2004 | critical | ClusterRoleBinding to `cluster-admin` |
| MV2005 | medium | ServiceAccount `automountServiceAccountToken` not `false` |
| MV2006 | medium | Role grants access to `secrets` |
| MV2007 | medium | Role grants `exec` on pods |
| MV2008 | medium | ClusterRole with impersonation permissions |
| MV2009 | critical | RoleBinding to `system:unauthenticated` or `system:anonymous` |
| MV2010 | medium | ClusterRole grants broad read access (`get/list/watch` on `*`) |

### MV3xxx — Network (8 rules)

| ID | Severity | Description |
|----|----------|-------------|
| MV3001 | low | Service type `NodePort` |
| MV3002 | low | `hostPort` set in container ports |
| MV3003 | high | NetworkPolicy allows all ingress (missing `from` field) |
| MV3004 | high | NetworkPolicy allows all egress (missing `to` field) |
| MV3005 | info | LoadBalancer without `externalTrafficPolicy: Local` |
| MV3006 | info | Pod uses `hostAliases` |
| MV3007 | medium | Ingress without TLS configured |
| MV3008 | low | Namespace has no default-deny NetworkPolicy |

### MV4xxx — Image Security (8 rules)

| ID | Severity | Description |
|----|----------|-------------|
| MV4001 | medium | Image tag is `latest` or missing |
| MV4002 | info | Image has no sha256 digest |
| MV4003 | low | `imagePullPolicy: Never` |
| MV4004 | medium | `imagePullPolicy: IfNotPresent` without version pinning |
| MV4005 | medium | Init container uses `latest` tag |
| MV4006 | info | Custom/private registry without `imagePullSecrets` |
| MV4007 | info | Image uses implicit Docker Hub registry (no registry prefix) |
| MV4008 | high | Image registry not in `allowedRegistries` list |

> **Note:** MV4008 only fires when `allowedRegistries` is configured.

### MV5xxx — Secrets & Config (5 rules)

| ID | Severity | Description |
|----|----------|-------------|
| MV5001 | high | Env var with sensitive name has hardcoded value (PASSWORD, SECRET, TOKEN, KEY, …) |
| MV5002 | medium | Opaque Secret contains sensitive key names |
| MV5003 | low | ConfigMap contains keys with sensitive patterns |
| MV5004 | info | Volume uses `hostPath` |
| MV5005 | info | Sensitive env var sourced from ConfigMap instead of Secret |

### MV6xxx — Best Practices (16 rules)

| ID | Severity | Description |
|----|----------|-------------|
| MV6001 | low | Missing recommended labels (`app.kubernetes.io/name`, `version`) |
| MV6002 | low | `replicas: 1` — no high availability |
| MV6003 | low | Container missing `livenessProbe` |
| MV6004 | low | Container missing `readinessProbe` |
| MV6005 | low | Deployment missing `podAntiAffinity` |
| MV6006 | low | Deployment without RollingUpdate strategy |
| MV6007 | low | Container missing `lifecycle.preStop` hook |
| MV6008 | low | Resource in `default` namespace |
| MV6009 | high | `metadata.name` missing or empty |
| MV6010 | low | Deployment without `minReadySeconds` |
| MV6011 | low | `terminationMessagePolicy` not set to `FallbackToLogsOnError` |
| MV6012 | low | `revisionHistoryLimit` not set |
| MV6013 | low | `progressDeadlineSeconds` not set |
| MV6014 | low | `livenessProbe` without `startupProbe` |
| MV6015 | low | Deployment with multiple replicas has no PodDisruptionBudget |
| MV6016 | medium | Deprecated and removed Kubernetes API version |

---

## CI Integration

### GitHub Actions

```yaml
name: Lint Kubernetes manifests
on: [push, pull_request]

jobs:
  manifestvet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Scan manifests
        run: |
          npm install -g manifestvet
          manifestvet --format sarif --dir ./k8s/ -o results.sarif

      - name: Upload to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
```

PR comment (Markdown output):
```yaml
      - name: Scan and comment
        run: |
          manifestvet --format markdown --dir ./k8s/ -o scan-results.md
          gh pr comment ${{ github.event.pull_request.number }} --body-file scan-results.md
```

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | No violations (or `--exit-zero` set) |
| `1` | Violations found |
| `2` | Usage/configuration error |

Use `--exit-zero` to always exit 0 (for gradual CI adoption):
```bash
manifestvet --exit-zero --dir ./k8s/
```

---

## Custom Rules (Plugin API)

Create a JS file exporting a `rules` array:

```js
// my-rules.js
module.exports = {
  rules: [
    {
      id: "MY001",
      severity: "high",
      description: "Deployments must have at least 2 replicas.",
      check({ resource }) {
        if (resource.kind !== "Deployment") return [];
        const replicas = resource.spec?.replicas ?? 1;
        if (replicas < 2) {
          return [{
            rule: "MY001",
            severity: "high",
            message: `Deployment/${resource.metadata.name} has only ${replicas} replica(s).`,
            resource: `Deployment/${resource.metadata.name}`,
            path: "spec.replicas",
            fix: "Set spec.replicas to at least 2.",
          }];
        }
        return [];
      },
    },
  ],
};
```

```bash
manifestvet --plugin ./my-rules.js deployment.yaml
```

---

## OPA / Rego Policies

```bash
manifestvet --rego policy.rego deployment.yaml
```

The Rego policy must define `data.manifestvet.violations` as an array of objects with `rule`, `severity`, `message`, and `resource` fields.

---

## Baseline diffs

Track regressions over time — only report *new* violations since last save:

```bash
# First run: save baseline
manifestvet --baseline baseline.json --dir ./k8s/

# Subsequent runs: show only new violations
manifestvet --baseline baseline.json --dir ./k8s/
```

Force-save (overwrite):
```bash
manifestvet --baseline-save baseline.json --dir ./k8s/
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token for higher API rate limits (5000 req/hr vs 60) |
| `ANTHROPIC_API_KEY` | Anthropic API key for `--llm` fix suggestions |

---

## Development

```bash
git clone https://github.com/ManifestVet/manifestvet
cd manifestvet
npm install

npm test          # run all tests (vitest)
npm run build     # compile TypeScript
npm run lint      # type-check only
```

### Project structure

```
src/
  rules/mv{1-6}/   Rule implementations (MV1=pod security, MV2=RBAC, MV3=network,
                   MV4=images, MV5=secrets, MV6=best practices)
  engine/          Linter engine and config loading
  formatter/       Output formatters (tty, json, sarif, html, markdown, summary)
  parser/          YAML parser (multi-doc, all major K8s kinds)
  fixes/           Fix suggestions and auto-apply
  index.ts         CLI entry point
tests/
  rules/           Per-category rule unit tests
  *.test.ts        Integration and formatter tests
oss/
  scan.ts          Scans OSS GitHub repos for continuous quality validation
  analyze.ts       Produces analysis reports from scan results
  cache/           Cached YAML files (7-day TTL, 46 projects)
  results/         Scan results and analysis reports
```

---

## License

MIT
