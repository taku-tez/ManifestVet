# ManifestVet Roadmap

## v0.1.0 — Core Engine (Week 1)

**Goal:** Working linter with 53 rules and full test coverage.

- [x] YAML parser (multi-doc, all major K8s kinds)
- [x] Rule engine (MV1-6, 53 rules)
- [x] TTY / JSON / SARIF formatters
- [x] CLI (`--format`, `--ignore`, `--severity`, `--stdin`, `--dir`)
- [x] 150+ tests
- [ ] npm publish

**Supported kinds:** Deployment, StatefulSet, DaemonSet, Job, CronJob, Pod, Service, ServiceAccount, Role, ClusterRole, RoleBinding, ClusterRoleBinding, NetworkPolicy, ConfigMap, Secret, Ingress, Namespace, PersistentVolumeClaim

---

## v0.2.0 — Remote Scanning (Week 2)

**Goal:** Scan manifests directly from GitHub without cloning.

- [x] `--github owner/repo` — fetch all YAML files via GitHub API
- [x] `--github owner/repo --branch <branch>` — branch targeting
- [x] `--github owner/repo --path k8s/` — subdirectory filtering
- [x] `--github <blob-url>` — direct file URL support
- [x] Rate limit handling (authenticated requests, `GITHUB_TOKEN` env var)

---

## v0.3.0 — Live Cluster Scanning (Week 3)

**Goal:** Scan running workloads without touching source files.

- [x] `--cluster` — use current kubeconfig context
- [x] `--context <name>` — target specific kubeconfig context
- [x] `--namespace <ns>` / `--all-namespaces` flags
- [x] Fetch all workload resources via kubectl/K8s API
- [x] Delta mode: compare cluster state vs local manifests (`--cluster --delta --dir ./k8s/`)

---

## v0.4.0 — LLM Fix Suggestions (Week 4–5)

**Goal:** Generate concrete fix snippets for each violation.

- [x] `--fix` flag — append fix suggestions to output
- [x] `--fix-lang ja` — Japanese-language explanations (default)
- [x] Per-rule fix templates (YAML patch snippets, all 53 rules, bilingual ja/en)
- [x] LLM-augmented suggestions for complex violations (`--llm`, requires `ANTHROPIC_API_KEY`)
- [x] `--apply-fixes` — auto-apply safe fixes to files (with `.manifestvet.bak` backup)

---

## v0.5.0 — Report & Integrations (Week 6)

**Goal:** Rich reporting and ecosystem integrations.

- [x] `--format html` — standalone HTML report with rule details and collapsible fix suggestions
- [x] `--format markdown` — Markdown summary for PR comments (with severity badges, grouped by resource)
- [x] Pre-commit hook support (`manifestvet hook install|uninstall|config`)
- [x] Kustomize overlay awareness (`--kustomize <dir>`, recursively resolves resources/bases/patches)
- [x] Policy exceptions (`# manifestvet-ignore: MV1001` / `# manifestvet-ignore-all` in YAML files)

---

## v1.0.0 — Enterprise Features

**Goal:** Extensibility, policy-as-code, and GitOps-native validation.

- [x] Custom rule authoring (`--plugin my-rules.js` — export `{ rules: Rule[] }`)
- [x] OPA/Rego policy import (`--rego policy.rego` — `data.manifestvet.violations`)
- [x] Admission webhook mode (`manifestvet webhook --port 8443 [--cert] [--key]`)
- [x] Baseline diff (`--baseline baseline.json` — save on first run, diff on subsequent)
- [ ] VS Code extension

---

## Future

- [ ] Custom rule authoring via YAML/DSL (no-code approach)
- [ ] Baseline UI diff report (`--format html` baseline comparison)
- [ ] Admission webhook Helm chart
- [ ] VS Code extension with inline diagnostics
