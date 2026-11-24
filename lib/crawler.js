import { extract, pageIssues } from "./analyze.js";
import { parseRobots } from "./robots.js";
import { assertPublic } from "./safety.js";
import { renderPage, renderAvailable, closeBrowser } from "./render.js";
import { cleanUrl, keyOf, hostKey, isInternal, isArchiveUrl, SKIP_EXT } from "./url.js";
import { ISSUES } from "./issues.js";

const UA = "Mozilla/5.0 (compatible; Orange/1.0; +site-audit)";
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Read a response body as text, but stop after `max` bytes. */
async function readCapped(res, max) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = "", bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    out += dec.decode(value, { stream: true });
    if (bytes > max) { await reader.cancel().catch(() => {}); break; }
  }
  return { text: out + dec.decode(), bytes };
}

async function fetchPlain(url, timeout) {
  const chain = [];
  let cur = url;
  for (let hop = 0; hop < 10; hop++) {
    await assertPublic(cur);
    const t0 = performance.now();
    const res = await fetch(cur, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeout),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en" },
    });
    const ttfb = performance.now() - t0;
    const loc = res.headers.get("location");
    if (REDIRECTS.has(res.status) && loc) {
      chain.push({ url: cur, status: res.status });
      cur = new URL(loc, cur).href;
      await res.body?.cancel().catch(() => {});
      continue;
    }
    const headers = Object.fromEntries(res.headers);
    const contentType = (headers["content-type"] || "").toLowerCase();
    let html = "", bytes = 0;
    if (res.body && (/html|xml/.test(contentType) || !contentType)) {
      const r = await readCapped(res, 3_000_000);
      html = r.text; bytes = Buffer.byteLength(r.text);
    } else {
      await res.body?.cancel().catch(() => {});
    }
    return { status: res.status, finalUrl: cur, headers, contentType, html, chain, ttfb, total: performance.now() - t0, bytes, rendered: false };
  }
  throw new Error("Too many redirects");
}

async function fetchText(url, timeout = 12000) {
  try {
    await assertPublic(url);
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { "user-agent": UA } });
    if (!res.ok) return null;
    return (await readCapped(res, 5_000_000)).text;
  } catch { return null; }
}

const NOT_POST = /\/(category|categories|tag|tags|author|authors|page|feed|wp-content|wp-json|cart|checkout|my-account|search|shop|product)(\/|$)/i;
const POST_HINT = /\/(blog|posts?|articles?|news|stories|insights|resources)\//i;

function filterPosts(list, host, max) {
  const seen = new Set(), out = [];
  for (const raw of list) {
    let u;
    try { u = new URL(raw); } catch { continue; }
    if (!isInternal(u.href, host) || SKIP_EXT.test(u.pathname) || NOT_POST.test(u.pathname) || isArchiveUrl(u.href) || u.pathname === "/") continue;
    const c = cleanUrl(u.href), k = keyOf(c);
    if (seen.has(k)) continue;
    seen.add(k); out.push(c);
  }
  const hinted = out.filter((u) => POST_HINT.test(u));
  return (hinted.length >= 3 ? hinted : out).slice(0, max);
}

