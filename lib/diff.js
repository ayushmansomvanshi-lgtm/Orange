import { ISSUES, SEV_RANK } from "./issues.js";

// These checks can appear many times on one page, so each instance counts on its own
const MULTI = new Set(["broken-link", "link-redirect", "broken-external"]);
export const issueId = (i) => (MULTI.has(i.code) ? `${i.code}|${String(i.detail || "").slice(0, 100)}` : i.code);
const codeOf = (id) => id.split("|")[0];
const detailOf = (id) => (id.includes("|") ? id.slice(id.indexOf("|") + 1) : "");

/** A small record of one audit: which issues each page had. Stored in this browser only. */
export function makeSnapshot(pages) {
  const map = {};
  pages.forEach((p) => { map[p.key] = p.all.map(issueId); });
  return { date: Date.now(), pages: map };
}

/**
 * Compares the current audit with the last one. Only pages that appear in both are compared,
 * so pages skipped by a page limit are never counted as fixed.
 */
export function diffRuns(prev, pages) {
  const fixed = [], added = [];
  let open = 0, fresh = 0;
  const seen = new Set();
  for (const p of pages) {
    seen.add(p.key);
    const before = prev.pages[p.key];
    if (!before) { fresh++; continue; }
    const was = new Set(before);
    const now = new Set(p.all.map(issueId));
    now.forEach((id) => {
      if (was.has(id)) open++;
      else added.push({ page: p, id, code: codeOf(id), detail: detailOf(id) || (p.all.find((i) => issueId(i) === id) || {}).detail || "" });
    });
    was.forEach((id) => { if (!now.has(id) && ISSUES[codeOf(id)] && !ISSUES[codeOf(id)].off) fixed.push({ page: p, id, code: codeOf(id), detail: detailOf(id) }); });
  }
  const gone = Object.keys(prev.pages).filter((k) => !seen.has(k)).length;
  const bySev = (a, b) => SEV_RANK[ISSUES[a.code].sev] - SEV_RANK[ISSUES[b.code].sev];
  fixed.sort(bySev);
  added.sort(bySev);
  return { date: prev.date, fixed, added, open, fresh, gone };
}
