import { runCrawl } from "../../../lib/crawler.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const clamp = (n, lo, hi, d) => { n = Number(n); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }

  let url = String(body.url || "").trim();
  if (!url) return Response.json({ error: "Enter a website address." }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { new URL(url); } catch { return Response.json({ error: "That address does not look valid." }, { status: 400 }); }

  const opts = {
    url,
    mode: body.mode === "posts" ? "posts" : "site",
    maxPages: clamp(body.maxPages, 1, 5000, 100),
    concurrency: clamp(body.concurrency, 1, 8, 4),
    maxDepth: clamp(body.maxDepth, 0, 20, 0),
    sitemap: body.sitemap !== false,
    skipArchives: body.skipArchives !== false,
    render: !!body.render,
    external: body.mode !== "posts" && !!body.external,
    robots: body.robots !== false,
    delay: clamp(body.delay, 0, 5000, 0),
    exclude: String(body.exclude || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
  };

  const ac = new AbortController();
  request.signal.addEventListener("abort", () => ac.abort());
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => { if (closed) return; try { controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n")); } catch { closed = true; } };
      try {
        await runCrawl(opts, send, ac.signal);
      } catch (e) {
        send({ type: "error", message: String(e.message || e) });
      } finally {
        if (!closed) { closed = true; try { controller.close(); } catch {} }
      }
    },
    cancel() { closed = true; ac.abort(); },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}
