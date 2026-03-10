# ManifestVet OSS Scan Analysis
*Generated: 2026-03-10T07:28:19.188Z*

## Summary

| Metric | Value |
|--------|-------|
| Projects scanned | 37 |
| Successful | 34 |
| Skipped (no manifests) | 1 |
| Errored | 0 |
| Total resources | 4,161 |
| Total violations | 11,711 |
| Avg violations/resource | 2.81 |
| Rules coverage | 90.0% (54/60 rules fired) |

## Top 20 Most Violated Rules

| Rank | Rule | Severity | Projects | Fire Rate | Violations |
|------|------|----------|----------|-----------|------------|
| 1 | `MV6007` | info | 26 | 76.5% | 681 |
| 2 | `MV1008` | warning | 21 | 61.8% | 657 |
| 3 | `MV4006` | info | 19 | 55.9% | 629 |
| 4 | `MV1009` | info | 19 | 55.9% | 626 |
| 5 | `MV6011` | info | 26 | 76.5% | 604 |
| 6 | `MV4002` | info | 25 | 73.5% | 531 |
| 7 | `MV1016` | warning | 26 | 76.5% | 495 |
| 8 | `MV1011` | info | 26 | 76.5% | 494 |
| 9 | `MV1010` | warning | 20 | 58.8% | 478 |
| 10 | `MV1012` | warning | 19 | 55.9% | 457 |
| 11 | `MV1002` | error | 19 | 55.9% | 447 |
| 12 | `MV1001` | error | 20 | 58.8% | 442 |
| 13 | `MV6010` | info | 25 | 73.5% | 423 |
| 14 | `MV6003` | warning | 22 | 64.7% | 422 |
| 15 | `MV6004` | warning | 22 | 64.7% | 419 |
| 16 | `MV6012` | info | 23 | 67.6% | 389 |
| 17 | `MV6006` | info | 23 | 67.6% | 382 |
| 18 | `MV6002` | warning | 24 | 70.6% | 379 |
| 19 | `MV6005` | info | 23 | 67.6% | 309 |
| 20 | `MV6001` | info | 16 | 47.1% | 307 |

## Rules That Never Fired

These rules had zero violations across all scanned projects.
Possible causes: incorrect implementation, extremely rare condition, or rules that apply to uncommon resource patterns.

- `MV1006` — Pod should not use the host IPC namespace.
- `MV1014` — Containers should not set procMount to "Unmasked".
- `MV2008` — ClusterRole should not grant impersonation permissions. Impersonation allows acting as other users, groups, or service accounts.
- `MV2009` — RoleBinding/ClusterRoleBinding should not bind to system:unauthenticated or system:anonymous.
- `MV3006` — Pod should not use hostAliases. hostAliases modify the pod's /etc/hosts file which can be used to redirect traffic or bypass DNS.
- `MV4003` — Container imagePullPolicy is set to "Never". This means the image will never be pulled from a registry and must already exist on the node.

## Insights by Project Category

| Category | Projects | Avg Violations/Resource | Top Rules |
|----------|----------|------------------------|-----------|
| service-mesh | 1 | 4.82 | MV4002, MV4006, MV6007 |
| cni | 2 | 4.19 | MV1010, MV1012, MV1008 |
| networking | 6 | 3.74 | MV1008, MV4006, MV6007 |
| storage | 2 | 3.11 | MV2001, MV1001, MV1002 |
| gitops | 2 | 2.76 | MV1008, MV1009, MV4002 |
| cicd | 3 | 2.43 | MV6011, MV1008, MV1009 |
| logging | 1 | 2.34 | MV5004, MV1001, MV1002 |
| ingress | 2 | 2.13 | MV6011, MV1008, MV4006 |
| tracing | 2 | 2.06 | MV1001, MV1002, MV1008 |
| secrets | 3 | 1.94 | MV5004, MV1001, MV1002 |
| monitoring | 5 | 1.91 | MV5004, MV4002, MV6007 |
| messaging | 2 | 1.84 | MV6009, MV1010, MV1016 |
| cluster-management | 1 | 1.83 | MV1008, MV1010, MV1016 |
| workflow | 1 | 1.78 | MV6009, MV1008, MV6002 |
| platform | 6 | 1.41 | MV6009, MV1016, MV4002 |
| autoscaling | 1 | 1.39 | MV6009, MV4001, MV1016 |
| serverless | 2 | 1.20 | MV1016, MV1011, MV4002 |
| security | 7 | 1.15 | MV4002, MV6007, MV6011 |
| policy | 2 | 1.15 | MV4002, MV6007, MV6011 |
| database | 1 | 1.13 | MV6009, MV4001, MV1016 |
| postgres | 1 | 1.13 | MV6009, MV4001, MV1016 |
| events | 1 | 1.09 | MV1016, MV1011, MV4002 |
| kafka | 1 | 0.74 | MV2006, MV1001, MV1002 |
| backup | 1 | 0.00 |  |
| tls | 1 | 0.00 |  |
| infra | 1 | 0.00 |  |
| virtualization | 1 | 0.00 |  |

