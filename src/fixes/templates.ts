export type FixLang = "ja" | "en";

export interface FixTemplate {
  ja: string;
  en: string;
  patch: string;
  /** Can be auto-applied with --apply-fixes (additive-only, no value decisions needed) */
  safe: boolean;
}

export const FIX_TEMPLATES: Record<string, FixTemplate> = {
  // ─── MV1xxx — Pod Security ────────────────────────────────────────────
  MV1001: {
    ja: "`securityContext.runAsNonRoot: true` を設定して非rootユーザーでコンテナを実行してください。",
    en: "Set `securityContext.runAsNonRoot: true` to enforce non-root execution.",
    patch: `securityContext:
  runAsNonRoot: true
  runAsUser: 1000`,
    safe: true,
  },
  MV1002: {
    ja: "`securityContext.allowPrivilegeEscalation: false` を設定して特権昇格を無効化してください。",
    en: "Set `securityContext.allowPrivilegeEscalation: false` to prevent privilege escalation.",
    patch: `securityContext:
  allowPrivilegeEscalation: false`,
    safe: true,
  },
  MV1003: {
    ja: "`securityContext.privileged: true` を削除するか `false` に変更してください。特権コンテナはホストのカーネルに完全アクセスできます。",
    en: "Remove `securityContext.privileged: true` or set it to `false`. Privileged containers have full host kernel access.",
    patch: `securityContext:
  privileged: false`,
    safe: false,
  },
  MV1004: {
    ja: "`spec.hostNetwork: true` を削除してください。ホストのネットワーク名前空間を共有するとネットワーク分離が失われます。",
    en: "Remove `spec.hostNetwork: true`. Sharing the host network namespace breaks network isolation.",
    patch: `# hostNetwork: true  ← この行を削除`,
    safe: false,
  },
  MV1005: {
    ja: "`spec.hostPID: true` を削除してください。ホストのPID名前空間を共有するとプロセス分離が失われます。",
    en: "Remove `spec.hostPID: true`. Sharing the host PID namespace breaks process isolation.",
    patch: `# hostPID: true  ← この行を削除`,
    safe: false,
  },
  MV1006: {
    ja: "`spec.hostIPC: true` を削除してください。ホストのIPC名前空間を共有するとIPC分離が失われます。",
    en: "Remove `spec.hostIPC: true`. Sharing the host IPC namespace breaks IPC isolation.",
    patch: `# hostIPC: true  ← この行を削除`,
    safe: false,
  },
  MV1007: {
    ja: "危険なCapabilityを `capabilities.add` から削除してください。最小権限の原則を適用し、必要なCapabilityのみを付与してください。",
    en: "Remove dangerous capabilities from `capabilities.add`. Apply the principle of least privilege.",
    patch: `securityContext:
  capabilities:
    drop: [ALL]
    add: []  # 必要なCapabilityのみ列挙`,
    safe: false,
  },
  MV1008: {
    ja: "リソースlimitsを設定してください。設定がないとノードのリソース枯渇を引き起こす可能性があります。",
    en: "Set resource limits. Without them, containers can exhaust node resources.",
    patch: `resources:
  limits:
    cpu: "500m"
    memory: "256Mi"
  requests:
    cpu: "100m"
    memory: "128Mi"`,
    safe: false,
  },
  MV1009: {
    ja: "リソースrequestsを設定してください。スケジューラーが適切なノードを選択できるようになります。",
    en: "Set resource requests to help the scheduler place the pod on an appropriate node.",
    patch: `resources:
  requests:
    cpu: "100m"
    memory: "128Mi"`,
    safe: false,
  },
  MV1010: {
    ja: "`securityContext.readOnlyRootFilesystem: true` を設定してルートファイルシステムを読み取り専用にしてください。書き込みが必要な場合は `emptyDir` Volumeを使用してください。",
    en: "Set `securityContext.readOnlyRootFilesystem: true`. Use `emptyDir` volumes for writable paths.",
    patch: `securityContext:
  readOnlyRootFilesystem: true
# 書き込みが必要なパスがある場合:
volumeMounts:
  - name: tmp
    mountPath: /tmp
volumes:
  - name: tmp
    emptyDir: {}`,
    safe: true,
  },
  MV1011: {
    ja: "Seccompプロファイルを設定してください。`RuntimeDefault` が推奨値です。",
    en: "Configure a Seccomp profile. `RuntimeDefault` is recommended.",
    patch: `securityContext:
  seccompProfile:
    type: RuntimeDefault`,
    safe: true,
  },
  MV1012: {
    ja: "`capabilities.drop: [ALL]` を設定してすべてのLinux Capabilityを削除してください。必要なものだけ `add` で付与してください。",
    en: "Set `capabilities.drop: [ALL]` to remove all Linux capabilities, then add back only what is needed.",
    patch: `securityContext:
  capabilities:
    drop: [ALL]`,
    safe: true,
  },
  MV1013: {
    ja: "`runAsUser: 0` を削除するか、1000以上の値に変更してください。rootユーザーでの実行はセキュリティリスクです。",
    en: "Remove `runAsUser: 0` or change it to a value ≥ 1000. Running as root is a security risk.",
    patch: `securityContext:
  runAsUser: 1000
  runAsNonRoot: true`,
    safe: false,
  },
  MV1014: {
    ja: "`procMount: Unmasked` を削除してください。デフォルトの `Default` を使用することで /proc パスがマスクされます。",
    en: "Remove `procMount: Unmasked`. The default `Default` value masks sensitive /proc paths.",
    patch: `# procMount: Unmasked  ← この行を削除 (またはDefault に変更)`,
    safe: false,
  },
  MV1015: {
    ja: "アプリ専用のServiceAccountを作成して `serviceAccountName` を明示的に指定してください。未設定の場合、KubernetesはPodに `default` ServiceAccountを自動割り当てします。",
    en: "Create a dedicated ServiceAccount and set serviceAccountName explicitly. When not set, Kubernetes automatically assigns the `default` ServiceAccount to the Pod.",
    patch: `# 専用のServiceAccountを作成:
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app-sa
  namespace: my-namespace
automountServiceAccountToken: false
---
# Deploymentで参照:
spec:
  template:
    spec:
      serviceAccountName: my-app-sa
      automountServiceAccountToken: false`,
    safe: false,
  },
  MV1016: {
    ja: "`automountServiceAccountToken: false` をPodまたはServiceAccountに設定してください。APIサーバーへのアクセスが不要なら無効化が推奨です。",
    en: "Set `automountServiceAccountToken: false` on the Pod or ServiceAccount if API access is not required.",
    patch: `spec:
  automountServiceAccountToken: false`,
    safe: true,
  },

  // ─── MV2xxx — RBAC ────────────────────────────────────────────────────
  MV2001: {
    ja: "verbsのワイルドカード `*` を削除して、必要な操作（get, list, watch など）のみを明示的に指定してください。",
    en: "Replace the wildcard `*` in verbs with explicit operations (e.g., get, list, watch).",
    patch: `rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch"]`,
    safe: false,
  },
  MV2002: {
    ja: "resourcesのワイルドカード `*` を削除して、必要なリソース種別のみを明示的に指定してください。",
    en: "Replace the wildcard `*` in resources with the specific resource types needed.",
    patch: `rules:
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list"]`,
    safe: false,
  },
  MV2003: {
    ja: "apiGroupsのワイルドカード `*` を削除して、必要なAPIグループのみを指定してください。",
    en: "Replace the wildcard `*` in apiGroups with the specific API groups needed.",
    patch: `rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list"]`,
    safe: false,
  },
  MV2004: {
    ja: "`cluster-admin` ClusterRoleへのバインドを削除してください。最小権限のRoleを作成して使用してください。",
    en: "Remove the ClusterRoleBinding to `cluster-admin`. Create a least-privilege Role instead.",
    patch: `# cluster-admin バインドを削除し、専用のRoleを作成する
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: my-app-role
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch"]`,
    safe: false,
  },
  MV2005: {
    ja: "ServiceAccountに `automountServiceAccountToken: false` を設定してください。",
    en: "Set `automountServiceAccountToken: false` on the ServiceAccount.",
    patch: `automountServiceAccountToken: false`,
    safe: true,
  },
  MV2006: {
    ja: "Secretsへのアクセス権を最小化してください。本当に必要な場合のみ許可し、対象のSecret名を `resourceNames` で制限してください。",
    en: "Minimize access to Secrets. If needed, restrict to specific secret names using `resourceNames`.",
    patch: `rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
    resourceNames: ["my-specific-secret"]`,
    safe: false,
  },
  MV2007: {
    ja: "PodへのExec権限（`pods/exec`）を削除してください。本番環境では不要な権限です。",
    en: "Remove the `pods/exec` resource from Role rules. It is not needed in production.",
    patch: `# rules から pods/exec を削除してください`,
    safe: false,
  },
  MV2008: {
    ja: "Impersonation権限（`users`, `groups`, `serviceaccounts` への impersonate verb）を削除してください。",
    en: "Remove impersonation permissions (`impersonate` verb on users/groups/serviceaccounts).",
    patch: `# impersonate verb を含むルールを削除してください`,
    safe: false,
  },
  MV2009: {
    ja: "`system:unauthenticated` または `system:anonymous` へのバインドを削除してください。匿名ユーザーへの権限付与は危険です。",
    en: "Remove bindings to `system:unauthenticated` or `system:anonymous`. These grant access to anonymous users.",
    patch: `# subjects から system:unauthenticated / system:anonymous を削除してください`,
    safe: false,
  },

  // ─── MV3xxx — Network ─────────────────────────────────────────────────
  MV3001: {
    ja: "Service typeを `NodePort` から `ClusterIP` に変更し、外部アクセスにはIngressまたはLoadBalancerを使用してください。",
    en: "Change Service type from `NodePort` to `ClusterIP` and use Ingress or LoadBalancer for external access.",
    patch: `spec:
  type: ClusterIP`,
    safe: false,
  },
  MV3002: {
    ja: "`hostPort` を削除してください。ホストのポートを直接使用するとポート競合やセキュリティリスクがあります。ServiceとIngressを使用してください。",
    en: "Remove `hostPort`. Using host ports directly causes port conflicts and security risks. Use Services instead.",
    patch: `ports:
  - containerPort: 8080
    # hostPort: 8080  ← この行を削除`,
    safe: false,
  },
  MV3003: {
    ja: "NetworkPolicyのingressルールに `from` フィールドがない、または `from: []` / `from: [{}]` の場合、すべての送信元を許可します。NamespaceSelector/PodSelectorで送信元を制限してください。",
    en: "A NetworkPolicy ingress rule with no `from` field, `from: []`, or `from: [{}]` allows all sources per Kubernetes semantics. Restrict with namespaceSelector/podSelector.",
    patch: `spec:
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: my-namespace
          podSelector:
            matchLabels:
              app: my-app
      ports:
        - protocol: TCP
          port: 8080`,
    safe: false,
  },
  MV3004: {
    ja: "NetworkPolicyのegressルールに `to` フィールドがない、または `to: []` / `to: [{}]` の場合、すべての宛先を許可します。NamespaceSelector/PodSelectorで宛先を制限してください。",
    en: "A NetworkPolicy egress rule with no `to` field, `to: []`, or `to: [{}]` allows all destinations per Kubernetes semantics. Restrict with namespaceSelector/podSelector.",
    patch: `spec:
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: my-namespace
      ports:
        - protocol: TCP
          port: 443`,
    safe: false,
  },
  MV3005: {
    ja: "`externalTrafficPolicy: Local` を設定して、クライアントIPの保持とノードへの不要なトラフィック転送を防いでください。",
    en: "Set `externalTrafficPolicy: Local` to preserve client IPs and avoid unnecessary cross-node traffic.",
    patch: `spec:
  externalTrafficPolicy: Local`,
    safe: true,
  },
  MV3006: {
    ja: "`hostAliases` の使用を見直してください。DNS管理はCoreDNSで行うことを検討してください。",
    en: "Review the use of `hostAliases`. Consider managing DNS entries via CoreDNS instead.",
    patch: `# hostAliases の使用が本当に必要か確認してください`,
    safe: false,
  },
  MV3007: {
    ja: "IngressにTLSを設定してください。cert-managerを使用した自動証明書管理が推奨です。",
    en: "Configure TLS for the Ingress. Using cert-manager for automatic certificate management is recommended.",
    patch: `spec:
  tls:
    - hosts:
        - example.com
      secretName: example-tls
  rules:
    - host: example.com`,
    safe: false,
  },

  // ─── MV4xxx — Image Security ──────────────────────────────────────────
  MV4001: {
    ja: "イメージタグを `latest` から具体的なバージョンに変更してください。イメージダイジェストの固定も推奨です。",
    en: "Replace the `latest` image tag with a specific version. Pinning to a digest is also recommended.",
    patch: `image: nginx:1.25.3
# または digest で固定:
# image: nginx@sha256:abc123...`,
    safe: false,
  },
  MV4002: {
    ja: "イメージをダイジェスト (`sha256:...`) で固定してください。タグは変更される可能性がありますが、ダイジェストは不変です。",
    en: "Pin the image to a digest (`sha256:...`). Tags can be mutated but digests are immutable.",
    patch: `image: nginx:1.25.3@sha256:abc123...`,
    safe: false,
  },
  MV4003: {
    ja: "`imagePullPolicy: Never` を削除または変更してください。ローカルイメージのみを使用するとCI/CD環境で問題が発生します。",
    en: "Remove or change `imagePullPolicy: Never`. Relying solely on local images causes issues in CI/CD.",
    patch: `imagePullPolicy: IfNotPresent`,
    safe: false,
  },
  MV4004: {
    ja: "`IfNotPresent` ポリシーを使用する場合はイメージタグをバージョン固定してください。`latest` との組み合わせは更新が反映されません。",
    en: "When using `IfNotPresent`, ensure the image tag is a specific version, not `latest`.",
    patch: `image: nginx:1.25.3
imagePullPolicy: IfNotPresent`,
    safe: false,
  },
  MV4005: {
    ja: "initContainerのイメージタグを `latest` から具体的なバージョンに変更してください。",
    en: "Replace the `latest` tag on the initContainer image with a specific version.",
    patch: `initContainers:
  - name: init
    image: busybox:1.36`,
    safe: false,
  },
  MV4006: {
    ja: "`imagePullSecrets` を設定してプライベートレジストリからのイメージ取得を認証してください。",
    en: "Set `imagePullSecrets` to authenticate pulls from private registries.",
    patch: `spec:
  imagePullSecrets:
    - name: my-registry-secret`,
    safe: false,
  },

  // ─── MV5xxx — Secrets & Config ────────────────────────────────────────
  MV5001: {
    ja: "ハードコードされた機密情報を `secretKeyRef` に置き換えてください。Secretオブジェクトを作成して参照してください。",
    en: "Replace hardcoded sensitive values with `secretKeyRef` references to Kubernetes Secrets.",
    patch: `env:
  - name: MY_PASSWORD
    valueFrom:
      secretKeyRef:
        name: my-secret
        key: password`,
    safe: false,
  },
  MV5002: {
    ja: "Secretのデータは平文でetcdに保存されます。KMS暗号化またはSealed Secrets/External Secrets Operatorの使用を検討してください。",
    en: "Secret data is stored as base64 in etcd. Consider KMS encryption or Sealed Secrets/External Secrets Operator.",
    patch: `# Sealed Secrets の例:
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: my-secret
spec:
  encryptedData:
    password: AgBy3i4OJSWK...`,
    safe: false,
  },
  MV5003: {
    ja: "機密性の高いデータはConfigMapではなくSecretに保管してください。",
    en: "Store sensitive data in a Secret, not a ConfigMap.",
    patch: `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
stringData:
  my-key: my-value`,
    safe: false,
  },
  MV5004: {
    ja: "`hostPath` Volumeはノードのファイルシステムに直接アクセスします。`emptyDir` またはPersistentVolumeClaimに置き換えてください。",
    en: "Replace `hostPath` volumes with `emptyDir` or PersistentVolumeClaim to avoid direct host filesystem access.",
    patch: `volumes:
  - name: data
    emptyDir: {}
# または:
  - name: data
    persistentVolumeClaim:
      claimName: my-pvc`,
    safe: false,
  },
  MV5005: {
    ja: "機密性の高い環境変数はConfigMapではなくSecretから参照してください。",
    en: "Source sensitive environment variables from a Secret, not a ConfigMap.",
    patch: `env:
  - name: MY_SECRET
    valueFrom:
      secretKeyRef:  # configMapKeyRef → secretKeyRef に変更
        name: my-secret
        key: my-key`,
    safe: false,
  },

  // ─── MV6xxx — Best Practices ──────────────────────────────────────────
  MV6001: {
    ja: "推奨ラベルを追加してください。`app.kubernetes.io/name` と `app.kubernetes.io/version` は必須です。",
    en: "Add recommended labels: `app.kubernetes.io/name` and `app.kubernetes.io/version` are required.",
    patch: `metadata:
  labels:
    app.kubernetes.io/name: my-app
    app.kubernetes.io/version: "1.0.0"
    app.kubernetes.io/component: backend
    app.kubernetes.io/part-of: my-system`,
    safe: true,
  },
  MV6002: {
    ja: "`replicas: 1` では単一障害点になります。本番環境では `replicas: 2` 以上に設定してください。",
    en: "With `replicas: 1` the workload has a single point of failure. Set `replicas: 2` or more for production.",
    patch: `spec:
  replicas: 2`,
    safe: false,
  },
  MV6003: {
    ja: "`livenessProbe` を設定してください。コンテナがデッドロック状態になったときに自動再起動されます。",
    en: "Add a `livenessProbe` so Kubernetes can restart containers that are deadlocked.",
    patch: `livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3`,
    safe: false,
  },
  MV6004: {
    ja: "`readinessProbe` を設定してください。準備できていないPodへのトラフィック送信を防ぎます。",
    en: "Add a `readinessProbe` to prevent traffic from being sent to pods that are not ready.",
    patch: `readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3`,
    safe: false,
  },
  MV6005: {
    ja: "`podAntiAffinity` を設定して、同じDeploymentのPodが別々のノードに分散されるようにしてください。",
    en: "Add `podAntiAffinity` to spread pods of the same Deployment across different nodes.",
    patch: `spec:
  template:
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: my-app
                topologyKey: kubernetes.io/hostname`,
    safe: true,
  },
  MV6006: {
    ja: "ローリングアップデート戦略を設定してください。`maxUnavailable: 0` で無停止デプロイができます。",
    en: "Configure a rolling update strategy. Setting `maxUnavailable: 0` enables zero-downtime deployments.",
    patch: `spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0`,
    safe: true,
  },
  MV6007: {
    ja: "`lifecycle.preStop` フックを設定して、コンテナ終了前にグレースフルシャットダウン処理を行ってください。",
    en: "Add a `lifecycle.preStop` hook to allow graceful shutdown before the container is terminated.",
    patch: `lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]`,
    safe: true,
  },
  MV6008: {
    ja: "`metadata.namespace` を明示的に指定してください。`default` ネームスペースの使用は推奨されません。",
    en: "Set `metadata.namespace` explicitly. Using the `default` namespace is not recommended.",
    patch: `metadata:
  namespace: my-namespace`,
    safe: false,
  },
  MV6009: {
    ja: "`metadata.name` を設定してください。リソース名は必須です。",
    en: "Set `metadata.name`. A resource name is required.",
    patch: `metadata:
  name: my-resource-name`,
    safe: false,
  },
  MV6010: {
    ja: "`minReadySeconds` を設定してください。新しいPodが準備できてから古いPodを削除するまでの待機時間を指定します。",
    en: "Set `minReadySeconds` to define how long a new pod must be ready before the old one is removed.",
    patch: `spec:
  minReadySeconds: 10`,
    safe: true,
  },
  MV6011: {
    ja: "`terminationMessagePolicy: FallbackToLogsOnError` を設定してください。終了メッセージファイルが空の場合にログの末尾を自動的に使用します。",
    en: "Set `terminationMessagePolicy: FallbackToLogsOnError` to automatically use container log output as the termination message when the termination message file is empty.",
    patch: `containers:
  - name: my-app
    terminationMessagePolicy: FallbackToLogsOnError`,
    safe: true,
  },
  MV6012: {
    ja: "`revisionHistoryLimit` を 3〜5 に設定してください。デフォルトの10は不要な古いReplicaSetをetcdに蓄積させます。",
    en: "Set `revisionHistoryLimit` to 3–5. The default of 10 accumulates old ReplicaSets in etcd unnecessarily.",
    patch: `spec:
  revisionHistoryLimit: 3`,
    safe: true,
  },
  MV6013: {
    ja: "StatefulSetの `podManagementPolicy: Parallel` を設定してください。厳密な順序が不要な場合、スケールアップ・ローリングアップデートが大幅に高速化されます。",
    en: "Set `podManagementPolicy: Parallel` on the StatefulSet. When strict pod ordering is not required, this significantly speeds up scale-up and rolling updates.",
    patch: `spec:
  podManagementPolicy: Parallel`,
    safe: false,
  },

  // ─── MV2010 ────────────────────────────────────────────────────────────
  MV2010: {
    ja: "ClusterRoleでワイルドカードリソース (`*`) への get/list/watch を削除してください。Secrets や ConfigMap などすべてのリソースへの読み取りアクセスは過剰な権限です。",
    en: "Remove get/list/watch on all resources (`*`) from the ClusterRole. Read access to all resources grants broad access to Secrets and ConfigMaps cluster-wide.",
    patch: `rules:
  # ワイルドカード (*) を具体的なリソースに置き換える:
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods", "configmaps"]
    verbs: ["get", "list"]`,
    safe: false,
  },

  // ─── MV4007 ────────────────────────────────────────────────────────────
  MV4007: {
    ja: "イメージにレジストリプレフィックスを明示的に指定してください。プレフィックスなしの場合は Docker Hub (`docker.io`) が暗黙的に使用されます。本番ではプライベートレジストリまたはミラーレジストリを推奨します。",
    en: "Specify the full registry prefix for the image. Without a prefix, Docker Hub (`docker.io`) is used implicitly. For production, use a private or mirrored registry.",
    patch: `# Docker Hub を明示指定:
image: docker.io/nginx:1.25.3
# または社内レジストリ/ミラーを使用:
image: my-registry.example.com/nginx:1.25.3`,
    safe: false,
  },

  // ─── MV1017 ────────────────────────────────────────────────────────────
  MV1017: {
    ja: "`shareProcessNamespace: false` を設定するか、フィールドを削除してください。プロセス名前空間の共有はコンテナ間でシグナルの送信やプロセス情報の参照を可能にし、セキュリティリスクになります。",
    en: "Remove `shareProcessNamespace` or set it to `false`. Shared process namespace allows containers to inspect and signal each other's processes, which is a security risk.",
    patch: `spec:
  shareProcessNamespace: false`,
    safe: true,
  },

  // ─── MV6014 ────────────────────────────────────────────────────────────
  MV6014: {
    ja: "`startupProbe` を追加して、起動に時間がかかるコンテナが `livenessProbe` によって早期に再起動されないよう保護してください。",
    en: "Add a `startupProbe` to protect slow-starting containers from being killed by the `livenessProbe` before they finish initializing.",
    patch: `containers:
  - name: app
    startupProbe:
      httpGet:
        path: /healthz
        port: 8080
      failureThreshold: 30   # 30 × 10s = 5min max startup time
      periodSeconds: 10`,
    safe: false,
  },

  // ─── MV6015 ────────────────────────────────────────────────────────────
  MV6015: {
    ja: "PodDisruptionBudget を作成して、ノードメンテナンス中もDeploymentの可用性を維持してください。",
    en: "Create a PodDisruptionBudget to maintain Deployment availability during voluntary disruptions such as node maintenance.",
    patch: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-app-pdb
spec:
  minAvailable: 1   # または maxUnavailable: 1
  selector:
    matchLabels:
      app: my-app   # Deploymentのselectorと一致させる`,
    safe: false,
  },

  // ─── MV3008 ────────────────────────────────────────────────────────────
  MV3008: {
    ja: "デフォルト拒否の NetworkPolicy を追加して、明示的に許可されていないトラフィックをすべてブロックしてください。",
    en: "Add a default-deny NetworkPolicy to block all traffic not explicitly allowed.",
    patch: `# デフォルト拒否 (ingress)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: {}
  policyTypes:
    - Ingress
---
# デフォルト拒否 (egress)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
spec:
  podSelector: {}
  policyTypes:
    - Egress`,
    safe: false,
  },
};

export function getTemplate(ruleId: string): FixTemplate | undefined {
  return FIX_TEMPLATES[ruleId.toUpperCase()];
}

export function getFixSummary(ruleId: string, lang: FixLang): string | undefined {
  const t = getTemplate(ruleId);
  if (!t) return undefined;
  return t[lang];
}
