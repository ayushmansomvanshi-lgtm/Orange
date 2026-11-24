import * as cheerio from "cheerio";
import { hostKey, isInternal, keyOf, cleanUrl, SKIP_EXT } from "./url.js";

const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

/** Draft a meta description from the opening paragraph(s) of a post. */
function buildSuggestion(paras) {
  let text = paras[0] || "";
  if (text.length < 110 && paras[1]) text += " " + paras[1];
  text = clean(text);
  if (text.length <= 155) return text;
  const cut = text.slice(0, 155);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end >= 90) return cut.slice(0, end + 1);
  const sp = cut.lastIndexOf(" ");
  return cut.slice(0, sp > 100 ? sp : 155).replace(/[,;:\-–—\s]+$/, "") + "…";
}

/** Pull everything we need out of an HTML document. */
export function extract(html, pageUrl) {
  const $ = cheerio.load(html);
  const host = hostKey(pageUrl);
  const abs = (h) => { try { return new URL(h, pageUrl).href; } catch { return null; } };
  const meta = (n) => { const el = $(`meta[name="${n}" i]`).first(); return el.length ? clean(el.attr("content")) : null; };
  const prop = (p) => { const el = $(`meta[property="${p}"]`).first(); return el.length ? clean(el.attr("content")) : null; };

  const canonHref = $('link[rel~="canonical" i]').first().attr("href");
  const outline = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    if (outline.length < 80) outline.push({ l: Number(el.tagName[1]), t: clean($(el).text()).slice(0, 120) });
  });

  const schema = new Set();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const walk = (n) => {
        if (!n || typeof n !== "object") return;
        if (Array.isArray(n)) return n.forEach(walk);
        if (n["@type"]) [].concat(n["@type"]).forEach((t) => schema.add(String(t)));
        if (n["@graph"]) walk(n["@graph"]);
      };
      walk(JSON.parse($(el).contents().text()));
    } catch { schema.add("(invalid JSON)"); }
  });

  let imgTotal = 0, imgNoAlt = 0;
  const noAltSamples = [];
  $("img").each((_, el) => {
    imgTotal++;
    if ($(el).attr("alt") === undefined) {
      imgNoAlt++;
      if (noAltSamples.length < 3) noAltSamples.push($(el).attr("src") || "");
    }
  });

  const internal = [], external = [], seenI = new Set(), seenE = new Set();
  let emptyAnchors = 0;
  $("a[href]").each((_, el) => {
    const a = $(el);
    const href = (a.attr("href") || "").trim();
    if (!clean(a.text()) && !a.attr("aria-label") && !a.attr("title") && !a.find("img[alt]:not([alt=''])").length) emptyAnchors++;
    if (!href || /^(#|mailto:|tel:|javascript:|data:|sms:)/i.test(href)) return;
    const u = abs(href);
    if (!u || !/^https?:/i.test(u)) return;
    if (isInternal(u, host)) {
      if (SKIP_EXT.test(new URL(u).pathname)) return;
      const c = cleanUrl(u);
      const k = keyOf(c);
      if (!seenI.has(k) && internal.length < 300) { seenI.add(k); internal.push(c); }
    } else {
      const c = cleanUrl(u);
      if (!seenE.has(c) && external.length < 100) { seenE.add(c); external.push(c); }
    }
  });

  const root = $("main").first().length ? $("main").first() : $("article").first().length ? $("article").first() : $("body");
  const c = root.clone();
  c.find("script,style,noscript,template,nav,footer,aside,form,svg").remove();
  const text = clean(c.text());
  const words = text ? text.split(" ").length : 0;
  const paraList = c.find("p").map((_, el) => clean($(el).text())).get();
  const paras = paraList.join(" ");
  const sentences = paras.split(/[.!?]+\s/).filter((s) => s.trim().split(/\s+/).length > 2);
  const avgSentence = sentences.length > 3 ? sentences.reduce((n, s) => n + s.trim().split(/\s+/).length, 0) / sentences.length : 0;

  const suggestion = words >= 40
    ? buildSuggestion(paraList.filter((t) => t.split(" ").length >= 8 && !/^(share|posted|published|updated|by |read more|tags?:|categories?:)/i.test(t)))
    : "";

  const mixed = pageUrl.startsWith("https:")
    ? $('img[src^="http://"],script[src^="http://"],link[rel="stylesheet"][href^="http://"],iframe[src^="http://"],source[src^="http://"]').length
    : 0;

  // Is this a blog post, or an archive, author page, or ordinary page?
  const pageTitle = clean($("title").first().text());
  const bodyClass = ($("body").attr("class") || "").toLowerCase();
  const schemaText = Array.from(schema).join(" ").toLowerCase();
  const published = prop("article:published_time") || $('meta[itemprop="datePublished"]').attr("content");
  const ogType = (prop("og:type") || "").toLowerCase();
  let path = "/";
  try { path = new URL(pageUrl).pathname; } catch {}
  const strongPost = /\bsingle-post\b/.test(bodyClass) || (/\bsingle\b/.test(bodyClass) && /\bpostid-\d+\b/.test(bodyClass)) || /\b(article|blogposting|newsarticle)\b/.test(schemaText) || !!published;
  let kind = "unknown";
  if (/\bpage-id-\d+\b|\bpage-template/.test(bodyClass)) kind = "other";
  else if (/\b(archive|author|category|tag|search|error404|home)\b/.test(bodyClass) || /\bArchives?\b/.test(pageTitle) || /, Author at /i.test(pageTitle) || /^(Category|Tag):/i.test(pageTitle) || /\b(collectionpage|profilepage|searchresultspage)\b/.test(schemaText)) kind = "other";
  else if (strongPost) kind = "post";
  else if (/^\/\d{4}(\/\d{1,2}){0,2}\/?$/.test(path)) kind = "other"; // date archives such as /2026/07/17/
  else if (ogType === "article" || /^\/\d{4}\/\d{1,2}(\/\d{1,2})?\/[^/]+\/?$/.test(path)) kind = "post";

  return {
    kind,
    title: clean($("title").first().text()),
    description: meta("description"),
    robots: meta("robots"),
    viewport: meta("viewport"),
    canonical: canonHref ? abs(canonHref) : null,
    lang: ($("html").attr("lang") || "").trim(),
    outline,
    h1Count: outline.filter((o) => o.l === 1).length,
    og: { title: prop("og:title"), image: prop("og:image") },
    schema: Array.from(schema),
    images: { total: imgTotal, noAlt: imgNoAlt, noAltSamples },
    internal,
    external,
    emptyAnchors,
    words,
    suggestion,
    avgSentence: Math.round(avgSentence * 10) / 10,
    mixed,
  };
}

/** Turn raw page facts into a list of issues. */
export function pageIssues(rec) {
  const issues = [];
  const add = (code, detail = "") => issues.push({ code, detail });
  if (rec.error) { add("load-failed", rec.error); return issues; }
  if (rec.status >= 400) { add("http-error", `HTTP ${rec.status}`); return issues; }
  if (rec.chain.length >= 2) add("redirect-chain", rec.chain.map((c) => c.url).concat(rec.finalUrl).join(" → "));
  else if (rec.chain.length === 1) add("redirect", `${rec.chain[0].status}: ${rec.chain[0].url} → ${rec.finalUrl}`);
  const d = rec.data;
  if (!d) return issues;

  if (rec.finalUrl.startsWith("http://")) add("not-https");
  if (d.mixed) add("mixed-content", `${d.mixed} resources`);

  const t = d.title, desc = d.description || "";
  if (!t) add("title-missing"); else if (t.length < 30) add("title-short", `${t.length} characters`); else if (t.length > 60) add("title-long", `${t.length} characters`);
  if (!desc) add("desc-missing"); else if (desc.length < 70) add("desc-short", `${desc.length} characters`); else if (desc.length > 160) add("desc-long", `${desc.length} characters`);

  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (desc && t && norm(desc) === norm(t)) add("desc-same-title");

  if (d.h1Count === 0) add("h1-missing"); else if (d.h1Count > 1) add("h1-multiple", `${d.h1Count} H1 tags`);
  let prev = 0;
  for (const o of d.outline) {
    if (prev && o.l > prev + 1) { add("heading-skip", `H${prev} followed by H${o.l}`); break; }
    prev = o.l;
  }
  if (!d.viewport) add("viewport-missing");
  if (!d.lang) add("lang-missing");
  if (/noindex/i.test(d.robots || "") || /noindex/i.test(rec.headers["x-robots-tag"] || "")) add("noindex");
  if (!d.canonical) add("canonical-missing");
  else if (keyOf(d.canonical) !== keyOf(rec.finalUrl)) add("canonical-other", d.canonical);
  if (!d.og.title || !d.og.image) add("og-missing", "Missing " + [!d.og.title && "og:title", !d.og.image && "og:image"].filter(Boolean).join(", "));
  if (!d.schema.length) add("schema-missing");
  if (d.words < 300) add("thin-content", `${d.words} words`);
  if (d.words >= 200 && d.avgSentence > 22) add("hard-read", `Average ${Math.round(d.avgSentence)} words per sentence`);
  if (d.images.noAlt) add("img-alt", `${d.images.noAlt} of ${d.images.total} images`);
  if (d.emptyAnchors) add("empty-anchor", `${d.emptyAnchors} links`);

  if (rec.ttfb > 800) add("slow-ttfb", `${Math.round(rec.ttfb)} ms`);
  if (!rec.rendered && rec.total > 2500) add("slow-response", `${(rec.total / 1000).toFixed(1)} s`);
  if (rec.rendered && rec.total > 3000) add("slow-load", `${(rec.total / 1000).toFixed(1)} s`);
  if (rec.bytes > 500 * 1024) add("big-html", `${Math.round(rec.bytes / 1024)} KB`);
  if (!rec.rendered && rec.bytes > 10 * 1024 && !rec.headers["content-encoding"]) add("no-compression", `${Math.round(rec.bytes / 1024)} KB sent uncompressed`);
  if (rec.jsErrors && rec.jsErrors.length) add("js-errors", `${rec.jsErrors.length} errors, e.g. ${rec.jsErrors[0].slice(0, 110)}`);
  if (rec.badResources && rec.badResources.length) add("resource-errors", `${rec.badResources.length} failed, e.g. ${rec.badResources[0].slice(0, 110)}`);

  try {
    const u = new URL(rec.url);
    if (rec.url.length > 115 || /[A-Z_]/.test(u.pathname) || (u.search.match(/&/g) || []).length >= 2) add("url-structure", rec.url.length > 115 ? `${rec.url.length} characters` : "Capitals, underscores, or many parameters");
  } catch {}
  return issues;
}
