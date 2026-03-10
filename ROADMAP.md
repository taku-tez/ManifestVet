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

- [ ] `--github owner/repo` — fetch all YAML files via GitHub API
- [ ] `--github owner/repo --branch <branch>` — branch targeting
- [ ] `--github owner/repo --path k8s/` — subdirectory filtering
- [ ] `--github <blob-url>` — direct file URL support
- [ ] Rate limit handling (authenticated requests)

---

## v0.3.0 — Live Cluster Scanning (Week 3)

**Goal:** Scan running workloads without touching source files.

- [ ] `--cluster` — use current kubeconfig context
- [ ] `--context <name>` — target specific kubeconfig context
- [ ] `--namespace <ns>` / `--all-namespaces` flags
- [ ] Fetch all workload resources via kubectl/K8s API
- [ ] Delta mode: compare cluster state vs local manifests

---

## v0.4.0 — LLM Fix Suggestions (Week 4–5)

**Goal:** Generate concrete fix snippets for each violation.

- [ ] `--fix` flag — append fix suggestions to output
- [ ] `--fix-lang ja` — Japanese-language explanations (default)
- [ ] Per-rule fix templates (YAML patch snippets)
- [ ] LLM-augmented suggestions for complex violations
- [ ] `--apply-fixes` — auto-apply safe fixes to files (with backup)

---

## v0.5.0 — Report & Integrations (Week 6)

**Goal:** Rich reporting and ecosystem integrations.

- [ ] `--format html` — standalone HTML report with rule details
- [ ] `--format markdown` — Markdown summary for PR comments
- [ ] Pre-commit hook support
- [ ] Kustomize overlay awareness
- [ ] Policy exceptions (`# manifestvet-ignore: MV1001`)

---

## Future

- [ ] Custom rule authoring (plugin API)
- [ ] OPA/Rego policy import
- [ ] Admission webhook mode (validate on `kubectl apply`)
- [ ] VS Code extension
- [ ] Baseline diff (only report new violations vs last run)
