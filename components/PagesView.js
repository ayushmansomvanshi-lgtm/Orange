"use client";
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "./Icons.js";

const FILTERS = [
  ["all", "All pages", () => true],
  ["errors", "Has errors", (p) => p.counts.error > 0],
  ["broken", "Broken", (p) => !p.status || p.status >= 400],
  ["redirects", "Redirects", (p) => p.chain && p.chain.length > 0],
  ["thin", "Thin content", (p) => p.data && p.data.words < 300],
];

const COLS = [
  ["score", "Score", (p) => p.score],
  ["page", "Page", (p) => (p.data?.title || p.url).toLowerCase()],
  ["status", "Status", (p) => p.status || 999],
  ["issues", "Issues", (p) => p.counts.error * 10000 + p.counts.warning * 100 + p.counts.notice],
  ["words", "Words", (p) => p.data?.words ?? -1],
  ["time", "Time", (p) => p.total || 0],
];

export default function PagesView({ pages, onOpen }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "score", dir: 1 });
  const [limit, setLimit] = useState(150);
  useEffect(() => { setLimit(150); }, [filter, q, sort]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k, , fn]) => [k, pages.filter(fn).length])), [pages]);
  const rows = useMemo(() => {
    const fn = FILTERS.find((f) => f[0] === filter)[2];
    const get = COLS.find((c) => c[0] === sort.key)[2];
    const needle = q.trim().toLowerCase();
    return pages
      .filter(fn)
      .filter((p) => !needle || p.url.toLowerCase().includes(needle) || (p.data?.title || "").toLowerCase().includes(needle))
      .sort((a, b) => { const x = get(a), y = get(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [pages, filter, q, sort]);

  const th = ([key, label]) => (
    <th key={key} className={key === "page" ? "" : "num"} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filter pages">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{label}<span>{counts[k]}</span></button>
          ))}
        </div>
        <label className="search">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or address" />
        </label>
      </div>
      <div className="card table-card">
        <table className="table">
          <thead><tr>{COLS.map(th)}</tr></thead>
          <tbody>
            {rows.slice(0, limit).map((p) => (
              <tr key={p.key} tabIndex={0} onClick={() => onOpen(p.key)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(p.key); }}>
                <td className="num"><span className={`pill ${p.score >= 80 ? "good" : p.score >= 50 ? "warn" : "error"}`}>{p.score}</span></td>
                <td className="page-cell">
                  <span className="ptitle">{p.data?.title || (p.status >= 400 || p.error ? "(page not available)" : "(no title)")}</span>
                  <span className="u">{p.url}</span>
                </td>
                <td className="num"><span className={`code ${!p.status ? "error" : p.status < 300 ? "good" : p.status < 400 ? "notice" : "error"}`}>{p.status || "ERR"}</span></td>
                <td className="num">
                  <span className="mini">
                    {p.counts.error > 0 && <b className="error">{p.counts.error}</b>}
                    {p.counts.warning > 0 && <b className="warn">{p.counts.warning}</b>}
                    {p.counts.notice > 0 && <b className="notice">{p.counts.notice}</b>}
                    {p.all.length === 0 && <span className="muted">0</span>}
                  </span>
                </td>
                <td className="num">{p.data ? p.data.words.toLocaleString() : "n/a"}</td>
                <td className="num">{p.total ? (p.total / 1000).toFixed(2) + " s" : "n/a"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="empty">No pages match.</td></tr>}
          </tbody>
        </table>
        {rows.length > limit && <div className="more-row"><button type="button" className="btn small" onClick={() => setLimit((l) => l + 300)}>Show {Math.min(300, rows.length - limit)} more ({(rows.length - limit).toLocaleString("en-US")} left)</button></div>}
      </div>
    </div>
  );
}
