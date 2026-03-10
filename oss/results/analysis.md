# ManifestVet OSS Scan Analysis
*Generated: 2026-03-10T07:39:33.211Z*

## Summary

| Metric | Value |
|--------|-------|
| Projects scanned | 47 |
| Successful | 43 |
| Skipped (no manifests) | 2 |
| Errored | 0 |
| Total resources | 4,660 |
| Total violations | 13,693 |
| Avg violations/resource | 2.94 |
| Rules coverage | 88.9% (56/63 rules fired) |

## Top 20 Most Violated Rules

| Rank | Rule | Severity | Projects | Fire Rate | Violations |
|------|------|----------|----------|-----------|------------|
| 1 | `MV6007` | info | 31 | 72.1% | 791 |
| 2 | `MV1008` | warning | 26 | 60.5% | 744 |
| 3 | `MV6011` | info | 30 | 69.8% | 713 |
| 4 | `MV4006` | info | 23 | 53.5% | 661 |
| 5 | `MV1009` | info | 22 | 51.2% | 651 |
| 6 | `MV4002` | info | 30 | 69.8% | 641 |
| 7 | `MV1016` | warning | 31 | 72.1% | 597 |
| 8 | `MV1011` | info | 31 | 72.1% | 596 |
| 9 | `MV1010` | warning | 23 | 53.5% | 582 |
| 10 | `MV1012` | warning | 22 | 51.2% | 561 |
| 11 | `MV1002` | error | 22 | 51.2% | 551 |
| 12 | `MV6003` | warning | 25 | 58.1% | 526 |
| 13 | `MV1001` | error | 24 | 55.8% | 511 |
| 14 | `MV6004` | warning | 25 | 58.1% | 459 |
| 15 | `MV6010` | info | 29 | 67.4% | 451 |
| 16 | `MV6012` | info | 27 | 62.8% | 417 |
| 17 | `MV6006` | info | 26 | 60.5% | 411 |
| 18 | `MV6002` | warning | 27 | 62.8% | 399 |
| 19 | `MV6005` | info | 27 | 62.8% | 349 |
| 20 | `MV6001` | info | 18 | 41.9% | 339 |

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

## Insights by Project Category

| Category | Projects | Avg Violations/Resource | Top Rules |
|----------|----------|------------------------|-----------|
| service-mesh | 1 | 4.83 | MV4002, MV4006, MV6007 |
| cni | 2 | 4.21 | MV1010, MV1012, MV1008 |
| logging | 2 | 3.80 | MV5004, MV1001, MV1002 |
| networking | 6 | 3.77 | MV1008, MV4006, MV6007 |
| tracing | 3 | 3.39 | MV1001, MV1002, MV1010 |
| storage | 2 | 3.14 | MV2001, MV1001, MV1002 |
| monitoring | 12 | 3.01 | MV6008, MV4002, MV6007 |
| gitops | 2 | 2.78 | MV1008, MV1009, MV4002 |
| cicd | 3 | 2.45 | MV6011, MV1008, MV1009 |
| ingress | 2 | 2.20 | MV6011, MV1008, MV4006 |
| secrets | 3 | 1.96 | MV5004, MV1001, MV1002 |
| messaging | 2 | 1.86 | MV6009, MV1010, MV1016 |
| cluster-management | 1 | 1.85 | MV1008, MV1010, MV1016 |
| workflow | 1 | 1.78 | MV6009, MV1008, MV6002 |
| autoscaling | 1 | 1.41 | MV6009, MV4001, MV1016 |
| platform | 7 | 1.40 | MV6009, MV1016, MV4002 |
| serverless | 2 | 1.21 | MV1016, MV1011, MV4002 |
| security | 7 | 1.18 | MV4002, MV6007, MV6011 |
| policy | 2 | 1.16 | MV4002, MV6007, MV6011 |
| database | 1 | 1.14 | MV6009, MV4001, MV1016 |
| postgres | 1 | 1.14 | MV6009, MV4001, MV1016 |
| events | 1 | 1.10 | MV1016, MV1011, MV4002 |
| kafka | 1 | 0.74 | MV2006, MV1001, MV1002 |
| tls | 1 | 0.25 | MV3008 |
| backup | 1 | 0.00 |  |
| infra | 1 | 0.00 |  |
| virtualization | 1 | 0.00 |  |

## Most Violated Projects (top 10)

| Project | Resources | Violations | Violations/Resource | Top Rules |
|---------|-----------|------------|--------------------|-----------| 
| [fluentd-daemonset](https://github.com/fluent/fluentd-kubernetes-daemonset) | 33 | 236 | 7.15 | MV5004, MV1001, MV1002 |
| [cilium](https://github.com/cilium/cilium) | 501 | 3198 | 6.38 | MV1001, MV1002, MV1010 |
| [istio](https://github.com/istio/istio) | 339 | 1636 | 4.83 | MV4002, MV4006, MV6007 |
| [secrets-store-csi](https://github.com/kubernetes-sigs/secrets-store-csi-driver) | 17 | 77 | 4.53 | MV5004, MV1001, MV1002 |
| [pyroscope](https://github.com/grafana/pyroscope) | 254 | 1073 | 4.22 | MV6008, MV1002, MV1008 |
| [grafana-tempo](https://github.com/grafana/tempo) | 123 | 484 | 3.93 | MV1001, MV1002, MV1010 |
| [longhorn](https://github.com/longhorn/longhorn) | 112 | 396 | 3.54 | MV2001, MV1001, MV1002 |
| [rabbitmq-operator](https://github.com/rabbitmq/cluster-operator) | 22 | 71 | 3.23 | MV6009, MV4001, MV1010 |
| [metallb](https://github.com/metallb/metallb) | 217 | 668 | 3.08 | MV4002, MV4006, MV6007 |
| [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) | 23 | 69 | 3.00 | MV1008, MV1016, MV1009 |

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
| [cert-manager](https://github.com/cert-manager/cert-manager) | 8 | 2 | 0.25 |

## Rule Improvement Suggestions

- Rules that never fired (possible bugs or very rare conditions): MV1006, MV1014, MV1018, MV2008, MV2009, MV3006, MV4003
- Rarely firing rules (fired in <5% of projects) — verify correctness: MV5005, MV1007, MV5002, MV1017, MV2004, MV3005

---
*Generated by ManifestVet OSS Scanner*