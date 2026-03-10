import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import { K8sResource } from "./parser/types";
import { lint } from "./engine/linter";
import { loadConfig, ManifestVetConfig } from "./engine/config";
import { Violation, Rule } from "./rules/types";

// ── Kubernetes Admission Webhook types ──────────────────────────────────────

interface AdmissionRequest {
  uid: string;
  kind: { group: string; version: string; kind: string };
  resource: { group: string; version: string; resource: string };
  name: string;
  namespace?: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "CONNECT";
  object?: Record<string, any>;
  oldObject?: Record<string, any>;
}

interface AdmissionReview {
  apiVersion: string;
  kind: string;
  request?: AdmissionRequest;
}

interface AdmissionResponse {
  apiVersion: string;
  kind: string;
  response: {
    uid: string;
    allowed: boolean;
    status?: {
      code: number;
      message: string;
    };
    warnings?: string[];
  };
}

// ── Config ──────────────────────────────────────────────────────────────────

export interface WebhookOptions {
  port: number;
  certFile?: string;
  keyFile?: string;
  severity: "error" | "warning" | "info";
  extraRules?: Rule[];
}

// ── Handler ─────────────────────────────────────────────────────────────────

function toK8sResource(obj: Record<string, any>): K8sResource | null {
  if (!obj.apiVersion || !obj.kind) return null;
  return {
    apiVersion: obj.apiVersion,
    kind: obj.kind,
    metadata: {
      name: obj.metadata?.name ?? "",
      namespace: obj.metadata?.namespace,
      labels: obj.metadata?.labels,
      annotations: obj.metadata?.annotations,
    },
    spec: obj.spec,
    data: obj.data,
    stringData: obj.stringData,
    rules: obj.rules,
    roleRef: obj.roleRef,
    subjects: obj.subjects,
    type: obj.type,
  };
}

function handleAdmission(
  review: AdmissionReview,
  config: ManifestVetConfig,
  extraRules: Rule[]
): AdmissionResponse {
  const uid = review.request?.uid ?? "";

  if (!review.request?.object) {
    return {
      apiVersion: review.apiVersion,
      kind: review.kind,
      response: { uid, allowed: true },
    };
  }

  const resource = toK8sResource(review.request.object);
  if (!resource) {
    return {
      apiVersion: review.apiVersion,
      kind: review.kind,
      response: { uid, allowed: true },
    };
  }

  const violations: Violation[] = lint([resource], config, extraRules);
  const errors = violations.filter((v) => v.severity === "error");
  const warnings = violations.filter((v) => v.severity === "warning");

  const allowed = errors.length === 0;

  const warningMessages = warnings.map(
    (v) => `[${v.rule}] ${v.message}`
  );

  if (allowed && violations.length === 0) {
    return {
      apiVersion: review.apiVersion,
      kind: review.kind,
      response: { uid, allowed: true },
    };
  }

  const response: AdmissionResponse = {
    apiVersion: review.apiVersion,
    kind: review.kind,
    response: {
      uid,
      allowed,
      warnings: [
        ...warningMessages,
        ...(!allowed
          ? errors.map((v) => `[${v.rule}] ${v.message}`)
          : []),
      ],
    },
  };

  if (!allowed) {
    const msg = errors.map((v) => `[${v.rule}] ${v.message}`).join("; ");
    response.response.status = {
      code: 403,
      message: `ManifestVet: ${errors.length} security violation(s) found: ${msg}`,
    };
  }

  return response;
}

function requestHandler(
  config: ManifestVetConfig,
  extraRules: Rule[]
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return (req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (req.method !== "POST" || req.url !== "/validate") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let review: AdmissionReview;
      try {
        review = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      const response = handleAdmission(review, config, extraRules);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response));

      const resource = `${review.request?.kind?.kind ?? "?"}/${review.request?.name ?? "?"}`;
      const op = review.request?.operation ?? "?";
      const allowed = response.response.allowed ? "✓ allowed" : "✗ denied";
      console.log(`[${new Date().toISOString()}] ${op} ${resource} — ${allowed}`);
    });
  };
}

// ── Server ──────────────────────────────────────────────────────────────────

export function startWebhookServer(opts: WebhookOptions): void {
  const config = loadConfig({ severity: opts.severity });
  const extraRules = opts.extraRules ?? [];
  const handler = requestHandler(config, extraRules);

  if (opts.certFile && opts.keyFile) {
    const serverOptions = {
      cert: fs.readFileSync(opts.certFile),
      key: fs.readFileSync(opts.keyFile),
    };
    const server = https.createServer(serverOptions, handler);
    server.listen(opts.port, () => {
      console.log(
        `[manifestvet] Admission webhook listening on https://0.0.0.0:${opts.port}/validate (TLS)`
      );
    });
  } else {
    const server = http.createServer(handler);
    server.listen(opts.port, () => {
      console.log(
        `[manifestvet] Admission webhook listening on http://0.0.0.0:${opts.port}/validate`
      );
      console.log(
        `[manifestvet] WARNING: No TLS configured. Use --cert and --key for production.`
      );
    });
  }
}
