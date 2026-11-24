"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, SEV_LABEL } from "../lib/issues.js";
import { IconSearch } from "./Icons.js";

function Rows({ rows, onOpenPage }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 100);
  return (
    <ul className="rows">
      {shown.map((r, i) => (
        <li key={r.url + i}>
          <button type="button" onClick={() => onOpenPage(r.url)}>
            <span className="u">{r.url}</span>
            {r.detail && <span className="detail">{r.detail}</span>}
          </button>
        </li>
      ))}
      {rows.length > 100 && !all && <li className="ch-more"><button type="button" className="link-btn" onClick={() => setAll(true)}>Show all {rows.length.toLocaleString("en-US")}</button></li>}
    </ul>
  );
}

import { clicksWord } from "../lib/traffic.js";

export default function IssuesView({ groups, impact, focus, onOpenPage }) {
  const [sev, setSev] = useState("all");
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const focusRef = useRef(null);

  useEffect(() => {
    if (focus && focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  const counts = useMemo(() => {
    const c = { all: groups.length, error: 0, warning: 0, notice: 0 };
    groups.forEach((g) => { c[g.sev]++; });
    return c;
  }, [groups]);

  const shown = groups.filter((g) => {
    if (sev !== "all" && g.sev !== sev) return false;
    if (cat !== "all" && g.cat !== cat) return false;
    if (q && !(g.title.toLowerCase().includes(q.toLowerCase()) || g.rows.some((r) => r.url.toLowerCase().includes(q.toLowerCase())))) return false;
    return true;
  });

  return (
    <div>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filter by severity">
          {[["all", "All"], ["error", "Errors"], ["warning", "Warnings"], ["notice", "Notices"]].map(([k, label]) => (
            <button key={k} type="button" className={`chip ${sev === k ? "on" : ""}`} onClick={() => setSev(k)}>
              {label}<span>{counts[k]}</span>
            </button>
          ))}
        </div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <label className="search">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issues or addresses" />
        </label>
      </div>

      {shown.length === 0 && <div className="card empty">No issues match these filters.</div>}
      {shown.map((g) => (
        <details className={`issue ${g.sev}`} key={g.code} id={`issue-${g.code}`} open={focus === g.code || undefined} ref={focus === g.code ? focusRef : null}>
          <summary>
            <span className={`badge ${g.sev}`}>{SEV_LABEL[g.sev]}</span>
            <span className="issue-title">{g.title}</span>
            <span className="cat">{g.cat}</span>
            {impact && impact.groups.get(g.code) && impact.groups.get(g.code).clicks > 0 && <span className="issue-clicks">{Math.round(impact.groups.get(g.code).clicks).toLocaleString("en-US")} {clicksWord(impact.groups.get(g.code).clicks)} a month</span>}
            <span className="issue-count">{g.rows.length} {g.rows.length === 1 ? "page" : "pages"}</span>
          </summary>
          <div className="issue-body">
            <p className="issue-fix"><b>How to fix:</b> {g.fix}</p>
            <Rows rows={g.rows} onOpenPage={onOpenPage} />
          </div>
        </details>
      ))}
    </div>
  );
}
