// Optional: render pages in a real browser (Playwright) so JavaScript-built content,
// console errors and failed resources are visible. Needs:  npx playwright install chromium
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const mod = "playwright"; // kept in a variable so the bundler never tries to resolve it
    browserPromise = import(/* webpackIgnore: true */ mod).then((pw) => (pw.chromium || pw.default.chromium).launch({ headless: true }));
  }
  return browserPromise;
}

export async function renderAvailable() {
  try { await getBrowser(); return { ok: true }; }
  catch (e) { browserPromise = null; return { ok: false, error: String(e.message || e).split("\n")[0].slice(0, 140) }; }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try { (await browserPromise).close(); } catch {}
  browserPromise = null;
}

export async function renderPage(url, { timeout, userAgent }) {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent, viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const jsErrors = [], badResources = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) jsErrors.push(m.text()); });
  page.on("pageerror", (e) => jsErrors.push(String(e.message || e)));
  page.on("requestfailed", (r) => { const f = r.failure(); if (f && !/ERR_ABORTED/.test(f.errorText)) badResources.push(`${r.url()} (${f.errorText})`); });
  page.on("response", (r) => { if (r.status() >= 400 && r.request().resourceType() !== "document") badResources.push(`${r.url()} (HTTP ${r.status()})`); });
  try {
    const t0 = Date.now();
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    await page.waitForLoadState("load", { timeout: Math.round(timeout / 2) }).catch(() => {});
    const status = resp ? resp.status() : 0;
    const headers = resp ? resp.headers() : {};
    const contentType = (headers["content-type"] || "").toLowerCase();
    const chain = [];
    let req = resp ? resp.request().redirectedFrom() : null;
    while (req) {
      const r = await req.response().catch(() => null);
      chain.unshift({ url: req.url(), status: r ? r.status() : 301 });
      req = req.redirectedFrom();
    }
    let html = "", ttfb = 0;
    if (/html|xml/.test(contentType) || !contentType) {
      await page.evaluate(() => window.scrollTo(0, document.body ? document.body.scrollHeight : 0)).catch(() => {});
      await page.waitForTimeout(250);
      html = await page.content();
      ttfb = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return n ? n.responseStart : 0; }).catch(() => 0);
    }
    return { status, finalUrl: resp ? resp.url() : url, headers, contentType, html, chain, ttfb, total: Date.now() - t0, bytes: html.length, jsErrors, badResources, rendered: true };
  } finally {
    await context.close().catch(() => {});
  }
}
