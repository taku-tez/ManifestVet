# ManifestVet OSS Scan Analysis
*Generated: 2026-03-12T02:25:18.961Z*

## Summary

| Metric | Value |
|--------|-------|
| Projects scanned | 46 |
| Successful | 43 |
| Skipped (no manifests) | 1 |
| Errored | 0 |
| Total resources | 4,648 |
| Total violations | 6,167 |
| Avg violations/resource | 1.33 |
| Rules coverage | 87.7% (57/65 rules fired) |

## Top 20 Most Violated Rules

| Rank | Rule | Severity | Projects | Fire Rate | Violations |
|------|------|----------|----------|-----------|------------|
| 1 | `MV6007` | low | 31 | 72.1% | 366 |
| 2 | `MV6011` | low | 30 | 69.8% | 342 |
| 3 | `MV4002` | info | 30 | 69.8% | 341 |
| 4 | `MV1008` | medium | 26 | 60.5% | 322 |
| 5 | `MV1010` | low | 23 | 53.5% | 295 |
| 6 | `MV1012` | medium | 22 | 51.2% | 287 |
| 7 | `MV1002` | high | 22 | 51.2% | 282 |
| 8 | `MV1009` | info | 22 | 51.2% | 282 |
| 9 | `MV1011` | low | 31 | 72.1% | 275 |
| 10 | `MV1016` | medium | 31 | 72.1% | 274 |
| 11 | `MV1001` | high | 24 | 55.8% | 271 |
| 12 | `MV6003` | low | 25 | 58.1% | 256 |
| 13 | `MV6004` | low | 25 | 58.1% | 230 |
| 14 | `MV6010` | low | 29 | 67.4% | 200 |
| 15 | `MV6002` | low | 27 | 62.8% | 186 |
| 16 | `MV6012` | low | 27 | 62.8% | 186 |
| 17 | `MV6006` | low | 26 | 60.5% | 180 |
| 18 | `MV6005` | low | 27 | 62.8% | 162 |
| 19 | `MV6001` | low | 18 | 41.9% | 161 |
| 20 | `MV1015` | low | 16 | 37.2% | 155 |

## Rules That Never Fired

These rules had zero violations across all scanned projects.
Possible causes: incorrect implementation, extremely rare condition, or rules that apply to uncommon resource patterns.

- `MV1006` — Pod should not use the host IPC namespace.
- `MV1014` — Containers should not set procMount to "Unmasked".
- `MV1018` — Container should not have stdin or tty enabled. These allow interactive shell access which may be used for container escape or lateral movement.
- `MV2008` — ClusterRole should not grant impersonation permissions. Impersonation allows acting as other users, groups, or service accounts.
- `MV2009` — RoleBinding/ClusterRoleBinding should not bind to system:unauthenticated or system:anonymous.
- `MV3006` — Pod should not use hostAliases. hostAliases modify the pod's /etc/hosts file which can be used to redirect traffic or bypass DNS.
- `MV4003` — Container imagePullPolicy is set to "Never". This means the image will never be pulled from a registry and must already exist on the node.
- `MV4008` — Container image is pulled from a registry that is not in the allowedRegistries list. Only images from approved registries should be used.

## Insights by Project Category

| Category | Projects | Avg Violations/Resource | Top Rules |
|----------|----------|------------------------|-----------|
| service-mesh | 1 | 2.69 | MV4002, MV6007, MV1008 |
| storage | 2 | 2.25 | MV1001, MV1002, MV1008 |
| cni | 2 | 1.98 | MV1012, MV1010, MV1002 |
| tracing | 3 | 1.92 | MV1001, MV1002, MV1012 |
| secrets | 3 | 1.84 | MV5004, MV1001, MV1002 |
| networking | 6 | 1.78 | MV1008, MV6007, MV1010 |
| logging | 2 | 1.51 | MV4002, MV5004, MV5001 |
| monitoring | 12 | 1.42 | MV6008, MV4002, MV6007 |
| serverless | 2 | 1.19 | MV6007, MV4002, MV1016 |
| autoscaling | 1 | 1.15 | MV1016, MV4001, MV1011 |
| events | 1 | 1.09 | MV1016, MV1011, MV6007 |
| messaging | 2 | 1.04 | MV2006, MV6002, MV4002 |
| security | 7 | 0.94 | MV4002, MV6007, MV6011 |
| ingress | 2 | 0.88 | MV6008, MV6011, MV1008 |
| policy | 2 | 0.84 | MV4002, MV1008, MV6007 |
| platform | 7 | 0.77 | MV4002, MV4001, MV6002 |
| cluster-management | 1 | 0.74 | MV4002, MV4001, MV6001 |
| workflow | 1 | 0.73 | MV1008, MV1011, MV6001 |
| kafka | 1 | 0.70 | MV2006, MV1001, MV1002 |
| cicd | 3 | 0.57 | MV6011, MV4002, MV1008 |
| gitops | 2 | 0.50 | MV4002, MV1008, MV6011 |
| database | 1 | 0.41 | MV4001, MV6002, MV4002 |
| postgres | 1 | 0.41 | MV4001, MV6002, MV4002 |
| tls | 1 | 0.13 | MV3008 |
| backup | 1 | 0.00 |  |
| infra | 1 | 0.00 |  |
| virtualization | 1 | 0.00 |  |

