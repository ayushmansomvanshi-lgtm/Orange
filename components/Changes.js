"use client";
import { ISSUES, SEV_LABEL } from "../lib/issues.js";

function Rows({ items, onOpenPage, limit = 15 }) {
  return (
    <ul className="ch-rows">
      {items.slice(0, limit).map((r, i) => {
        const d = ISSUES[r.code];
        return (
          <li key={r.page.key + r.id + i}>
            <button type="button" onClick={() => onOpenPage(r.page.key)}>
              <span className={`badge ${d.sev}`}>{SEV_LABEL[d.sev]}</span>
              <span className="ch-main">
                <span className="ch-title">{d.title}</span>
                <span className="u">{r.page.url}</span>
                {r.detail && <span className="detail">{r.detail}</span>}
              </span>
            </button>
          </li>
        );
      })}
      {items.length > limit && <li className="ch-more">and {items.length - limit} more. Export the report to see them all.</li>}
    </ul>
  );
}

/** Shows what was fixed and what is new since the last audit of this site. */
export default function Changes({ changes, onOpenPage }) {
  if (!changes) {
    return (
      <section className="card changes">
        <h3>Since your last audit</h3>
        <p className="empty-note">This is the first audit of this site. Fix some problems, run the audit again, and this card will show what you fixed and what is new.</p>
      </section>
    );
  }
  const { fixed, added, open, fresh, gone, date } = changes;
  const when = new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const verdict = fixed.length && !added.length ? `Nice work. ${fixed.length} ${fixed.length === 1 ? "problem" : "problems"} fixed and nothing new.`
    : fixed.length && added.length ? `${fixed.length} fixed, but ${added.length} new ${added.length === 1 ? "problem" : "problems"} appeared.`
    : added.length ? `${added.length} new ${added.length === 1 ? "problem" : "problems"} appeared since last time.`
    : "No changes since your last audit.";

  return (
    <section className="card changes">
      <div className="ch-head">
        <h3>Since your last audit</h3>
        <span className="muted">Compared with {when}</span>
      </div>
      <p className="ch-verdict">{verdict}</p>
      <div className="ch-stats">
        <div className="good"><b>{fixed.length}</b><span>Fixed</span></div>
        <div className="bad"><b>{added.length}</b><span>New</span></div>
        <div><b>{open}</b><span>Still open</span></div>
      </div>
      {added.length > 0 && (
        <details className="ch-list" open>
          <summary>New problems <span className="count">{added.length}</span></summary>
          <Rows items={added} onOpenPage={onOpenPage} />
        </details>
      )}
      {fixed.length > 0 && (
        <details className="ch-list">
          <summary>Fixed <span className="count">{fixed.length}</span></summary>
          <Rows items={fixed} onOpenPage={onOpenPage} />
        </details>
      )}
      {(fresh > 0 || gone > 0) && (
        <p className="ch-note">
          {fresh > 0 && `${fresh} ${fresh === 1 ? "page was" : "pages were"} not in the last audit. `}
          {gone > 0 && `${gone} ${gone === 1 ? "page" : "pages"} from the last audit ${gone === 1 ? "was" : "were"} not found this time. `}
          These are left out of the comparison.
        </p>
      )}
    </section>
  );
}