## Most Violated Projects (top 10)

| Project | Resources | Violations | Violations/Resource | Top Rules |
|---------|-----------|------------|--------------------|-----------| 
| [cilium](https://github.com/cilium/cilium) | 501 | 3186 | 6.36 | MV1001, MV1002, MV1010 |
| [istio](https://github.com/istio/istio) | 339 | 1634 | 4.82 | MV4002, MV4006, MV6007 |
| [secrets-store-csi](https://github.com/kubernetes-sigs/secrets-store-csi-driver) | 17 | 77 | 4.53 | MV5004, MV1001, MV1002 |
| [longhorn](https://github.com/longhorn/longhorn) | 112 | 392 | 3.50 | MV2001, MV1001, MV1002 |
| [rabbitmq-operator](https://github.com/rabbitmq/cluster-operator) | 22 | 70 | 3.18 | MV6009, MV4001, MV1010 |
| [metallb](https://github.com/metallb/metallb) | 217 | 662 | 3.05 | MV4002, MV4006, MV6007 |
| [argo-cd](https://github.com/argoproj/argo-cd) | 687 | 1973 | 2.87 | MV1008, MV1009, MV4002 |
| [jaeger-operator](https://github.com/jaegertracing/jaeger-operator) | 41 | 104 | 2.54 | MV1001, MV1002, MV1008 |
| [contour](https://github.com/projectcontour/contour) | 237 | 571 | 2.41 | MV6008, MV1002, MV1010 |
| [beats-k8s](https://github.com/elastic/beats) | 76 | 178 | 2.34 | MV5004, MV1001, MV1002 |

## Cleanest Projects (top 10)

| Project | Resources | Violations | Violations/Resource |
|---------|-----------|------------|---------------------|
| [velero](https://github.com/vmware-tanzu/velero) | 14 | 0 | 0.00 |
| [cert-manager](https://github.com/cert-manager/cert-manager) | 8 | 0 | 0.00 |
| [external-secrets](https://github.com/external-secrets/external-secrets) | 23 | 0 | 0.00 |
| [crossplane](https://github.com/crossplane/crossplane) | 21 | 0 | 0.00 |
| [kubevirt](https://github.com/kubevirt/kubevirt) | 2 | 0 | 0.00 |
| [dapr](https://github.com/dapr/dapr) | 5 | 0 | 0.00 |
| [opentelemetry-operator](https://github.com/open-telemetry/opentelemetry-operator) | 10 | 1 | 0.10 |
| [trivy-operator](https://github.com/aquasecurity/trivy-operator) | 47 | 24 | 0.51 |
| [kyverno](https://github.com/kyverno/kyverno) | 93 | 68 | 0.73 |
| [strimzi-kafka](https://github.com/strimzi/strimzi-kafka-operator) | 27 | 20 | 0.74 |

## Rule Improvement Suggestions

- Rules that never fired (possible bugs or very rare conditions): MV1006, MV1014, MV2008, MV2009, MV3006, MV4003
- Rarely firing rules (fired in <5% of projects) — verify correctness: MV5002

---
*Generated by ManifestVet OSS Scanner*