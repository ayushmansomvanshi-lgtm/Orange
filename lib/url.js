const TRACKING = /^(utm_|fbclid$|gclid$|msclkid$|mc_)/i;
export const SKIP_EXT =
  /\.(jpe?g|png|gif|webp|svg|avif|ico|pdf|zip|gz|rar|7z|mp4|mov|avi|mp3|wav|css|js|json|xml|rss|woff2?|ttf|eot|docx?|xlsx?|pptx?|csv|txt)$/i;

export const stripWww = (h) => h.toLowerCase().replace(/^www\./, "");

/** Remove the fragment and tracking parameters. Keeps the path as written. */
export function cleanUrl(input) {
  const u = new URL(String(input).trim());
  u.hash = "";
  Array.from(u.searchParams.keys()).forEach((k) => { if (TRACKING.test(k)) u.searchParams.delete(k); });
  return u.href;
}

/** Identity used to decide whether two URLs are the same page. */
export function keyOf(input) {
  try {
    const u = new URL(cleanUrl(input));
    let p = u.pathname;
    if (p !== "/" && p.endsWith("/")) p = p.slice(0, -1);
    return stripWww(u.host) + p + u.search;
  } catch {
    return String(input);
  }
}

export const hostKey = (url) => stripWww(new URL(url).host);
export const isInternal = (url, host) => { try { return hostKey(url) === host; } catch { return false; } };
export const shortUrl = (url, n = 70) => (url.length <= n ? url : url.slice(0, n - 1) + "…");

// Pages that list posts rather than being posts: date archives (/2026/02/10/), categories, tags, authors,
// page numbers, feeds, search and WordPress system paths.
const ARCHIVE_PATH = /^\/\d{4}(\/\d{1,2}){0,2}\/?$|\/(category|categories|tag|tags|author|authors|feed|comments|page\/\d+|search|wp-json|wp-admin|wp-login\.php|wp-content|wp-includes)(\/|$)/i;
const ARCHIVE_QUERY = /(^|&)(s|paged|author|author_name|cat|tag|m|year|monthnum|day|replytocom|attachment_id)=/i;
export function isArchiveUrl(url) {
  try {
    const x = new URL(url);
    return ARCHIVE_PATH.test(x.pathname) || (x.search.length > 1 && ARCHIVE_QUERY.test(x.search.slice(1)));
  } catch { return false; }
}
