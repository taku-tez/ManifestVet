# ManifestVet OSS Scan Analysis
*Generated: 2026-03-10T06:47:29.175Z*

## Summary

| Metric | Value |
|--------|-------|
| Projects scanned | 26 |
| Successful | 24 |
| Skipped (no manifests) | 0 |
| Errored | 0 |
| Total resources | 2,294 |
| Total violations | 4,828 |
| Avg violations/resource | 2.10 |
| Rules coverage | 84.5% (49/58 rules fired) |

## Top 20 Most Violated Rules

| Rank | Rule | Severity | Projects | Fire Rate | Violations |
|------|------|----------|----------|-----------|------------|
| 1 | `MV6011` | info | 19 | 79.2% | 338 |
| 2 | `MV6007` | info | 19 | 79.2% | 325 |
| 3 | `MV4002` | info | 18 | 75.0% | 299 |
| 4 | `MV4006` | info | 14 | 58.3% | 290 |
| 5 | `MV1008` | warning | 14 | 58.3% | 288 |
| 6 | `MV1009` | info | 12 | 50.0% | 264 |
| 7 | `MV6003` | warning | 16 | 66.7% | 218 |
| 8 | `MV6004` | warning | 16 | 66.7% | 215 |
| 9 | `MV1011` | info | 19 | 79.2% | 210 |
| 10 | `MV1016` | warning | 19 | 79.2% | 195 |
| 11 | `MV2006` | warning | 16 | 66.7% | 178 |
| 12 | `MV2005` | warning | 19 | 79.2% | 171 |
| 13 | `MV6010` | info | 18 | 75.0% | 164 |
| 14 | `MV6006` | info | 16 | 66.7% | 143 |
| 15 | `MV6002` | warning | 18 | 75.0% | 141 |
| 16 | `MV6012` | info | 16 | 66.7% | 141 |
| 17 | `MV4001` | error | 9 | 37.5% | 133 |
| 18 | `MV1001` | error | 13 | 54.2% | 121 |
| 19 | `MV1010` | warning | 13 | 54.2% | 116 |
| 20 | `MV1012` | warning | 12 | 50.0% | 102 |

## Rules That Never Fired

These rules had zero violations across all scanned projects.
Possible causes: incorrect implementation, extremely rare condition, or rules that apply to uncommon resource patterns.

- `MV1006` — Pod should not use the host IPC namespace.
- `MV1014` — Containers should not set procMount to "Unmasked".
- `MV1015` — Pods should not use the "default" service account.
- `MV2008` — ClusterRole should not grant impersonation permissions. Impersonation allows acting as other users, groups, or service accounts.
- `MV2009` — RoleBinding/ClusterRoleBinding should not bind to system:unauthenticated or system:anonymous.
- `MV3006` — Pod should not use hostAliases. hostAliases modify the pod's /etc/hosts file which can be used to redirect traffic or bypass DNS.
- `MV3007` — Ingress should have TLS configured to ensure encrypted traffic.
- `MV4003` — Container imagePullPolicy is set to "Never". This means the image will never be pulled from a registry and must already exist on the node.
- `MV5002` — Secret of type "Opaque" contains keys with sensitive names in its data field. Sensitive data should be properly managed through external secret management solutions.

## Insights by Project Category

| Category | Projects | Avg Violations/Resource | Top Rules |
|----------|----------|------------------------|-----------|
| storage | 2 | 3.04 | MV2001, MV1001, MV1002 |
| gitops | 1 | 2.79 | MV1008, MV1009, MV4002 |
| networking | 2 | 2.40 | MV4006, MV6011, MV6007 |
| cicd | 3 | 2.36 | MV6011, MV1008, MV1009 |
| logging | 1 | 2.34 | MV5004, MV1001, MV1002 |
| tracing | 2 | 2.00 | MV1001, MV1002, MV1008 |
| monitoring | 5 | 1.89 | MV5004, MV4002, MV6007 |
| secrets | 2 | 1.88 | MV5004, MV1001, MV1002 |
| messaging | 2 | 1.78 | MV6009, MV1010, MV1016 |
| workflow | 1 | 1.72 | MV6009, MV1008, MV6002 |
| ingress | 1 | 1.69 | MV1008, MV1016, MV2006 |
| platform | 3 | 1.57 | MV6009, MV1016, MV1011 |
| serverless | 1 | 1.39 | MV1016, MV1011, MV4002 |
| autoscaling | 1 | 1.32 | MV6009, MV4001, MV1016 |
| policy | 2 | 1.11 | MV4002, MV6007, MV6011 |
| database | 1 | 1.11 | MV6009, MV4001, MV1016 |
| postgres | 1 | 1.11 | MV6009, MV4001, MV1016 |
| security | 6 | 1.09 | MV4002, MV6007, MV6011 |
| kafka | 1 | 0.70 | MV2006, MV1001, MV1002 |
| backup | 1 | 0.00 |  |
| tls | 1 | 0.00 |  |
| virtualization | 1 | 0.00 |  |

