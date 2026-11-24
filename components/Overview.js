"use client";
import ScoreRing from "./ScoreRing.js";
import Changes from "./Changes.js";
import TrafficImpact from "./TrafficImpact.js";
import { SEV_LABEL } from "../lib/issues.js";
import { shortUrl } from "../lib/url.js";

function Delta({ cur, prev, goodWhen }) {
  if (prev == null) return <span className="delta muted">First run</span>;
  const d = cur - prev;
  if (d === 0) return <span className="delta muted">No change</span>;
  const good = goodWhen === "up" ? d > 0 : d < 0;
  return <span className={`delta ${good ? "good" : "bad"}`}>{d > 0 ? "+" : ""}{d} since last run</span>;
}

function Stat({ label, value, tone, prev }) {
  return (
    <div className={`stat ${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-num">{value.toLocaleString()}</span>
      <Delta cur={value} prev={prev} goodWhen="down" />
    </div>
  );
}

const STATUS_META = [
  ["2xx", "OK (2xx)", "good"], ["3xx", "Redirect (3xx)", "notice"], ["4xx", "Not found (4xx)", "error"],
  ["5xx", "Server error (5xx)", "error"], ["failed", "Failed to load", "error"],
];

export default function Overview({ summary, pages, running, prev, changes, traffic, impact, trafficError, noun, onTrafficFile, onTrafficClear, onFocusIssue, onOpenPage }) {
  const { totals, status, buckets, groups, fixFirst, score, avgMs } = summary;
  const maxStatus = Math.max(1, ...Object.values(status));
  const maxBucket = Math.max(1, ...Object.values(buckets));
  const top = groups.slice(0, 6);
  const maxTop = Math.max(1, ...top.map((g) => g.rows.length));
  const feed = pages.slice(-7).reverse();

  return (
    <div className="overview">
      <section className="card hero-card">
        <ScoreRing score={score} />
        <div className="hero-right">
          <div className="stats">
            <Stat label="Errors" value={totals.error} tone="error" prev={prev?.errors} />
            <Stat label="Warnings" value={totals.warning} tone="warn" prev={prev?.warnings} />
            <Stat label="Notices" value={totals.notice} tone="notice" prev={prev?.notices} />
          </div>
          <dl className="facts">
            <div><dt>Pages crawled</dt><dd>{pages.length.toLocaleString()}</dd></div>
            <div><dt>Average response</dt><dd>{avgMs ? (avgMs / 1000).toFixed(2) + " s" : "n/a"}</dd></div>
            <div><dt>Score change</dt><dd>{prev ? <Delta cur={score} prev={prev.score} goodWhen="up" /> : <span className="muted">First run</span>}</dd></div>
          </dl>
        </div>
      </section>

      {!running && <TrafficImpact traffic={traffic} impact={impact} error={trafficError} noun={noun} onFile={onTrafficFile} onClear={onTrafficClear} onFocusIssue={onFocusIssue} onOpenPage={onOpenPage} />}
      {!running && <Changes changes={changes} onOpenPage={onOpenPage} />}

      <div className="two">
        <section className="card">
          <h3>Fix these first</h3>
          <p className="card-sub">Ranked by severity and how many pages are affected.</p>
          {fixFirst.length === 0 ? (
            <p className="empty-note">{running ? "Looking for problems…" : "No issues found. Nice work."}</p>
          ) : (
            <ol className="fixlist">
              {fixFirst.map((g) => (
                <li key={g.code}>
                  <button type="button" onClick={() => onFocusIssue(g.code)}>
                    <span className={`dot ${g.sev}`} aria-label={SEV_LABEL[g.sev]} />
                    <span className="fx-main">
                      <span className="fx-title">{g.title}</span>
                      <span className="fx-fix">{g.fix}</span>
                    </span>
                    <span className="fx-count">{g.rows.length}<small>{g.rows.length === 1 ? "page" : "pages"}</small></span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card">
          <h3>{running ? "Live crawl" : "Latest pages"}</h3>
          <p className="card-sub">{running ? "Pages appear here as they are checked." : "The last pages that were checked."}</p>
          <ul className="feed">
            {feed.map((p) => (
              <li key={p.key}>
                <button type="button" onClick={() => onOpenPage(p.key)}>
                  <span className={`code ${!p.status ? "error" : p.status < 300 ? "good" : p.status < 400 ? "notice" : "error"}`}>{p.status || "ERR"}</span>
                  <span className="u">{shortUrl(p.url.replace(/^https?:\/\//, ""), 54)}</span>
                  <span className="feed-score">{p.score}</span>
                </button>
              </li>
            ))}
            {feed.length === 0 && <li className="empty-note">Waiting for the first page…</li>}
          </ul>
        </section>
      </div>

      <div className="three">
        <section className="card">
          <h3>Response codes</h3>
          <div className="hbars">
            {STATUS_META.map(([k, label, tone]) => (
              <div className="hbar" key={k}>
                <span className="hb-label">{label}</span>
                <span className="hb-track"><span className={`hb-fill ${tone}`} style={{ width: `${(status[k] / maxStatus) * 100}%` }} /></span>
                <span className="hb-val">{status[k]}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h3>Page health</h3>
          <div className="vbars">
            {[["good", "Good", "80 to 100"], ["fair", "Fair", "50 to 79"], ["poor", "Poor", "0 to 49"]].map(([k, label, range]) => (
              <div className="vbar" key={k}>
                <span className="vb-val">{buckets[k]}</span>
                <span className="vb-track"><span className={`vb-fill ${k}`} style={{ height: `${(buckets[k] / maxBucket) * 100}%` }} /></span>
                <span className="vb-label">{label}</span>
                <span className="vb-range">{range}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <h3>Most common issues</h3>
          <div className="hbars wide">
            {top.map((g) => (
              <button type="button" className="hbar as-btn" key={g.code} onClick={() => onFocusIssue(g.code)}>
                <span className="hb-label">{g.title}</span>
                <span className="hb-track"><span className={`hb-fill ${g.sev}`} style={{ width: `${(g.rows.length / maxTop) * 100}%` }} /></span>
                <span className="hb-val">{g.rows.length}</span>
              </button>
            ))}
            {top.length === 0 && <p className="empty-note">Nothing to show yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
