"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzePages, summarize } from "../lib/cross.js";
import { downloadCsv, downloadJson } from "../lib/export.js";
import { clearHistory, clearTraffic, loadHistory, loadSnapshot, loadTraffic, saveRun, saveSnapshot, saveTraffic } from "../lib/history.js";
import { computeImpact, parseTrafficCsv } from "../lib/traffic.js";
import { diffRuns, makeSnapshot } from "../lib/diff.js";
import Options from "../components/Options.js";
import Overview from "../components/Overview.js";
import IssuesView from "../components/IssuesView.js";
import PagesView from "../components/PagesView.js";
import MetaView from "../components/MetaView.js";
import ExportDocModal from "../components/ExportDocModal.js";
import PageDrawer from "../components/PageDrawer.js";
import ThemeToggle from "../components/ThemeToggle.js";
import { IconArrow, IconDownload, IconGlobe, IconPrint, IconStop, Logo } from "../components/Icons.js";

// The 3D scene only runs in the browser
const HeroScene = dynamic(() => import("../components/HeroScene.js"), { ssr: false });

const CAT_INFO = [
  ["Indexing", "noindex tags and canonical addresses"],
  ["Content", "titles, descriptions, headings, and thin pages"],
  ["Links", "broken and redirected links, orphan pages"],
  ["Performance", "response time, compression, and page size"],
  ["Technical", "status codes, HTTPS, redirects, JavaScript errors"],
  ["Social", "sharing tags and structured data"],
];

const DEFAULTS = { mode: "site", skipArchives: true, maxPages: 100, concurrency: 4, maxDepth: 0, sitemap: true, render: false, external: false, robots: true, exclude: "" };

