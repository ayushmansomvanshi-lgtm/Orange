// Shows how a post will look in Google. Text beyond 160 characters is struck through.
export default function SerpPreview({ url, title, desc }) {
  let host = "", path = "";
  try {
    const u = new URL(url);
    host = u.host.replace(/^www\./, "");
    path = u.pathname.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } }).join(" › ");
  } catch {}
  const t = title && title.length > 60 ? title.slice(0, 58).trimEnd() + "…" : title;
  const kept = desc.slice(0, 160), cut = desc.slice(160);
  return (
    <div className="serp" aria-label="Search result preview">
      <div className="serp-site">
        <span className="serp-fav" aria-hidden="true">{(host[0] || "?").toUpperCase()}</span>
        <span className="serp-url"><b>{host}</b>{path && <small> › {path}</small>}</span>
      </div>
      <div className="serp-title">{t || "(no title)"}</div>
      <div className="serp-desc">
        {desc ? <>{kept}{cut && <span className="cut" title="Google will cut this text off">{cut}</span>}</> : <i>No description. Google will choose text from the page.</i>}
      </div>
    </div>
  );
}