## Most Violated Projects (top 10)

| Project | Resources | Violations | Violations/Resource | Top Rules |
|---------|-----------|------------|--------------------|-----------| 
| [secrets-store-csi](https://github.com/kubernetes-sigs/secrets-store-csi-driver) | 17 | 71 | 4.18 | MV5004, MV1001, MV1002 |
| [cilium](https://github.com/cilium/cilium) | 501 | 1632 | 3.26 | MV1001, MV1002, MV1012 |
| [istio](https://github.com/istio/istio) | 339 | 911 | 2.69 | MV4002, MV6007, MV1008 |
| [jaeger-operator](https://github.com/jaegertracing/jaeger-operator) | 41 | 105 | 2.56 | MV1001, MV1002, MV1008 |
| [longhorn](https://github.com/longhorn/longhorn) | 112 | 284 | 2.54 | MV1001, MV1002, MV1008 |
| [fluentd-daemonset](https://github.com/fluent/fluentd-kubernetes-daemonset) | 33 | 76 | 2.30 | MV4002, MV4007, MV5001 |
| [vault-k8s](https://github.com/hashicorp/vault-k8s) | 10 | 21 | 2.10 | MV1001, MV1002, MV6009 |
| [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) | 23 | 46 | 2.00 | MV1008, MV1016, MV1011 |
| [grafana-tempo](https://github.com/grafana/tempo) | 119 | 220 | 1.85 | MV1001, MV1002, MV1012 |
| [knative-serving](https://github.com/knative/serving) | 59 | 86 | 1.46 | MV6007, MV6011, MV4002 |

## Cleanest Projects (top 10)

| Project | Resources | Violations | Violations/Resource |
|---------|-----------|------------|---------------------|
| [victoria-metrics-op](https://github.com/VictoriaMetrics/operator) | 22 | 0 | 0.00 |
| [grafana-operator](https://github.com/grafana/grafana-operator) | 11 | 0 | 0.00 |
| [velero](https://github.com/vmware-tanzu/velero) | 14 | 0 | 0.00 |
| [external-secrets](https://github.com/external-secrets/external-secrets) | 23 | 0 | 0.00 |
| [crossplane](https://github.com/crossplane/crossplane) | 21 | 0 | 0.00 |
| [kubevirt](https://github.com/kubevirt/kubevirt) | 2 | 0 | 0.00 |
| [dapr](https://github.com/dapr/dapr) | 5 | 0 | 0.00 |
| [opentelemetry-operator](https://github.com/open-telemetry/opentelemetry-operator) | 10 | 1 | 0.10 |
| [datadog-operator](https://github.com/DataDog/datadog-operator) | 10 | 1 | 0.10 |
| [descheduler](https://github.com/kubernetes-sigs/descheduler) | 9 | 1 | 0.11 |

## Rule Improvement Suggestions

- Rules that never fired (possible bugs or very rare conditions): MV1006, MV1014, MV1018, MV2008, MV2009, MV3006, MV4003, MV4008
- Rarely firing rules (fired in <5% of projects) — verify correctness: MV1007, MV4006, MV3007, MV1017, MV5002, MV2004, MV3005, MV5005

---
*Generated by ManifestVet OSS Scanner*