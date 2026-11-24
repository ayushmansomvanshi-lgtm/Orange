"use client";
import { useEffect } from "react";
import { ISSUES, SEV_LABEL, SEV_RANK } from "../lib/issues.js";
import { IconClose, IconExternal } from "./Icons.js";
import Meter from "./Meter.js";
import { fmtNum, fmtRange } from "../lib/traffic.js";

function Field({ label, children }) {
  return (<div className="field-row"><dt>{label}</dt><dd>{children}</dd></div>);
}

export default function PageDrawer({ page, impact, onClose }) {
  useEffect(() => {
    if (!page) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("no-scroll"); };
  }, [page, onClose]);

  if (!page) return null;
  const d = page.data;
  const issues = page.all.slice().sort((a, b) => SEV_RANK[ISSUES[a.code].sev] - SEV_RANK[ISSUES[b.code].sev]);
  const tone = page.score >= 80 ? "good" : page.score >= 50 ? "warn" : "error";

  return (
    <div className="drawer-wrap" role="dialog" aria-modal="true" aria-label="Page details">
      <button className="drawer-scrim" onClick={onClose} aria-label="Close details" tabIndex={-1} />
      <aside className="drawer">
        <header className="drawer-head">
          <span className={`pill big ${tone}`}>{page.score}</span>
          <div className="dh-main">
            <h2>{d?.title || "(no title)"}</h2>
            <a className="u link" href={page.url} target="_blank" rel="noreferrer">{page.url}<IconExternal width={13} height={13} /></a>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>

        <section>
          <h3>Issues <span className="count">{issues.length}</span></h3>
          {issues.length === 0 && <p className="empty-note">No issues found on this page.</p>}
          <ul className="d-issues">
            {issues.map((i, n) => {
              const def = ISSUES[i.code];
              return (
                <li key={i.code + n} className={def.sev}>
                  <div className="di-top"><span className={`badge ${def.sev}`}>{SEV_LABEL[def.sev]}</span><b>{def.title}</b></div>
                  {i.detail && <p className="di-detail">{i.detail}</p>}
                  <p className="di-fix">{def.fix}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {impact && impact.per.get(page.key) && (() => {
          const t = impact.per.get(page.key);
          return (
            <section>
              <h3>Search traffic</h3>
              <dl className="dl-fields">
                <Field label="Clicks">{fmtNum(t.perMonth)} a month</Field>
                <Field label="Impressions">{fmtNum(t.imp / impact.months)} a month</Field>
                <Field label="Click rate">{(t.ctr * 100).toFixed(1)}%</Field>
                <Field label="Position">{t.pos ? t.pos.toFixed(1) : "n/a"} on average</Field>
                {t.hasSnippet && t.gainHigh >= 0.5 && <Field label="Possible gain">About {fmtRange(t.gainLow, t.gainHigh)} more clicks a month from a better title and description</Field>}
              </dl>
            </section>
          );
        })()}

        <section>
          <h3>Response</h3>
          <dl className="dl-fields">
            <Field label="Status">{page.status || "Failed"}{page.error ? ` (${page.error})` : ""}</Field>
            {page.chain?.length > 0 && <Field label="Redirects">{page.chain.map((c) => `${c.status} ${c.url}`).join(" → ")} → {page.finalUrl}</Field>}
            <Field label="First byte">{page.ttfb ? `${page.ttfb} ms` : "n/a"}</Field>
            <Field label="Total time">{page.total ? `${(page.total / 1000).toFixed(2)} s` : "n/a"}</Field>
            <Field label="HTML size">{page.bytes ? `${Math.round(page.bytes / 1024)} KB` : "n/a"}</Field>
            <Field label="Links in">{page.inlinks} internal {page.inlinks === 1 ? "page links" : "pages link"} here</Field>
            <Field label="Depth">{page.depth} {page.depth === 1 ? "click" : "clicks"} from the start page</Field>
          </dl>
        </section>

        {d && (
          <>
            <section>
              <h3>On the page</h3>
              <dl className="dl-fields">
                <Field label="Title">
                  <span>{d.title || <i className="muted">Missing</i>}</span>
                  {d.title && <><Meter len={d.title.length} lo={30} hi={60} max={90} /><small>{d.title.length} characters (aim for 30 to 60)</small></>}
                </Field>
                <Field label="Description">
                  <span>{d.description || <i className="muted">Missing</i>}</span>
                  {d.description && <><Meter len={d.description.length} lo={70} hi={160} max={240} /><small>{d.description.length} characters (aim for 70 to 160)</small></>}
                </Field>
                <Field label="Canonical">{d.canonical || <i className="muted">None</i>}</Field>
                <Field label="Language">{d.lang || <i className="muted">Not set</i>}</Field>
                <Field label="Words">{d.words.toLocaleString()}{d.avgSentence ? `, ${d.avgSentence} words per sentence` : ""}</Field>
                <Field label="Images">{d.images.total} total{d.images.noAlt ? `, ${d.images.noAlt} without alt` : ""}</Field>
                <Field label="Links">{d.internal.length} internal, {d.external.length} outbound</Field>
                <Field label="Structured data">{d.schema.length ? d.schema.join(", ") : <i className="muted">None</i>}</Field>
                <Field label="Social">{d.og.title && d.og.image ? "og:title and og:image set" : <i className="muted">Incomplete</i>}</Field>
              </dl>
            </section>

            <section>
              <h3>Headings <span className="count">{d.outline.length}</span></h3>
              <ul className="outline">
                {d.outline.map((o, i) => (
                  <li key={i} style={{ paddingLeft: (o.l - 1) * 16 }}><span className="h-tag">H{o.l}</span>{o.t || <i className="muted">(empty)</i>}</li>
                ))}
                {d.outline.length === 0 && <li className="muted">No headings found.</li>}
              </ul>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}
