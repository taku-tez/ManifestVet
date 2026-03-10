# ManifestVet OSS Scan Analysis
*Generated: 2026-03-10T03:12:24.753Z*

## Summary

| Metric | Value |
|--------|-------|
| Projects scanned | 30 |
| Successful | 21 |
| Skipped (no manifests) | 8 |
| Errored | 0 |
| Total resources | 2,148 |
| Total violations | 4,076 |
| Avg violations/resource | 1.90 |
| Rules coverage | 79.2% (42/53 rules fired) |

## Top 20 Most Violated Rules

| Rank | Rule | Severity | Projects | Fire Rate | Violations |
|------|------|----------|----------|-----------|------------|
| 1 | `MV6007` | info | 17 | 81.0% | 307 |
| 2 | `MV1008` | warning | 13 | 61.9% | 282 |
| 3 | `MV4002` | info | 16 | 76.2% | 281 |
| 4 | `MV4006` | info | 13 | 61.9% | 279 |
| 5 | `MV1009` | info | 11 | 52.4% | 258 |
| 6 | `MV1011` | info | 17 | 81.0% | 201 |
| 7 | `MV6003` | warning | 14 | 66.7% | 201 |
| 8 | `MV6004` | warning | 14 | 66.7% | 199 |
| 9 | `MV1016` | warning | 17 | 81.0% | 186 |
| 10 | `MV2006` | warning | 15 | 71.4% | 176 |
| 11 | `MV2005` | warning | 17 | 81.0% | 161 |
| 12 | `MV6010` | info | 16 | 76.2% | 156 |
| 13 | `MV6006` | info | 14 | 66.7% | 136 |
| 14 | `MV6002` | warning | 16 | 76.2% | 135 |
| 15 | `MV4001` | error | 9 | 42.9% | 133 |
| 16 | `MV1001` | error | 12 | 57.1% | 115 |
| 17 | `MV1010` | warning | 12 | 57.1% | 110 |
| 18 | `MV1012` | warning | 11 | 52.4% | 96 |
| 19 | `MV6009` | error | 10 | 47.6% | 95 |
| 20 | `MV1002` | error | 11 | 52.4% | 88 |

## Rules That Never Fired

These rules had zero violations across all scanned projects.
Possible causes: incorrect implementation, extremely rare condition, or rules that apply to uncommon resource patterns.

- `MV1006` — Pod should not use the host IPC namespace.
- `MV1014` — Containers should not set procMount to "Unmasked".
- `MV1015` — Pods should not use the "default" service account.
- `MV2008` — ClusterRole should not grant impersonation permissions. Impersonation allows acting as other users, groups, or service accounts.
- `MV2009` — RoleBinding/ClusterRoleBinding should not bind to system:unauthenticated or system:anonymous.
- `MV3003` — NetworkPolicy should not allow all ingress traffic. An ingress rule with an empty from array or from containing an empty object permits traffic from any source.
- `MV3004` — NetworkPolicy should not allow all egress traffic. An egress rule with an empty to array or to containing an empty object permits traffic to any destination.
- `MV3006` — Pod should not use hostAliases. hostAliases modify the pod's /etc/hosts file which can be used to redirect traffic or bypass DNS.
- `MV3007` — Ingress should have TLS configured to ensure encrypted traffic.
- `MV4003` — Container imagePullPolicy is set to "Never". This means the image will never be pulled from a registry and must already exist on the node.
- `MV5002` — Secret of type "Opaque" contains keys with sensitive names in its data field. Sensitive data should be properly managed through external secret management solutions.

## Insights by Project Category

| Category | Projects | Avg Violations/Resource | Top Rules |
|----------|----------|------------------------|-----------|
| storage | 2 | 2.78 | MV2001, MV1001, MV1002 |
| gitops | 1 | 2.43 | MV1008, MV1009, MV4002 |
| logging | 1 | 2.21 | MV5004, MV1001, MV1002 |
| networking | 2 | 2.18 | MV4006, MV6007, MV1008 |
| monitoring | 2 | 2.13 | MV5004, MV1016, MV1011 |
| cicd | 3 | 2.06 | MV1008, MV1009, MV6007 |
| secrets | 2 | 1.73 | MV5004, MV1001, MV1002 |
| workflow | 1 | 1.55 | MV6009, MV1008, MV6002 |
| messaging | 2 | 1.55 | MV6009, MV1010, MV1016 |
| ingress | 1 | 1.53 | MV1008, MV1016, MV2006 |
| platform | 3 | 1.38 | MV6009, MV1016, MV1011 |
| autoscaling | 1 | 1.15 | MV6009, MV4001, MV1016 |
| serverless | 1 | 1.08 | MV1016, MV1011, MV4002 |
| database | 1 | 0.99 | MV6009, MV4001, MV1016 |
| postgres | 1 | 0.99 | MV6009, MV4001, MV1016 |
| policy | 2 | 0.98 | MV4002, MV6007, MV1008 |
| security | 6 | 0.97 | MV4002, MV6007, MV6004 |
| kafka | 1 | 0.63 | MV2006, MV1001, MV1002 |
| backup | 1 | 0.00 |  |
| tls | 1 | 0.00 |  |
| virtualization | 1 | 0.00 |  |