/** Find blog post addresses: WordPress API first, then sitemap, then homepage links. */
async function discoverPosts(origin, host, max, robotsSitemaps, say) {
  say("Looking for a WordPress posts feed…");
  const wp = [];
  for (let page = 1; page <= 60 && wp.length < max; page++) {
    const txt = await fetchText(`${origin}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=link`);
    if (!txt) break;
    let arr = null;
    try { arr = JSON.parse(txt); } catch {}
    if (!Array.isArray(arr) || !arr.length) break;
    arr.forEach((p) => { if (p && p.link) wp.push(p.link); });
    if (arr.length < 100) break;
  }
  const wpUrls = filterPosts(wp, host, max);
  if (wpUrls.length) return { urls: wpUrls, source: "the WordPress API" };

  say("Looking for your sitemap…");
  const seenMaps = new Set();
  const readMap = async (u) => {
    if (seenMaps.has(u) || seenMaps.size > 60) return [];
    seenMaps.add(u);
    const body = await fetchText(u);
    if (!body) return [];
    const locs = [...body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    if (!body.includes("<sitemapindex")) return locs;
    const skip = /page|categor|tag|author|product|attachment|taxonom|user|archive|image|video|local/i;
    const posty = locs.filter((s) => /post|blog|article|news|stor(y|ies)|insight/i.test(s) && !skip.test(s));
    const subs = posty.length ? posty : locs.filter((s) => !skip.test(s));
    let all = [];
    for (const s of subs.slice(0, 40)) { all = all.concat(await readMap(s)); if (all.length >= max * 2) break; }
    return all;
  };
  for (const m of [...robotsSitemaps, origin + "/sitemap_index.xml", origin + "/sitemap.xml", origin + "/wp-sitemap.xml"]) {
    const found = filterPosts(await readMap(m), host, max);
    if (found.length) return { urls: found, source: "your sitemap" };
  }

  say("Reading links on your homepage…");
  const html = await fetchText(origin + "/");
  if (html) {
    const links = extract(html, origin + "/").internal.filter((u) => (new URL(u).pathname.split("/").filter(Boolean).pop() || "").includes("-"));
    const found = filterPosts(links, host, max);
    if (found.length) return { urls: found, source: "links on your homepage" };
  }
  return { urls: [], source: "" };
}

/**
 * Crawl a site and report progress through `emit`. Stops when `signal` aborts.
 * opts: { url, mode ("site" | "posts"), maxPages, concurrency, maxDepth, sitemap, render, external, robots, exclude[], timeout }
 */
export async function runCrawl(opts, emit, signal) {
  const startedAt = Date.now();
  const start = cleanUrl(opts.url);
  const host = hostKey(start);
  await assertPublic(start);
  const exclude = (opts.exclude || []).map((p) => { try { return new RegExp(p, "i"); } catch { return null; } }).filter(Boolean);
  const timeout = opts.timeout || 20000;

  let rendering = false;
  if (opts.render) {
    emit({ type: "phase", text: "Starting browser…" });
    const r = await renderAvailable();
    rendering = r.ok;
    if (!rendering) emit({ type: "warning", text: `JavaScript rendering is unavailable (${r.error}). Pages were fetched without running JavaScript. To enable it, run: npm install playwright && npx playwright install chromium` });
  }

  emit({ type: "phase", text: "Reading robots.txt…" });
  const origin = new URL(start).origin;
  const robotsText = await fetchText(origin + "/robots.txt");
  const robots = robotsText && opts.robots ? parseRobots(robotsText) : null;
  let blocked = 0;
  const skipped = new Set(); // archive, author and date pages we chose not to visit

  const seen = new Set();
  const queue = [];
  const results = [];
  const sitemapKeys = new Set();

  const canCrawl = (url) => {
    let u;
    try { u = new URL(url); } catch { return false; }
    if (!/^https?:$/.test(u.protocol) || !isInternal(url, host) || SKIP_EXT.test(u.pathname)) return false;
    if (exclude.some((rx) => rx.test(url))) return false;
    if (opts.skipArchives && isArchiveUrl(url)) { skipped.add(keyOf(url)); return false; }
    if (robots && !robots.isAllowed(u.pathname + u.search)) { blocked++; return false; }
    return true;
  };
  const enqueue = (url, depth) => {
    let c;
    try { c = cleanUrl(url); } catch { return; }
    const k = keyOf(c);
    if (seen.has(k) || seen.size >= opts.maxPages) return;
    if (opts.maxDepth && depth > opts.maxDepth) return;
    if (!canCrawl(c)) return;
    seen.add(k);
    queue.push({ url: c, depth });
  };

  const posts = opts.mode === "posts";
  if (opts.sitemap && !posts) {
    emit({ type: "phase", text: "Reading sitemap…" });
    const maps = [...(robots ? robots.sitemaps : []), origin + "/sitemap.xml", origin + "/sitemap_index.xml", origin + "/wp-sitemap.xml"];
    const done = new Set();
    const read = async (u, d = 0) => {
      if (done.has(u) || done.size > 80 || d > 2) return;
      done.add(u);
      const body = await fetchText(u);
      if (!body) return;
      const locs = [...body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
      if (body.includes("<sitemapindex")) { for (const s of locs.slice(0, 60)) await read(s, d + 1); return; }
      for (const loc of locs) if (isInternal(loc, host)) { sitemapKeys.add(keyOf(loc)); enqueue(loc, 1); }
    };
    for (const m of maps) { await read(m); if (sitemapKeys.size) break; }
    emit({ type: "sitemap", keys: Array.from(sitemapKeys).slice(0, 5000) });
    if (!sitemapKeys.size && opts.skipArchives) emit({ type: "warning", text: "No sitemap was found. Posts that are only linked from archive pages may be missed. To follow those pages too, turn off \"Skip archive and author pages\" in Crawl settings." });
  }

  let source = "", trusted = false;
  if (posts) {
    const found = await discoverPosts(origin, host, opts.maxPages, robotsText ? parseRobots(robotsText).sitemaps : [], (text) => emit({ type: "phase", text }));
    if (!found.urls.length) {
      emit({ type: "error", message: "No posts were found. The site may not publish a WordPress feed or sitemap. Try the full site audit instead." });
      if (rendering) await closeBrowser();
      return;
    }
    source = found.source;
    trusted = found.source === "the WordPress API"; // that feed only lists real posts
    found.urls.forEach((u) => enqueue(u, 1));
  } else if (!seen.has(keyOf(start))) {
    // The start page always comes first
    seen.add(keyOf(start)); queue.unshift({ url: start, depth: 0 });
  }

  emit({ type: "start", start, host, rendering, mode: posts ? "posts" : "site", source });
  emit({ type: "phase", text: "Crawling…" });

  async function handle({ url, depth }) {
    const rec = { url, key: keyOf(url), depth, status: null, finalUrl: url, chain: [], contentType: "", headers: {}, ttfb: 0, total: 0, bytes: 0, data: null, error: null, rendered: rendering, jsErrors: [], badResources: [] };
    try {
      const r = rendering ? await renderPage(url, { timeout, userAgent: UA }) : await fetchPlain(url, timeout);
      Object.assign(rec, r);
      const isHtml = /html/.test(rec.contentType) || (!rec.contentType && rec.html);
      if (rec.status < 400 && isHtml && rec.html) {
        rec.data = extract(rec.html, rec.finalUrl);
        if (trusted) rec.data.kind = "post";
        if (!posts && isInternal(rec.finalUrl, host)) rec.data.internal.forEach((l) => enqueue(l, depth + 1));
      }
    } catch (e) {
      rec.error = e.name === "TimeoutError" ? "Timed out" : String(e.message || e).split("\n")[0].slice(0, 160);
    }
    delete rec.html;
    rec.issues = pageIssues(rec).filter((i) => !ISSUES[i.code].off);
    // keep what the browser needs, drop bulky fields
    rec.ttfb = Math.round(rec.ttfb); rec.total = Math.round(rec.total);
    rec.headers = { "x-robots-tag": rec.headers["x-robots-tag"], "content-encoding": rec.headers["content-encoding"] };
    if (rec.data) rec.data.external = rec.data.external.slice(0, 100);
    results.push(rec);
    emit({ type: "page", page: { ...rec, data: rec.data ? { ...rec.data, external: [] } : null }, done: results.length, queued: queue.length, total: seen.size });
  }

  let active = 0;
  async function worker() {
    for (;;) {
      if (signal.aborted) return;
      const item = queue.shift();
      if (!item) { if (active === 0) return; await sleep(40); continue; }
      active++;
      try { await handle(item); } finally { active--; }
      if (opts.delay) await sleep(opts.delay);
    }
  }
  await Promise.all(Array.from({ length: opts.concurrency }, worker));
  if (rendering) await closeBrowser();

  if (opts.external && !signal.aborted) {
    const ext = new Map();
    results.forEach((p) => p.data && p.data.external.forEach((u) => { if (!ext.has(u)) ext.set(u, new Set()); ext.get(u).add(p.key); }));
    const list = Array.from(ext.keys()).slice(0, 400);
    let checked = 0;
    emit({ type: "phase", text: `Checking ${list.length} outbound links…` });
    const broken = [];
    const queueE = list.slice();
    const checkOne = async (u) => {
      let status;
      try {
        await assertPublic(u);
        let r = await fetch(u, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "user-agent": UA } });
        status = r.status;
        if (status >= 400) { r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(10000), headers: { "user-agent": UA } }); status = r.status; await r.body?.cancel().catch(() => {}); }
      } catch (e) { status = "failed"; }
      if (status === "failed" || status === 404 || status === 410 || (typeof status === "number" && status >= 500)) broken.push({ url: u, status, pages: Array.from(ext.get(u)) });
      checked++;
    };
    await Promise.all(Array.from({ length: 10 }, async () => { while (queueE.length && !signal.aborted) await checkOne(queueE.shift()); }));
    emit({ type: "external", broken, checked });
  }

  emit({ type: "done", aborted: signal.aborted, seconds: Math.round((Date.now() - startedAt) / 1000), blockedByRobots: blocked, skipped: skipped.size, pages: results.length });
}
