export type KindType =
  | "Pod"
  | "Deployment"
  | "StatefulSet"
  | "DaemonSet"
  | "ReplicaSet"
  | "Job"
  | "CronJob"
  | "Service"
  | "Ingress"
  | "NetworkPolicy"
  | "ConfigMap"
  | "Secret"
  | "ServiceAccount"
  | "Role"
  | "ClusterRole"
  | "RoleBinding"
  | "ClusterRoleBinding"
  | "Namespace"
  | string;

export interface K8sResource {
  apiVersion: string;
  kind: KindType;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
  spec?: any;
  data?: any;
  stringData?: any;
  rules?: any[];
  roleRef?: any;
  subjects?: any[];
  type?: string;
}

export interface ParseResult {
  resources: K8sResource[];
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  line?: number;
}
