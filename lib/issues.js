import { DISABLED_CHECKS, SEVERITY } from "./config.js";

// Every check Orange can report. sev: error | warning | notice
const ALL_ISSUES = {
  "load-failed":      { sev: "error",   cat: "Technical",   title: "Page failed to load", fix: "Open the page in a browser. Check the server, DNS, SSL certificate, or timeouts." },
  "http-error":       { sev: "error",   cat: "Technical",   title: "Page returns an HTTP error (4xx or 5xx)", fix: "Fix the page, or redirect the old address to a relevant live page." },
  "broken-link":      { sev: "error",   cat: "Links",       title: "Internal link points to a broken page", fix: "Update the link or redirect the target page." },
  "title-missing":    { sev: "error",   cat: "Content",     title: "Missing title tag", fix: "Add a unique title of 30 to 60 characters with the main keyword near the front." },
  "desc-missing":     { sev: "error",   cat: "Content",     title: "Missing meta description", fix: "Add a meta description of 70 to 160 characters that sells the click." },
  "h1-missing":       { sev: "error",   cat: "Content",     title: "Missing H1 heading", fix: "Add exactly one H1 that states the page topic." },
  "viewport-missing": { sev: "error",   cat: "Technical",   title: "Missing mobile viewport tag", fix: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the head." },
  "broken-external":  { sev: "warning", cat: "Links",       title: "Outbound link points to a broken page", fix: "Update or remove the link." },
  "redirect-chain":   { sev: "warning", cat: "Technical",   title: "Redirect chain (more than one hop)", fix: "Redirect straight to the final address." },
  "not-https":        { sev: "warning", cat: "Technical",   title: "Page is served over HTTP, not HTTPS", fix: "Install an SSL certificate and redirect HTTP to HTTPS." },
  "mixed-content":    { sev: "warning", cat: "Technical",   title: "Insecure (http://) resources on an HTTPS page", fix: "Load those resources over https://." },
  "title-short":      { sev: "warning", cat: "Content",     title: "Title is too short", fix: "Expand to 30 to 60 characters." },
  "title-long":       { sev: "warning", cat: "Content",     title: "Title is too long", fix: "Trim to about 60 characters and put the important words first." },
  "desc-short":       { sev: "warning", cat: "Content",     title: "Meta description is too short", fix: "Expand to 70 to 160 characters." },
  "desc-long":        { sev: "warning", cat: "Content",     title: "Meta description is too long", fix: "Trim to about 160 characters." },
  "desc-same-title":  { sev: "warning", cat: "Content",     title: "Meta description repeats the title", fix: "Write a description that adds new information and a reason to click." },
  "h1-multiple":      { sev: "warning", cat: "Content",     title: "More than one H1 heading", fix: "Keep one H1 and turn the others into H2 or H3." },
  "noindex":          { sev: "warning", cat: "Indexing",    title: "Page is blocked from search (noindex)", fix: "Remove noindex if this page should appear in search results." },
  "lang-missing":     { sev: "warning", cat: "Technical",   title: "Missing language attribute", fix: "Add lang=\"en\" (or your language) to the html tag." },
  "img-alt":          { sev: "warning", cat: "Content",     title: "Images without alt attribute", fix: "Add descriptive alt text, or alt=\"\" for decorative images." },
  "slow-response":    { sev: "warning", cat: "Performance", title: "Slow server response (over 2.5 seconds)", fix: "Improve hosting, add caching or a CDN, and optimize database queries." },
  "slow-load":        { sev: "warning", cat: "Performance", title: "Slow page load (over 3 seconds)", fix: "Compress images, defer scripts, and use caching." },
  "js-errors":        { sev: "warning", cat: "Technical",   title: "JavaScript errors in the console", fix: "Fix the script errors. They can break features and tracking." },
  "resource-errors":  { sev: "warning", cat: "Technical",   title: "Resources failed to load (CSS, JS, images, fonts)", fix: "Fix or remove the failing resource addresses." },
  "dup-title":        { sev: "warning", cat: "Content",     title: "Same title as another page", fix: "Give each page a unique title." },
  "dup-desc":         { sev: "warning", cat: "Content",     title: "Same meta description as another page", fix: "Write a unique description for each page." },
  "slow-ttfb":        { sev: "notice",  cat: "Performance", title: "Slow time to first byte (over 800 ms)", fix: "Improve hosting, caching, or database queries." },
  "no-compression":   { sev: "notice",  cat: "Performance", title: "Page is not compressed", fix: "Enable gzip or Brotli compression on your server." },
  "big-html":         { sev: "notice",  cat: "Performance", title: "Very large HTML (over 500 KB)", fix: "Trim inline scripts, styles, and unused markup." },
  "redirect":         { sev: "notice",  cat: "Technical",   title: "Page redirects to another address", fix: "Link directly to the final address." },
  "link-redirect":    { sev: "notice",  cat: "Links",       title: "Internal link goes through a redirect", fix: "Update the link to the final address." },
  "empty-anchor":     { sev: "notice",  cat: "Links",       title: "Links with no text", fix: "Add visible text or an aria-label to each link." },
  "orphan":           { sev: "notice",  cat: "Links",       title: "In sitemap but no internal links point to it", fix: "Link to this page from related pages." },
  "canonical-missing":{ sev: "notice",  cat: "Indexing",    title: "No canonical tag", fix: "Add a canonical link pointing to the main version of the page." },
  "canonical-other":  { sev: "notice",  cat: "Indexing",    title: "Canonical points to a different address", fix: "Check this is intended. This page may not be indexed itself." },
  "heading-skip":     { sev: "notice",  cat: "Content",     title: "Heading levels are skipped", fix: "Keep heading levels in order (H2, then H3, and so on)." },
  "thin-content":     { sev: "notice",  cat: "Content",     title: "Thin content (under 300 words)", fix: "Add useful detail if the page should rank." },
  "hard-read":        { sev: "notice",  cat: "Content",     title: "Long sentences make it hard to read", fix: "Split long sentences. Aim for an average under 20 words." },
  "og-missing":       { sev: "notice",  cat: "Social",      title: "Missing social sharing tags", fix: "Add og:title and og:image tags (most SEO plugins do this)." },
  "schema-missing":   { sev: "notice",  cat: "Social",      title: "No structured data (JSON-LD)", fix: "Add schema that matches the page type." },
  "url-structure":    { sev: "notice",  cat: "Technical",   title: "URL is long or messy", fix: "Use short, lowercase, hyphenated addresses." },
};

// The catalogue with your settings from config.js applied: `sev` may be overridden and `off` marks disabled checks
export const ISSUES = Object.fromEntries(
  Object.entries(ALL_ISSUES).map(([code, d]) => [code, { ...d, sev: SEVERITY[code] || d.sev, off: DISABLED_CHECKS.includes(code) }])
);

export const SEV_RANK = { error: 0, warning: 1, notice: 2 };
export const SEV_LABEL = { error: "Error", warning: "Warning", notice: "Notice" };
export const CATEGORIES = ["Indexing", "Content", "Links", "Performance", "Technical", "Social"];
