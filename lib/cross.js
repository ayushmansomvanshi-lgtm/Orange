import { ISSUES } from "./issues.js";
import { keyOf } from "./url.js";

// Convert each page's links to keys once, not on every recalculation
const keyCache = new WeakMap();
const linkKeys = (list) => { let k = keyCache.get(list); if (!k) { k = list.map(keyOf); keyCache.set(list, k); } return k; };

const push = (map, k, v) => { if (!map.has(k)) map.set(k, []); map.get(k).push(v); };

/**
 * Takes raw pages from the crawler (with their own `issues`) and adds the checks
 * that need the whole site: broken links, duplicates, orphans, external links.
 * Returns new page objects with counts, score and inbound link counts.
 */
export function analyzePages(rawPages, { sitemapKeys = [], external = [] } = {}) {
  const pages = rawPages.map((p) => ({ ...p, all: (p.issues || []).slice(), inlinks: 0 }));
  const byKey = new Map(pages.map((p) => [p.key, p]));
  const sitemap = new Set(sitemapKeys);
  const titles = new Map(), descs = new Map();

  for (const p of pages) {
    const d = p.data;
    if (!d) continue;
    const seen = new Set();
    const hrefs = d.internal || [];
    const keys = linkKeys(hrefs);
    for (let n = 0; n < hrefs.length; n++) {
      const href = hrefs[n], k = keys[n];
      if (k === p.key || seen.has(k)) continue;
      seen.add(k);
      const t = byKey.get(k);
      if (!t) continue;
      t.inlinks++;
      if (t.error || (t.status && t.status >= 400)) p.all.push({ code: "broken-link", detail: `${href} (${t.status || "failed"})` });
      else if (t.chain && t.chain.length) p.all.push({ code: "link-redirect", detail: `${href} → ${t.finalUrl}` });
    }
    if (d.title) push(titles, d.title.toLowerCase(), p);
    if (d.description) push(descs, d.description.toLowerCase(), p);
  }
  const dupes = (map, code) => map.forEach((rows) => {
    if (rows.length > 1) rows.forEach((p) => p.all.push({ code, detail: `Shared with ${rows.length - 1} other page${rows.length > 2 ? "s" : ""}` }));
  });
  dupes(titles, "dup-title");
  dupes(descs, "dup-desc");

  if (sitemap.size) {
    pages.forEach((p) => {
      if (p.data && sitemap.has(p.key) && p.inlinks === 0 && p.depth > 0) p.all.push({ code: "orphan", detail: "No internal links found" });
    });
  }
  external.forEach((ext) => {
    (ext.pages || []).forEach((k) => {
      const p = byKey.get(k);
      if (p) p.all.push({ code: "broken-external", detail: `${ext.url} (${ext.status})` });
    });
  });

  pages.forEach((p) => {
    p.all = p.all.filter((i) => !ISSUES[i.code].off);
    let e = 0, w = 0, n = 0;
    p.all.forEach((i) => {
      const s = ISSUES[i.code].sev;
      if (s === "error") e++; else if (s === "warning") w++; else n++;
    });
    p.counts = { error: e, warning: w, notice: n };
    p.score = Math.max(0, 100 - (e * 15 + w * 6 + n * 2));
    if (p.error || !p.status || p.status >= 400) p.score = Math.min(p.score, 20); // a broken page is never healthy
  });
  return pages;
}

export function summarize(pages) {
  const groupsMap = new Map();
  const totals = { error: 0, warning: 0, notice: 0 };
  const status = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, failed: 0 };
  const buckets = { good: 0, fair: 0, poor: 0 };
  let timeSum = 0, timeN = 0, scoreSum = 0;

  for (const p of pages) {
    scoreSum += p.score;
    if (p.score >= 80) buckets.good++; else if (p.score >= 50) buckets.fair++; else buckets.poor++;
    const s = p.status;
    if (!s) status.failed++; else if (s < 300) status["2xx"]++; else if (s < 400) status["3xx"]++; else if (s < 500) status["4xx"]++; else status["5xx"]++;
    if (p.total) { timeSum += p.total; timeN++; }
    for (const i of p.all) {
      totals[ISSUES[i.code].sev]++;
      if (!groupsMap.has(i.code)) groupsMap.set(i.code, []);
      groupsMap.get(i.code).push({ url: p.url, detail: i.detail });
    }
  }
  const rank = { error: 0, warning: 1, notice: 2 };
  const groups = Array.from(groupsMap.entries())
    .map(([code, rows]) => ({ code, rows, ...ISSUES[code] }))
    .sort((a, b) => rank[a.sev] - rank[b.sev] || b.rows.length - a.rows.length);
  const weight = { error: 5, warning: 3, notice: 1 };
  const fixFirst = groups.slice().sort((a, b) => weight[b.sev] * b.rows.length - weight[a.sev] * a.rows.length).slice(0, 5);
  return {
    totals, status, buckets, groups, fixFirst,
    score: pages.length ? Math.round(scoreSum / pages.length) : 0,
    avgMs: timeN ? Math.round(timeSum / timeN) : 0,
  };
}
