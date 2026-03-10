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

---

## v1.1.0 — CI/CD Native

**Goal:** ゼロ設定で CI/CD パイプラインに導入できる、GitHub Actions Marketplace での公開。

- [ ] `action.yml` — GitHub Actions Marketplace 公開
- [ ] PR への自動コメント（Markdown 形式、違反差分のみ）
- [ ] GitHub Code Scanning 連携強化（SARIF アップロード自動化）
- [ ] GitLab CI / Bitbucket Pipelines テンプレート
- [ ] `--exit-zero` フラグ（CI を落とさずレポートのみ出力）

---

## v1.2.0 — Helm ネイティブ対応

**Goal:** K8s の主要パッケージ形式 Helm を直接スキャン。

- [ ] `--helm <chart-dir>` — `helm template` を内部実行してスキャン
- [ ] `--helm-values values.yaml` — values ファイル指定
- [ ] `--helm-set key=value` — テンプレート変数オーバーライド
- [ ] Chart.yaml の metadata バリデーション（appVersion, deprecated API 検出）
- [ ] Helm リポジトリからの直接スキャン（`--helm-repo https://...`）

---

## v1.3.0 — コンプライアンスフレームワーク

**Goal:** 企業の監査・コンプライアンス要件に対応し、エンタープライズ採用を加速。

- [ ] CIS Kubernetes Benchmark v1.8 へのルール紐付け
- [ ] NSA/CISA Kubernetes Hardening Guide マッピング
- [ ] `--compliance cis|nsa` — コンプライアンス別フィルタリング
- [ ] `--format compliance-report` — 準拠率・未達項目の監査レポート出力
- [ ] 違反への CVE/CWE 番号付与
- [ ] `manifestvet rules --format markdown` — ルール一覧ページ生成

---

## v1.4.0 — サプライチェーンセキュリティ

**Goal:** イメージレベルのリスクも可視化し、SLSA/Sigstore トレンドに対応。

- [ ] Trivy 連携 — `--trivy-scan` でイメージ脆弱性をインライン表示
- [ ] Sigstore/cosign 署名検証（`MV7001: image not signed`）
- [ ] SBOM 存在チェック（Syft などで生成された SBOM の参照確認）
- [ ] イメージのベースイメージ追跡（distroless / full OS 検出）
- [ ] 許可レジストリリスト外のイメージ検出（`.manifestvet.yaml` の `allowedRegistries`）

---

## v1.5.0 — 継続監視モード

**Goal:** 一度きりのスキャンから常時監視へ。クラスターのドリフトをリアルタイム検知。

- [ ] `manifestvet watch --cluster --interval 5m` — 定期スキャンとアラート
- [ ] Prometheus `/metrics` エンドポイント（違反数をゲージで公開）
- [ ] Alertmanager / PagerDuty 通知インテグレーション
- [ ] Slack Webhook 通知（新規違反のみ）
- [ ] 違反履歴の SQLite 保存と `--format trend` での時系列表示

---

## v2.0.0 — VS Code 拡張 + Web ダッシュボード

**Goal:** 開発者体験の大幅向上とチームへの普及。

- [ ] VS Code 拡張（YAML 編集中にインライン診断・ホバーで修正提案）
- [ ] Language Server Protocol (LSP) 実装（IntelliJ 等も対応可能に）
- [ ] Web ダッシュボード（React）— クラスター横断の違反状況ヒートマップ
- [ ] マルチクラスター管理（複数の kubeconfig コンテキストを集約）
- [ ] チーム単位のポリシー設定・閲覧 RBAC

---

## 優先順位の根拠

| バージョン | 採用インパクト | 実装コスト | 優先度 |
|-----------|-------------|----------|--------|
| v1.1.0 CI/CD | ⭐⭐⭐⭐⭐ | 低 | 最高 |
| v1.2.0 Helm | ⭐⭐⭐⭐ | 中 | 高 |
| v1.3.0 Compliance | ⭐⭐⭐⭐ | 中 | 高 |
| v1.4.0 Supply chain | ⭐⭐⭐ | 高 | 中〜高 |
| v1.5.0 監視 | ⭐⭐⭐ | 高 | 中 |
| v2.0.0 IDE/Web | ⭐⭐⭐⭐⭐ | 最高 | 中長期 |