## Most Violated Projects (top 10)

| Project | Resources | Violations | Violations/Resource | Top Rules |
|---------|-----------|------------|--------------------|-----------| 
| [secrets-store-csi](https://github.com/kubernetes-sigs/secrets-store-csi-driver) | 17 | 69 | 4.06 | MV5004, MV1001, MV1002 |
| [longhorn](https://github.com/longhorn/longhorn) | 112 | 350 | 3.13 | MV2001, MV1001, MV1002 |
| [metallb](https://github.com/metallb/metallb) | 217 | 585 | 2.70 | MV4002, MV4006, MV6007 |
| [rabbitmq-operator](https://github.com/rabbitmq/cluster-operator) | 22 | 59 | 2.68 | MV6009, MV4001, MV1010 |
| [argo-cd](https://github.com/argoproj/argo-cd) | 687 | 1667 | 2.43 | MV1008, MV1009, MV4002 |
| [beats-k8s](https://github.com/elastic/beats) | 76 | 168 | 2.21 | MV5004, MV1001, MV1002 |
| [metrics-server](https://github.com/kubernetes-sigs/metrics-server) | 25 | 47 | 1.88 | MV6009, MV1016, MV1011 |
| [argo-workflows](https://github.com/argoproj/argo-workflows) | 274 | 425 | 1.55 | MV6009, MV1008, MV6002 |
| [ingress-nginx](https://github.com/kubernetes/ingress-nginx) | 171 | 262 | 1.53 | MV1008, MV1016, MV2006 |
| [gatekeeper](https://github.com/open-policy-agent/gatekeeper) | 81 | 108 | 1.33 | MV1008, MV4002, MV6007 |

## Cleanest Projects (top 10)

| Project | Resources | Violations | Violations/Resource |
|---------|-----------|------------|---------------------|
| [velero](https://github.com/vmware-tanzu/velero) | 14 | 0 | 0.00 |
| [cert-manager](https://github.com/cert-manager/cert-manager) | 8 | 0 | 0.00 |
| [external-secrets](https://github.com/external-secrets/external-secrets) | 23 | 0 | 0.00 |
| [kubevirt](https://github.com/kubevirt/kubevirt) | 2 | 0 | 0.00 |
| [trivy-operator](https://github.com/aquasecurity/trivy-operator) | 47 | 21 | 0.45 |
| [strimzi-kafka](https://github.com/strimzi/strimzi-kafka-operator) | 27 | 17 | 0.63 |
| [tekton-pipeline](https://github.com/tektoncd/pipeline) | 76 | 49 | 0.64 |
| [kyverno](https://github.com/kyverno/kyverno) | 93 | 63 | 0.68 |
| [cloudnative-pg](https://github.com/cloudnative-pg/cloudnative-pg) | 76 | 75 | 0.99 |
| [knative-serving](https://github.com/knative/serving) | 59 | 64 | 1.08 |

## Rule Improvement Suggestions

- Rules that never fired (possible bugs or very rare conditions): MV1006, MV1014, MV1015, MV2008, MV2009, MV3003, MV3004, MV3006, MV3007, MV4003, MV5002
- Rules firing in >80% of projects — consider making them higher severity or auto-fixable: MV6007, MV1011, MV1016, MV2005
- Rarely firing rules (fired in <5% of projects) — verify correctness: MV5005, MV2004, MV3002, MV3001, MV3005

---
*Generated by ManifestVet OSS Scanner*

# OSS Scan Diff (latest vs previous)

## Changes

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| Total resources  | 2148  | 2148  | 0  |
| Total violations | 4076 | 4076 | 0 |
| Avg viol/resource | 1.90 | 1.90 | 0 |
| Rules coverage | 79.2% | 79.2% | — |
