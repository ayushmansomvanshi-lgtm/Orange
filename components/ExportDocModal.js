"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildErrorReport, reportToDocx, reportToHtml, reportToText } from "../lib/report.js";
import { IconClose, IconDownload, IconExternal } from "./Icons.js";

async function copyRich(html, text) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      })]);
      return true;
    }
  } catch {}
  // Older browsers: copy a hidden, selected copy of the report
  const div = document.createElement("div");
  div.contentEditable = "true";
  div.innerHTML = html;
  div.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(div);
  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  sel.removeAllRanges();
  div.remove();
  return ok;
}

export default function ExportDocModal({ pages, host, noun, onClose }) {
  const [warnings, setWarnings] = useState(false);
  const [layout, setLayout] = useState("post"); // "post" = one row per post, "problem" = grouped by problem
  const [status, setStatus] = useState(null); // { tone, text }
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef(null);

  const report = useMemo(() => buildErrorReport(pages, { host, includeWarnings: warnings, noun }), [pages, host, warnings, noun]);
  const html = useMemo(() => reportToHtml(report, layout), [report, layout]);
  const empty = report.posts.length === 0;
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);
  const paste = isMac ? "Cmd+V" : "Ctrl+V";

  useEffect(() => {
    dialogRef.current && dialogRef.current.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => { window.removeEventListener("keydown", onKey); document.body.classList.remove("no-scroll"); };
  }, [onClose]);

  async function copyAndOpen() {
    // Open the tab and start the copy right away, while the click still counts as a user action
    const tab = window.open("", "_blank");
    setBusy(true);
    const ok = await copyRich(html, reportToText(report, layout));
    setBusy(false);
    if (ok) {
      if (tab) tab.location.href = "https://docs.new";
      setStatus({ tone: "good", text: tab ? `Copied. In the new Google Doc, press ${paste} to paste the report.` : `Copied. Open docs.new and press ${paste} to paste the report.` });
    } else {
      if (tab) tab.close();
      setStatus({ tone: "error", text: "The browser blocked copying. Use the Word file option instead." });
    }
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await reportToDocx(report, layout);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${warnings ? "errors-and-warnings" : "errors"}-${host.replace(/[^a-z0-9.-]/gi, "_")}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      setStatus({ tone: "good", text: "Downloaded. Drag the file into Google Drive, then right-click it and choose Open with, Google Docs." });
    } catch (e) {
      setStatus({ tone: "error", text: "Could not build the file: " + (e.message || e) });
    }
    setBusy(false);
  }

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <button className="drawer-scrim" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className="modal" ref={dialogRef} tabIndex={-1}>
        <header className="modal-head">
          <div>
            <h2 id="export-title">Export to Google Docs</h2>
            <p className="muted">A report that lists only the {noun} with {warnings ? "errors or warnings" : "errors"}, and the problems found on each.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>

        <div className="modal-stats">
          <div><b>{report.posts.length}</b><span>{noun} {warnings ? "to fix" : "with errors"}</span></div>
          <div><b>{report.total}</b><span>{report.total === 1 ? "issue" : "issues"} in total</span></div>
          <div><b>{report.types.length}</b><span>{report.types.length === 1 ? "type" : "types"} of problem</span></div>
        </div>

        <div className="modal-opts">
          <span className="scope" role="group" aria-label="Report layout">
            <button type="button" className={layout === "post" ? "on" : ""} aria-pressed={layout === "post"} onClick={() => { setLayout("post"); setStatus(null); }}>One row per {noun.replace(/s$/, "")}</button>
            <button type="button" className={layout === "problem" ? "on" : ""} aria-pressed={layout === "problem"} onClick={() => { setLayout("problem"); setStatus(null); }}>Grouped by problem</button>
          </span>
          <label className="check">
            <input type="checkbox" checked={warnings} onChange={(e) => { setWarnings(e.target.checked); setStatus(null); }} />
            <span>Also include warnings</span>
          </label>
        </div>

        <div className="doc-preview" aria-label="Report preview" dangerouslySetInnerHTML={{ __html: html }} />

        {status && <p className={`alert ${status.tone === "good" ? "okay" : "error"}`} role="status">{status.text}</p>}

        <div className="modal-actions">
          <button className="btn primary" onClick={copyAndOpen} disabled={empty || busy}>
            <IconExternal /> Copy and open Google Docs
          </button>
          <button className="btn" onClick={download} disabled={empty || busy}>
            <IconDownload /> Download Word file
          </button>
        </div>
        <p className="muted small-note">The copy option keeps headings, links, the table, and bullets. Google opens a blank document, and you paste with {paste}.</p>
      </div>
    </div>
  );
}