export default function Home() {
  const [url, setUrl] = useState("");
  const [opts, setOpts] = useState(DEFAULTS);
  const [status, setStatus] = useState("idle"); // idle | running | done
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [target, setTarget] = useState(null);
  const [rawPages, setRawPages] = useState([]);
  const [sitemapKeys, setSitemapKeys] = useState([]);
  const [external, setExternal] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tab, setTab] = useState("overview");
  const [focus, setFocus] = useState(null);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [prev, setPrev] = useState(null);
  const [prevSnap, setPrevSnap] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [edits, setEdits] = useState({});
  const [docOpen, setDocOpen] = useState(false);
  const [scope, setScope] = useState(null); // "posts" | "all" | null (posts is the default)
  const [skipped, setSkipped] = useState(0);
  const [traffic, setTraffic] = useState(null);
  const [trafficError, setTrafficError] = useState("");

  const acRef = useRef(null);
  const bufRef = useRef([]);
  const savedRef = useRef(0);
  const countRef = useRef(0);

  useEffect(() => {
    setHistory(loadHistory());
    try { const s = localStorage.getItem("sitelens-scope"); if (s === "posts" || s === "all") setScope(s); } catch {}
  }, []);
  const chooseScope = (v) => { setScope(v); try { localStorage.setItem("sitelens-scope", v); } catch {} };

  // Batch incoming pages so a fast crawl does not re-render the dashboard for every page
  useEffect(() => {
    if (status !== "running") return;
    let id;
    const tick = () => {
      if (bufRef.current.length) {
        const batch = bufRef.current;
        bufRef.current = [];
        countRef.current += batch.length;
        setRawPages((p) => p.concat(batch));
      }
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
      id = setTimeout(tick, countRef.current > 600 ? 1000 : 300); // update less often on big crawls
    };
    id = setTimeout(tick, 300);
    return () => clearTimeout(id);
  }, [status, startedAt]);

  const postsMode = (target?.mode || opts.mode) === "posts";
  // "Posts only" ignores archives, author pages and ordinary pages in every tab, report and export
  const wantPosts = (scope ?? "posts") === "posts";
  const split = useMemo(() => {
    const found = rawPages.some((p) => p.data && p.data.kind === "post");
    const posts = rawPages.filter((p) => (p.data ? p.data.kind === "post" : postsMode)); // pages that failed to load only count in posts mode
    const base = { posts: posts.length, total: rawPages.length, found };
    if (!wantPosts) return { ...base, list: rawPages, unsure: false };
    if (!found) return { ...base, list: rawPages, unsure: rawPages.some((p) => p.data) };
    return { ...base, list: posts, unsure: false };
  }, [rawPages, postsMode, wantPosts]);
  const pages = useMemo(() => analyzePages(split.list, { sitemapKeys, external }), [split.list, sitemapKeys, external]);
  const summary = useMemo(() => summarize(pages), [pages]);
  const impact = useMemo(() => (traffic && pages.length ? computeImpact(pages, traffic) : null), [traffic, pages]);
  const changes = useMemo(() => (status === "done" && prevSnap ? diffRuns(prevSnap, pages) : null), [status, prevSnap, pages]);
  const selectedPage = useMemo(() => pages.find((p) => p.key === selected || p.url === selected) || null, [pages, selected]);
  const issueTotal = summary.totals.error + summary.totals.warning + summary.totals.notice;

  // Save a summary of each finished audit so the next run can show what changed
  useEffect(() => {
    if (status !== "done" || !pages.length || !target || savedRef.current === startedAt) return;
    savedRef.current = startedAt;
    saveSnapshot(`${target.host}|${target.mode}`, makeSnapshot(pages));
    saveRun({ host: target.host, url: target.url, date: Date.now(), score: summary.score, errors: summary.totals.error, warnings: summary.totals.warning, notices: summary.totals.notice, pages: pages.length });
    setHistory(loadHistory());
  }, [status, pages, summary, target, startedAt]);

  const handle = useCallback((ev) => {
    switch (ev.type) {
      case "phase": setPhase(ev.text); break;
      case "warning": setWarning(ev.text); break;
      case "start":
        setTarget({ url: ev.start, host: ev.host, mode: ev.mode, source: ev.source });
        setPrev(loadHistory().find((h) => h.host === ev.host) || null);
        setPrevSnap(loadSnapshot(`${ev.host}|${ev.mode}`));
        setTraffic(loadTraffic(ev.host)); setTrafficError("");
        break;
      case "sitemap": setSitemapKeys(ev.keys); break;
      case "page": bufRef.current.push(ev.page); setProgress({ done: ev.done, total: ev.total }); break;
      case "external": setExternal(ev.broken); break;
      case "error": setError(ev.message); break;
      case "done": setPhase(ev.aborted ? "Stopped" : "Finished"); setSkipped(ev.skipped || 0); break;
    }
  }, []);

  async function run(e, forcedUrl) {
    if (e) e.preventDefault();
    const raw = (forcedUrl ?? url).trim();
    if (!raw) { setError("Enter a website address, for example https://example.com"); return; }
    if (forcedUrl) setUrl(forcedUrl);
    setError(""); setWarning(""); setRawPages([]); setSitemapKeys([]); setExternal([]);
    setSkipped(0); setSelected(null); setTab(opts.mode === "posts" ? "meta" : "overview"); setFocus(null); setTarget(null); setEdits({});
    setProgress({ done: 0, total: 0 }); setElapsed(0);
    bufRef.current = [];
    countRef.current = 0;
    const t0 = Date.now();
    setStartedAt(t0);
    setStatus("running");
    setPhase("Connecting…");
    const ac = new AbortController();
    acRef.current = ac;
    let got = 0;
    try {
      const res = await fetch("/api/crawl", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: raw, ...opts }), signal: ac.signal });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `The server returned ${res.status}`); }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "page") got++;
          handle(ev);
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Something went wrong.");
    } finally {
      if (bufRef.current.length) { const batch = bufRef.current; bufRef.current = []; setRawPages((p) => p.concat(batch)); }
      setStatus(got > 0 ? "done" : "idle");
    }
  }

  function stop() { acRef.current?.abort(); setPhase("Stopped"); }
  function reset() { setStatus("idle"); setRawPages([]); setError(""); setWarning(""); setTarget(null); }
  function uploadTraffic(file, months) {
    const host = target?.host;
    if (!host) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseTrafficCsv(String(reader.result), host);
        const t = { ...parsed, months, name: file.name, date: Date.now() };
        saveTraffic(host, t); setTraffic(t); setTrafficError("");
      } catch (err) { setTrafficError("Could not read that file: " + (err.message || err)); }
    };
    reader.readAsText(file);
  }
  function removeTraffic() { if (target?.host) clearTraffic(target.host); setTraffic(null); setTrafficError(""); }
  const openIssue = (code) => { setFocus(code); setTab("issues"); };
  const openPage = (k) => setSelected(k);
  const running = status === "running";
  const isPosts = postsMode;
  const noun = isPosts || (wantPosts && split.found) ? "posts" : "pages";
  const loaded = pages.filter((p) => p.data).length;
  const tabList = isPosts
    ? [["meta", "Meta descriptions", loaded], ["overview", "Overview", null], ["issues", "Issues", issueTotal], ["pages", "Posts", pages.length]]
    : [["overview", "Overview", null], ["meta", "Meta descriptions", loaded], ["issues", "Issues", issueTotal], ["pages", "Pages", pages.length]];
  const pct = progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <>
      <header className="top">
        <button className="brand" onClick={reset} aria-label="Orange home"><Logo /><span>Orange</span></button>
        <ThemeToggle />
      </header>

      <main className="shell">
        {status === "idle" ? (
          <div className="hero-wrap">
          <HeroScene />
          <section className="hero">
            <h1>Audit every page of your website.</h1>
            <p className="lede">Orange crawls your site the way a search engine does, then shows what is broken and what to fix first. Add your address to begin.</p>
            <div className="modes" role="radiogroup" aria-label="What to audit">
              {[["site", "Full site audit", "Crawl every page and check 40 issues."], ["posts", "Post meta descriptions", "Find only your blog posts and check their descriptions."]].map(([k, name, text]) => (
                <button key={k} type="button" role="radio" aria-checked={opts.mode === k} className={`mode ${opts.mode === k ? "on" : ""}`} onClick={() => setOpts((o) => ({ ...o, mode: k }))}>
                  <span className="mode-dot" aria-hidden="true" />
                  <span><b>{name}</b><small>{text}</small></span>
                </button>
              ))}
            </div>
            <form className="cmd" onSubmit={run}>
              <IconGlobe className="cmd-icon" />
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourwebsite.com" aria-label="Website address" autoComplete="off" spellCheck={false} autoFocus />
              <button className="btn primary" type="submit">{opts.mode === "posts" ? "Fetch posts" : "Run audit"} <IconArrow /></button>
            </form>
            {error && <p className="alert error" role="alert">{error}</p>}
            <Options opts={opts} setOpts={setOpts} disabled={false} />

            {history.length > 0 && (
              <div className="recent">
                <div className="recent-head"><h2>Recent audits</h2><button className="link-btn" onClick={() => { clearHistory(); setHistory([]); }}>Clear</button></div>
                <ul>
                  {history.slice(0, 5).map((h, i) => (
                    <li key={h.date + i}>
                      <button type="button" onClick={() => run(null, h.url)}>
                        <span className={`pill ${h.score >= 80 ? "good" : h.score >= 50 ? "warn" : "error"}`}>{h.score}</span>
                        <span className="rc-main"><b>{h.host}</b><small>{new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, {h.pages} pages</small></span>
                        <span className="rc-counts"><b className="error">{h.errors}</b><b className="warn">{h.warnings}</b><b className="notice">{h.notices}</b></span>
                        <span className="rc-run">Run again</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="cats">
              {CAT_INFO.map(([name, text]) => (<li key={name}><b>{name}</b><span>{text}</span></li>))}
            </ul>
          </section>
          </div>
        ) : (
          <>
            <section className="bar">
              <div className="bar-main">
                <h1 className="site">{target?.host || url}</h1>
                <p className="bar-meta">
                  {running ? <><span className="pulse" aria-hidden="true" />{phase} {progress.done > 0 && `${progress.done} of ${progress.total} pages`}</> : <>{phase || "Finished"}: {pages.length} pages in {elapsed || 0}s</>}
                </p>
                {target && (
                  <p className="bar-tags">
                    <span className="tag">{isPosts ? "Posts only" : "Full site"}</span>
                    {target.source && <span className="tag">Found via {target.source}</span>}
                    {skipped > 0 && <span className="tag">{skipped.toLocaleString("en-US")} archive and author pages skipped</span>}
                    {split.found && (
                      <span className="scope" role="group" aria-label="Which pages to show">
                        <button type="button" className={wantPosts ? "on" : ""} aria-pressed={wantPosts} onClick={() => chooseScope("posts")}>Posts only <b>{split.posts}</b></button>
                        <button type="button" className={!wantPosts ? "on" : ""} aria-pressed={!wantPosts} onClick={() => chooseScope("all")}>All pages <b>{split.total}</b></button>
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="bar-actions">
                {running ? (
                  <button className="btn" onClick={stop}><IconStop /> Stop</button>
                ) : (
                  <>
                    <button className="btn" onClick={() => run(null, target?.url || url)}>Run again</button>
                    <details className="menu">
                      <summary className="btn"><IconDownload /> Export</summary>
                      <div className="menu-list">
                        <button onClick={() => downloadCsv(pages, target?.host || "site", impact)}>Issues as CSV</button>
                        <button onClick={() => downloadJson(pages, summary, target?.host || "site")}>Full report as JSON</button>
                        <button onClick={(e) => { e.currentTarget.closest("details").open = false; setDocOpen(true); }}>Google Doc: only {noun} with errors</button>
                        <button onClick={() => window.print()}><IconPrint /> Print or save as PDF</button>
                      </div>
                    </details>
                  </>
                )}
              </div>
              {running && <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(3, pct)}%` }} /></div>}
            </section>

            {error && <p className="alert error" role="alert">{error}</p>}
            {warning && <p className="alert warn">{warning}</p>}

            <nav className="tabs" role="tablist">
              {tabList.map(([k, label, n]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                  {label}{n != null && <span>{n.toLocaleString()}</span>}
                </button>
              ))}
            </nav>

            <div className="view">
              {tab === "overview" && <Overview summary={summary} pages={pages} running={running} prev={prev} changes={changes} traffic={traffic} impact={impact} trafficError={trafficError} noun={noun} onTrafficFile={uploadTraffic} onTrafficClear={removeTraffic} onFocusIssue={openIssue} onOpenPage={openPage} />}
              {tab === "meta" && <MetaView pages={pages} edits={edits} setEdits={setEdits} running={running} impact={impact} host={target?.host || "site"} unsure={split.unsure && !running} />}
              {tab === "issues" && <IssuesView groups={summary.groups} impact={impact} focus={focus} onOpenPage={openPage} />}
              {tab === "pages" && <PagesView pages={pages} onOpen={openPage} />}
            </div>
          </>
        )}
      </main>
      <PageDrawer page={selectedPage} impact={impact} onClose={() => setSelected(null)} />
      {docOpen && <ExportDocModal pages={pages} host={target?.host || "site"} noun={noun} onClose={() => setDocOpen(false)} />}
    </>
  );
}
