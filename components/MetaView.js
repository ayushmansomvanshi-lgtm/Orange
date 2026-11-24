"use client";
import { useEffect, useMemo, useState } from "react";
import { META_STATUS, STATUS_ORDER, metaRows, startValue } from "../lib/meta.js";
import { downloadMetaCsv } from "../lib/export.js";
import Meter from "./Meter.js";
import SerpPreview from "./SerpPreview.js";
import { IconDownload, IconSearch } from "./Icons.js";
import { clicksWord, fmtNum, fmtRange } from "../lib/traffic.js";

const SORTS = {
  worst: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  longest: (a, b) => b.desc.length - a.desc.length,
  shortest: (a, b) => a.desc.length - b.desc.length,
  title: (a, b) => a.title.localeCompare(b.title),
  traffic: null, // set below when traffic is loaded
};

function Counter({ n }) {
  const tone = n === 0 ? "none" : n < 70 ? "warn" : n <= 160 ? "good" : "error";
  return <span className={`counter ${tone}`}>{n} <small>/ 160</small></span>;
}

function MetaRow({ r, value, onChange, info }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const st = META_STATUS[r.status];

  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }

  return (
    <details className={`mrow ${st.tone}`} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <span className={`badge ${st.tone}`}>{st.label}</span>
        <span className="mr-main">
          <span className="mr-title">{r.title || "(no title)"}</span>
          <span className="mr-snippet">{r.desc || <i>No meta description</i>}</span>
        </span>
        <span className="mr-len"><b>{r.desc.length}</b><small>chars</small></span>
      </summary>

      {open && (
        <div className="mr-body">
          {info && (
            <p className="mr-traffic">
              <b>{fmtNum(info.perMonth)}</b> {clicksWord(info.perMonth)} a month, click rate <b>{(info.ctr * 100).toFixed(1)}%</b>, average position <b>{info.pos.toFixed(1)}</b>.
              {info.gainHigh >= 0.5 && info.hasSnippet && <> A better title and description could add <b>{fmtRange(info.gainLow, info.gainHigh)}</b> clicks a month.</>}
            </p>
          )}
          <p className="mr-url"><a className="u link" href={r.page.url} target="_blank" rel="noreferrer">{r.page.url}</a></p>
          <div className="mr-cols">
            <div className="mr-col">
              <h4>Current description</h4>
              <p className={`mr-current ${r.desc ? "" : "none"}`}>{r.desc || "This post has no meta description."}</p>
              <Meter len={r.desc.length} lo={70} hi={160} max={240} />
              <p className="mr-note">{st.hint}{r.detail ? `. ${r.detail}` : ""}. Aim for 70 to 160 characters.</p>
            </div>
            <div className="mr-col">
              <div className="mr-edit-head">
                <h4>New description</h4>
                <Counter n={value.length} />
              </div>
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                spellCheck
                placeholder="Write 70 to 160 characters that explain what the post offers and why to click."
                aria-label={`New meta description for ${r.title || r.page.url}`}
              />
              <div className="mr-actions">
                <button type="button" className="btn small" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
                {r.suggestion && <button type="button" className="link-btn" onClick={() => onChange(r.suggestion)}>Use auto-draft</button>}
                {r.desc && <button type="button" className="link-btn" onClick={() => onChange(r.desc)}>Use current</button>}
              </div>
              {r.suggestion && <p className="mr-note">The auto-draft is taken from the post’s opening text. Edit it before you use it.</p>}
            </div>
          </div>
          <h4 className="mr-prev-h">How it will look in search</h4>
          <SerpPreview url={r.page.url} title={r.title} desc={value} />
        </div>
      )}
    </details>
  );
}

