"use client";
import { useRef, useState } from "react";
import { ISSUES, SEV_LABEL } from "../lib/issues.js";
import { clicksWord, fmtGain, fmtNum } from "../lib/traffic.js";
import { IconDownload } from "./Icons.js";

function Upload({ months, onFile, label = "Choose Search Console file" }) {
  const ref = useRef(null);
  const [m, setM] = useState(months || 3);
  return (
    <div className="ti-upload">
      <label className="ti-months">Export covers
        <select value={m} onChange={(e) => setM(Number(e.target.value))}>
          {[1, 3, 6, 12, 16].map((n) => (<option key={n} value={n}>{n} {n === 1 ? "month" : "months"}</option>))}
        </select>
      </label>
      <input ref={ref} type="file" accept=".csv,.tsv,.txt" hidden onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onFile(f, m); e.target.value = ""; }} />
      <button type="button" className="btn primary small" onClick={() => ref.current && ref.current.click()}><IconDownload style={{ transform: "rotate(180deg)" }} /> {label}</button>
    </div>
  );
}

/** What the traffic on these pages is, and what fixing the issues could add. */
export default function TrafficImpact({ traffic, impact, error, noun = "posts", onFile, onClear, onFocusIssue, onOpenPage }) {
  if (!traffic || !impact) {
    return (
      <section className="card traffic">
        <h3>What fixing these could be worth</h3>
        <p className="card-sub">Add your Google Search Console traffic to see which problems sit on pages that get visitors, and what fixing them could add.</p>
        <ol className="ti-steps">
          <li>Open Search Console, then <b>Performance</b>, then <b>Search results</b>.</li>
          <li>Set the dates (for example the last 3 months) and open the <b>Pages</b> tab.</li>
          <li>Click <b>Export</b>, download the CSV, unzip it, and choose <b>Pages.csv</b> below.</li>
        </ol>
        <Upload onFile={onFile} />
        {error && <p className="alert error" role="alert">{error}</p>}
        <p className="muted small-note">Orange cannot read your traffic by itself, because Google only shares it with you. The file stays in this browser and is never uploaded.</p>
      </section>
    );
  }

  const { snippet, groups, losing, top, months } = impact;
  const rows = Array.from(groups.entries())
    .map(([code, g]) => ({ code, ...g, ...ISSUES[code] }))
    .filter((r) => r.clicks > 0)
    .sort((a, b) => b.gainHigh - a.gainHigh || b.clicks - a.clicks)
    .slice(0, 6);

  return (
    <section className="card traffic">
      <div className="ch-head">
        <h3>What fixing these could be worth</h3>
        <span className="muted">{traffic.kind} data, {months} {months === 1 ? "month" : "months"}</span>
      </div>

      <div className="ti-stats">
        <div><b>{fmtNum(impact.clicksPerMonth)}</b><span>clicks a month on these {noun}</span></div>
        <div><b>{impact.matched}<small> of {impact.total}</small></b><span>{noun} found in your file</span></div>
        {impact.hasImp
          ? <div className="gain"><b>{fmtGain(snippet.low, snippet.high)}</b><span>clicks a month from better titles and descriptions</span></div>
          : <div><b>n/a</b><span>needs impressions. Use the Search Console file.</span></div>}
      </div>

      {rows.length > 0 && (
        <>
          <h4 className="ti-h">Problems on pages with traffic</h4>
          <ul className="ti-rows">
            {rows.map((r) => (
              <li key={r.code}>
                <button type="button" onClick={() => onFocusIssue(r.code)}>
                  <span className={`dot ${r.sev}`} aria-label={SEV_LABEL[r.sev]} />
                  <span className="ti-main"><span className="ti-title">{r.title}</span><span className="ti-sub">{r.matched} {r.matched === 1 ? "post" : "posts"} with traffic, {fmtNum(r.clicks)} {clicksWord(r.clicks)} a month</span></span>
                  <span className="ti-gain">{r.gainHigh >= 0.5 ? <><b>{fmtGain(r.gainLow, r.gainHigh)}</b><small>clicks a month</small></> : <small>ranking effect, not estimated</small>}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {top.length > 0 && (
        <>
          <h4 className="ti-h">Biggest wins: fix these {noun} first</h4>
          <ul className="ti-rows">
            {top.map((t) => (
              <li key={t.page.key}>
                <button type="button" onClick={() => onOpenPage(t.page.key)}>
                  <span className="ti-main"><span className="ti-title">{(t.page.data && t.page.data.title) || t.page.url}</span><span className="u">{t.page.url}</span>
                    <span className="ti-sub">{fmtNum(t.perMonth)} {clicksWord(t.perMonth)} a month, {(t.ctr * 100).toFixed(1)}% click rate, position {t.pos.toFixed(1)}</span></span>
                  <span className="ti-gain"><b>{fmtGain(t.gainLow, t.gainHigh)}</b><small>clicks a month</small></span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {losing.length > 0 && (
        <>
          <h4 className="ti-h error">Traffic going to broken pages</h4>
          <ul className="ti-rows">
            {losing.slice(0, 5).map((t) => (
              <li key={t.page.key}>
                <button type="button" onClick={() => onOpenPage(t.page.key)}>
                  <span className="ti-main"><span className="u">{t.page.url}</span><span className="ti-sub">Status {t.page.status || "failed"}</span></span>
                  <span className="ti-gain"><b>{fmtNum(t.perMonth)}</b><small>clicks a month at risk</small></span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="ti-how">
        <summary>How these estimates work</summary>
        <p>Clicks are real numbers from your file. The gains are an estimate. For each page, Orange compares its click rate with the typical click rate for its average Google position, then assumes a fix closes 15% to 40% of that gap. Google sometimes rewrites descriptions, and rankings change, so treat the range as a rough guide, not a promise. Problems like missing headings affect rankings in ways that cannot be put into a number, so they are not estimated.</p>
      </details>

      <div className="ti-foot">
        <Upload months={months} onFile={onFile} label="Replace file" />
        <button type="button" className="link-btn" onClick={onClear}>Remove traffic data</button>
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
    </section>
  );
}
