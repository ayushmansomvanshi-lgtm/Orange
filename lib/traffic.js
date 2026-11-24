import { stripWww } from "./url.js";

/* ---------- Reading the file (Search Console "Pages" export, or a Google Analytics pages export) ---------- */
export function parseCsv(text) {
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === "\t") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()) && r[0].trim().charAt(0) !== "#");
}

export function pathOf(raw) {
  try {
    const u = String(raw).charAt(0) === "/" ? new URL(raw, "https://x.invalid") : new URL(raw);
    let p = u.pathname;
    try { p = decodeURIComponent(p); } catch {}
    p = p.toLowerCase();
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  } catch { return String(raw).toLowerCase(); }
}
const hostOfRaw = (raw) => { try { return String(raw).charAt(0) === "/" ? "" : stripWww(new URL(raw).host); } catch { return ""; } };

/** Returns { rows: [[path, clicks, impressions, position]], hasImp, kind } */
export function parseTrafficCsv(text, siteHost) {
  const all = parseCsv(String(text).replace(/^\uFEFF/, ""));
  if (all.length < 2) throw new Error("The file has no data rows.");
  const head = all[0].map((h) => h.trim().toLowerCase());
  const data = all.slice(1);
  let pc = -1;
  for (let c = 0; c < head.length && pc < 0; c++) {
    const sample = data.slice(0, 5).map((r) => (r[c] || "").trim());
    if (sample.some((v) => /^https?:\/\//i.test(v) || v.charAt(0) === "/")) pc = c;
  }
  if (pc < 0) throw new Error("Could not find a page or URL column.");
  const find = (re) => head.findIndex((h, i) => i !== pc && re.test(h));
  const ci = find(/^clicks$/), ii = find(/impression/), pi = find(/position/), vi = find(/^(views|pageviews|page views|sessions)$/);
  if (ci < 0 && ii < 0 && vi < 0) throw new Error("No clicks, impressions, or views column found.");
  const num = (v) => parseFloat(String(v || "").replace(/[,%\s]/g, "")) || 0;
  const host = stripWww(siteHost || "");
  const map = new Map();
  data.forEach((r) => {
    const raw = (r[pc] || "").trim();
    const h = hostOfRaw(raw);
    if (h && host && h !== host) return; // a different site in the same export
    const k = pathOf(raw);
    const m = map.get(k) || { c: 0, i: 0, ps: 0, w: 0 };
    const imp = ii > -1 ? num(r[ii]) : 0;
    m.c += ci > -1 ? num(r[ci]) : vi > -1 ? num(r[vi]) : 0;
    m.i += imp;
    if (pi > -1) { m.ps += num(r[pi]) * (imp || 1); m.w += imp || 1; }
    map.set(k, m);
  });
  const rows = Array.from(map.entries()).map(([k, m]) => [k, m.c, m.i, m.w ? m.ps / m.w : 0]);
  if (!rows.length) throw new Error("None of the rows in that file belong to this website.");
  return { rows: rows.slice(0, 20000), hasImp: ii > -1, kind: ci > -1 || ii > -1 ? "Search Console" : "Analytics" };
}

/* ---------- Estimating what a fix could be worth ---------- */

// Typical share of searchers who click, by average Google position (industry averages; every site differs)
const CTR_BY_POSITION = [0.28, 0.15, 0.11, 0.08, 0.065, 0.05, 0.04, 0.032, 0.027, 0.023];
export function expectedCtr(pos) {
  if (pos <= 0) return 0;
  if (pos <= 1) return CTR_BY_POSITION[0];
  if (pos <= 10) { const i = Math.floor(pos - 1), f = pos - 1 - i; return CTR_BY_POSITION[i] + (CTR_BY_POSITION[Math.min(i + 1, 9)] - CTR_BY_POSITION[i]) * f; }
  if (pos <= 20) return 0.012 - ((pos - 10) / 10) * 0.006;
  return 0.004;
}

// Problems with the title or description shown in search results. Fixing these can raise the click rate.
export const SNIPPET_ISSUES = new Set(["desc-missing", "desc-short", "dup-desc", "desc-same-title", "title-short", "title-missing"]);
// Only part of the gap to the typical click rate is realistically closed, and Google sometimes rewrites snippets
const CLOSE_LOW = 0.15, CLOSE_HIGH = 0.4;

export function computeImpact(pages, traffic) {
  const months = Math.max(1, traffic.months || 3);
  const idx = new Map(traffic.rows.map((r) => [r[0], r]));
  const per = new Map(), groups = new Map();
  const snippet = { low: 0, high: 0, posts: 0 };
  let matched = 0, clicks = 0, imp = 0;

  for (const p of pages) {
    const row = idx.get(pathOf(p.url));
    const codes = Array.from(new Set(p.all.map((i) => i.code)));
    const hasSnippet = codes.some((c) => SNIPPET_ISSUES.has(c));
    let info = null, low = 0, high = 0;
    if (row) {
      matched++; clicks += row[1]; imp += row[2];
      const pos = row[3], ctr = row[2] ? row[1] / row[2] : 0;
      if (traffic.hasImp && row[2] > 0 && pos > 0) {
        const gap = Math.max(0, expectedCtr(pos) - ctr) * row[2];
        low = (gap * CLOSE_LOW) / months; high = (gap * CLOSE_HIGH) / months;
      }
      info = { clicks: row[1], imp: row[2], pos, ctr, perMonth: row[1] / months, gainLow: low, gainHigh: high, hasSnippet };
      per.set(p.key, info);
      if (hasSnippet) { snippet.low += low; snippet.high += high; snippet.posts++; }
    }
    codes.forEach((code) => {
      const g = groups.get(code) || { posts: 0, matched: 0, clicks: 0, gainLow: 0, gainHigh: 0 };
      g.posts++;
      if (info) { g.matched++; g.clicks += info.perMonth; if (SNIPPET_ISSUES.has(code)) { g.gainLow += low; g.gainHigh += high; } }
      groups.set(code, g);
    });
  }

  const losing = pages
    .filter((p) => (p.error || !p.status || p.status >= 400) && per.has(p.key) && per.get(p.key).clicks > 0)
    .map((p) => ({ page: p, ...per.get(p.key) }))
    .sort((a, b) => b.clicks - a.clicks);
  const top = pages
    .filter((p) => per.has(p.key) && per.get(p.key).hasSnippet && per.get(p.key).gainHigh >= 0.5)
    .map((p) => ({ page: p, ...per.get(p.key) }))
    .sort((a, b) => b.gainHigh - a.gainHigh)
    .slice(0, 6);

  return { months, matched, total: pages.length, clicksPerMonth: clicks / months, impPerMonth: imp / months, per, groups, snippet, losing, top, hasImp: traffic.hasImp, kind: traffic.kind };
}

export const fmtNum = (n) => Math.round(n).toLocaleString("en-US");
export function fmtRange(low, high) {
  if (high < 0.5) return "under 1";
  const l = Math.round(low), h = Math.round(high);
  return l >= h ? `about ${h}` : l < 1 ? `up to ${h}` : `${l} to ${h}`;
}

// Short form for badges: "+6 to +15", "up to +15", "about +9"
export function fmtGain(low, high) {
  if (high < 0.5) return "under +1";
  const l = Math.round(low), h = Math.round(high);
  return l >= h ? `about +${h}` : l < 1 ? `up to +${h}` : `+${l} to +${h}`;
}

export const clicksWord = (n) => (Math.round(n) === 1 ? "click" : "clicks");
