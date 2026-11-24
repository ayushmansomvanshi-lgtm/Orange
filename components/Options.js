"use client";

function Toggle({ on, onChange, label, hint, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)} title={hint}>
      <span className="knob" aria-hidden="true" />
      {label}
    </button>
  );
}

export default function Options({ opts, setOpts, disabled }) {
  const posts = opts.mode === "posts";
  const set = (k, v) => setOpts((o) => ({ ...o, [k]: v }));
  return (
    <details className="opts">
      <summary>Crawl settings</summary>
      <div className="opts-body">
        <div className="toggles">
          {!posts && <Toggle on={opts.sitemap} onChange={(v) => set("sitemap", v)} label="Use sitemap" hint="Find pages through sitemap.xml and detect orphan pages" disabled={disabled} />}
          {!posts && <Toggle on={opts.skipArchives} onChange={(v) => set("skipArchives", v)} label="Skip archive and author pages" hint="Do not visit date, category, tag, author, and page-number pages. Needs a sitemap to find every post." disabled={disabled} />}
          <Toggle on={opts.render} onChange={(v) => set("render", v)} label="Run JavaScript" hint="Render pages in Chromium (needs Playwright). Slower, but finds JavaScript errors" disabled={disabled} />
          {!posts && <Toggle on={opts.external} onChange={(v) => set("external", v)} label="Check outbound links" hint="Test links to other websites for 404s" disabled={disabled} />}
          <Toggle on={opts.robots} onChange={(v) => set("robots", v)} label="Obey robots.txt" hint="Skip pages that robots.txt disallows" disabled={disabled} />
        </div>
        {opts.maxPages >= 1000 && <p className="hint-line">Large audits take several minutes and use more memory. Start with a lower limit if you are unsure.</p>}
        <div className="opt-fields">
          <label>{posts ? "Posts" : "Pages"}
            <select value={opts.maxPages} onChange={(e) => set("maxPages", Number(e.target.value))} disabled={disabled}>
              {[25, 50, 100, 250, 500, 1000, 2000, 3000, 5000].map((n) => (<option key={n} value={n}>Up to {n.toLocaleString("en-US")}</option>))}
            </select>
          </label>
          <label>At once
            <select value={opts.concurrency} onChange={(e) => set("concurrency", Number(e.target.value))} disabled={disabled}>
              {[1, 2, 4, 6, 8].map((n) => (<option key={n} value={n}>{n} page{n > 1 ? "s" : ""}</option>))}
            </select>
          </label>
          {!posts && <label>Depth
            <select value={opts.maxDepth} onChange={(e) => set("maxDepth", Number(e.target.value))} disabled={disabled}>
              <option value={0}>Unlimited</option>
              {[1, 2, 3, 5].map((n) => (<option key={n} value={n}>{n} click{n > 1 ? "s" : ""} from start</option>))}
            </select>
          </label>}
          <label className="grow">Skip addresses containing
            <input type="text" value={opts.exclude} onChange={(e) => set("exclude", e.target.value)} placeholder="/tag/, /wp-admin, ?replytocom" disabled={disabled} spellCheck={false} />
          </label>
        </div>
      </div>
    </details>
  );
}
