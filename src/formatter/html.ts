import { Violation, Severity } from "../rules/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function severityBadge(severity: Severity): string {
  const colors: Record<Severity, string> = {
    critical: "#b31d28",
    high:     "#d73a49",
    medium:   "#e36209",
    low:      "#28a745",
    info:     "#0366d6",
  };
  const color = colors[severity];
  return `<span style="background:${color};color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600">${severity}</span>`;
}

function groupByResource(violations: Violation[]): Map<string, Violation[]> {
  const map = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = map.get(v.resource) ?? [];
    list.push(v);
    map.set(v.resource, list);
  }
  return map;
}

export function formatHTML(violations: Violation[], title = "ManifestVet Report"): string {
  const counts: Partial<Record<Severity, number>> = {};
  for (const v of violations) {
    counts[v.severity] = (counts[v.severity] ?? 0) + 1;
  }
  const critical = counts.critical ?? 0;
  const high     = counts.high     ?? 0;
  const medium   = counts.medium   ?? 0;
  const low      = counts.low      ?? 0;
  const info     = counts.info     ?? 0;

  const grouped = groupByResource(violations);

  const resourceSections = Array.from(grouped.entries())
    .map(([resource, vs]) => {
      const rows = vs
        .map(
          (v) => `
        <tr>
          <td style="padding:8px 12px;white-space:nowrap">${escapeHtml(v.rule)}</td>
          <td style="padding:8px 12px">${severityBadge(v.severity)}</td>
          <td style="padding:8px 12px">${escapeHtml(v.message)}</td>
          ${v.fix ? `<td style="padding:8px 12px"><details><summary style="cursor:pointer;color:#0366d6">修正方法</summary><pre style="background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto;margin-top:8px;font-size:12px">${escapeHtml(v.fix)}</pre></details></td>` : "<td></td>"}
        </tr>`
        )
        .join("");

      return `
      <div style="margin-bottom:24px">
        <h3 style="margin:0 0 8px;font-size:15px;color:#24292e">${escapeHtml(resource)}</h3>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e1e4e8;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#f6f8fa;border-bottom:1px solid #e1e4e8">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#586069">RULE</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#586069">SEVERITY</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#586069">MESSAGE</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#586069">FIX</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  const summaryColor =
    critical > 0 ? "#b31d28" :
    high     > 0 ? "#d73a49" :
    medium   > 0 ? "#e36209" : "#28a745";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; color:#24292e; margin:0; padding:24px; background:#f6f8fa }
    .container { max-width:960px; margin:0 auto }
    h1 { font-size:24px; margin:0 0 4px }
    .generated { color:#586069; font-size:13px; margin-bottom:24px }
    .summary { display:flex; gap:16px; margin-bottom:24px }
    .stat { background:#fff; border:1px solid #e1e4e8; border-radius:6px; padding:12px 20px; text-align:center }
    .stat-num { font-size:28px; font-weight:700; line-height:1 }
    .stat-label { font-size:12px; color:#586069; margin-top:4px }
    details summary::-webkit-details-marker { display:none }
  </style>
</head>
<body>
  <div class="container">
    <h1>ManifestVet Report</h1>
    <p class="generated">Generated: ${new Date().toISOString()}</p>
    <div class="summary">
      <div class="stat"><div class="stat-num" style="color:#b31d28">${critical}</div><div class="stat-label">Critical</div></div>
      <div class="stat"><div class="stat-num" style="color:#d73a49">${high}</div><div class="stat-label">High</div></div>
      <div class="stat"><div class="stat-num" style="color:#e36209">${medium}</div><div class="stat-label">Medium</div></div>
      <div class="stat"><div class="stat-num" style="color:#28a745">${low}</div><div class="stat-label">Low</div></div>
      <div class="stat"><div class="stat-num" style="color:#0366d6">${info}</div><div class="stat-label">Info</div></div>
      <div class="stat"><div class="stat-num" style="color:${summaryColor}">${violations.length}</div><div class="stat-label">Total</div></div>
    </div>
    ${violations.length === 0 ? '<p style="color:#28a745;font-weight:600">✓ No issues found.</p>' : resourceSections}
  </div>
</body>
</html>`;
}