## Most Violated Projects (top 10)

| Project | Resources | Violations | Violations/Resource | Top Rules |
|---------|-----------|------------|--------------------|-----------| 
| [secrets-store-csi](https://github.com/kubernetes-sigs/secrets-store-csi-driver) | 17 | 75 | 4.41 | MV5004, MV1001, MV1002 |
| [longhorn](https://github.com/longhorn/longhorn) | 112 | 383 | 3.42 | MV2001, MV1001, MV1002 |
| [rabbitmq-operator](https://github.com/rabbitmq/cluster-operator) | 22 | 68 | 3.09 | MV6009, MV4001, MV1010 |
| [metallb](https://github.com/metallb/metallb) | 217 | 642 | 2.96 | MV4002, MV4006, MV6007 |
| [argo-cd](https://github.com/argoproj/argo-cd) | 687 | 1920 | 2.79 | MV1008, MV1009, MV4002 |
| [jaeger-operator](https://github.com/jaegertracing/jaeger-operator) | 41 | 101 | 2.46 | MV1001, MV1002, MV1008 |
| [beats-k8s](https://github.com/elastic/beats) | 76 | 178 | 2.34 | MV5004, MV1001, MV1002 |
| [metrics-server](https://github.com/kubernetes-sigs/metrics-server) | 25 | 53 | 2.12 | MV6009, MV1016, MV1011 |
| [argo-workflows](https://github.com/argoproj/argo-workflows) | 274 | 471 | 1.72 | MV6009, MV1008, MV6002 |
| [ingress-nginx](https://github.com/kubernetes/ingress-nginx) | 171 | 289 | 1.69 | MV1008, MV1016, MV2006 |

## Cleanest Projects (top 10)

| Project | Resources | Violations | Violations/Resource |
|---------|-----------|------------|---------------------|
| [velero](https://github.com/vmware-tanzu/velero) | 14 | 0 | 0.00 |
| [cert-manager](https://github.com/cert-manager/cert-manager) | 8 | 0 | 0.00 |
| [external-secrets](https://github.com/external-secrets/external-secrets) | 23 | 0 | 0.00 |
| [kubevirt](https://github.com/kubevirt/kubevirt) | 2 | 0 | 0.00 |
| [opentelemetry-operator](https://github.com/open-telemetry/opentelemetry-operator) | 10 | 1 | 0.10 |
| [trivy-operator](https://github.com/aquasecurity/trivy-operator) | 47 | 23 | 0.49 |
| [strimzi-kafka](https://github.com/strimzi/strimzi-kafka-operator) | 27 | 19 | 0.70 |
| [kyverno](https://github.com/kyverno/kyverno) | 93 | 68 | 0.73 |
| [tekton-pipeline](https://github.com/tektoncd/pipeline) | 76 | 57 | 0.75 |
| [cloudnative-pg](https://github.com/cloudnative-pg/cloudnative-pg) | 76 | 84 | 1.11 |

## Rule Improvement Suggestions

- Rules that never fired (possible bugs or very rare conditions): MV1006, MV1014, MV1015, MV2008, MV2009, MV3006, MV3007, MV4003, MV5002
- Rarely firing rules (fired in <5% of projects) — verify correctness: MV5005, MV2004, MV3001, MV3005

---
*Generated by ManifestVet OSS Scanner*

# OSS Scan Diff (latest vs previous)

## Changes

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Total resources  | 2294  | 2294  | 0  |
| Total violations | 4828 | 4828 | 0 |
| Avg viol/resource | 2.10 | 2.10 | 0 |
| Rules coverage | 84.5% | 84.5% | — |