export default function MetaView({ pages, edits, setEdits, running, host, unsure, impact }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("worst");
  const [limit, setLimit] = useState(100);
  useEffect(() => { setLimit(100); }, [filter, q, sort]);

  const rows = useMemo(() => metaRows(pages), [pages]);
  const counts = useMemo(() => {
    const c = { all: rows.length };
    STATUS_ORDER.forEach((k) => { c[k] = 0; });
    rows.forEach((r) => { c[r.status]++; });
    return c;
  }, [rows]);
  const healthy = rows.length ? Math.round((counts.good / rows.length) * 100) : 0;
  const failed = pages.length - rows.length;
  const edited = Object.keys(edits).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !needle || r.title.toLowerCase().includes(needle) || r.page.url.toLowerCase().includes(needle) || r.desc.toLowerCase().includes(needle))
      .sort(sort === "traffic" && impact ? (a, b) => ((impact.per.get(b.key) || {}).clicks || 0) - ((impact.per.get(a.key) || {}).clicks || 0) : SORTS[sort] || SORTS.worst);
  }, [rows, filter, q, sort, impact]);

  return (
    <div>
      <section className="card meta-sum">
        <div className="ms-big">
          <span className="ms-num">{healthy}<small>%</small></span>
          <span className="ms-label">of {rows.length} {rows.length === 1 ? "post has" : "posts have"} a healthy description</span>
        </div>
        <div className="ms-right">
          <div className="stack" role="img" aria-label="Description status across posts">
            {STATUS_ORDER.map((k) => counts[k] > 0 && (
              <span key={k} className={`seg ${META_STATUS[k].tone} s-${k}`} style={{ flexGrow: counts[k] }} title={`${META_STATUS[k].label}: ${counts[k]}`} />
            ))}
            {rows.length === 0 && <span className="seg none" style={{ flexGrow: 1 }} />}
          </div>
          <ul className="legend">
            {STATUS_ORDER.map((k) => (
              <li key={k}><span className={`sw s-${k}`} />{META_STATUS[k].label}<b>{counts[k]}</b></li>
            ))}
          </ul>
        </div>
        <div className="ms-actions">
          <button type="button" className="btn" onClick={() => downloadMetaCsv(rows, edits, host)} disabled={!rows.length}>
            <IconDownload /> Export CSV
          </button>
          {edited > 0 && <small className="muted">{edited} edited</small>}
        </div>
      </section>
      {unsure && <p className="note-line">Orange could not tell which pages are posts on this site, so every page it found is listed.</p>}
      {failed > 0 && <p className="note-line">{failed} {failed === 1 ? "page" : "pages"} could not be loaded and {failed === 1 ? "is" : "are"} not listed here.</p>}

      <div className="toolbar wrap">
        <div className="chips" role="group" aria-label="Filter by status">
          <button type="button" className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>All<span>{counts.all}</span></button>
          {STATUS_ORDER.filter((k) => counts[k] > 0).map((k) => (
            <button key={k} type="button" className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{META_STATUS[k].label}<span>{counts[k]}</span></button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort posts">
          <option value="worst">Needs work first</option>
          <option value="longest">Longest first</option>
          <option value="shortest">Shortest first</option>
          <option value="title">Title A to Z</option>
          {impact && <option value="traffic">Most traffic first</option>}
        </select>
        <label className="search">
          <IconSearch />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts or descriptions" />
        </label>
      </div>

      <div className="mlist">
        {shown.slice(0, limit).map((r) => (
          <MetaRow key={r.key} r={r} info={impact && impact.per.get(r.key)} value={startValue(r, edits)} onChange={(v) => setEdits((e) => ({ ...e, [r.key]: v }))} />
        ))}
        {shown.length > limit && <div className="more-row"><button type="button" className="btn small" onClick={() => setLimit((l) => l + 200)}>Show {Math.min(200, shown.length - limit)} more ({(shown.length - limit).toLocaleString("en-US")} left)</button></div>}
        {running && rows.length === 0 && [0, 1, 2, 3].map((i) => <div className="mrow skeleton" key={i} />)}
        {!running && shown.length === 0 && <div className="card empty">{rows.length ? "No posts match these filters." : "No posts were loaded."}</div>}
      </div>
    </div>
  );
}
