import { ISSUES } from "./issues.js";

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const q = (c) => '"' + String(c ?? "").replace(/"/g, '""') + '"';

export function downloadCsv(pages, host, impact) {
  const rows = [["url", "status", "score", "severity", "category", "issue", "detail", "how_to_fix", ...(impact ? ["clicks_per_month", "impressions_per_month", "avg_position"] : [])]];
  pages.forEach((p) => {
    p.all.forEach((i) => {
      const d = ISSUES[i.code];
      const t = impact && impact.per.get(p.key);
      rows.push([p.url, p.status || "failed", p.score, d.sev, d.cat, d.title, i.detail, d.fix, ...(impact ? [t ? Math.round(t.perMonth) : 0, t ? Math.round(t.imp / impact.months) : 0, t ? t.pos.toFixed(1) : ""] : [])]);
    });
  });
  download(`orange-${host}.csv`, "\uFEFF" + rows.map((r) => r.map(q).join(",")).join("\r\n"), "text/csv");
}

export function downloadJson(pages, summary, host) {
  const out = {
    site: host, date: new Date().toISOString(), score: summary.score, totals: summary.totals,
    pages: pages.map((p) => ({
      url: p.url, status: p.status, score: p.score, title: p.data?.title || "", words: p.data?.words ?? null,
      issues: p.all.map((i) => ({ code: i.code, severity: ISSUES[i.code].sev, issue: ISSUES[i.code].title, detail: i.detail, fix: ISSUES[i.code].fix })),
    })),
  };
  download(`orange-${host}.json`, JSON.stringify(out, null, 2), "application/json");
}

export function downloadMetaCsv(rows, edits, host) {
  const out = [["url", "title", "status", "current_description", "current_length", "new_description", "new_length"]];
  rows.forEach((r) => {
    const next = edits[r.key] ?? (r.status === "good" ? "" : r.suggestion);
    out.push([r.page.url, r.title, r.status, r.desc, r.desc.length, next, next.length]);
  });
  download(`meta-descriptions-${host}.csv`, "\uFEFF" + out.map((r) => r.map(q).join(",")).join("\r\n"), "text/csv");
}
