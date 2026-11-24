# Orange

A website audit tool built with Next.js. Enter a URL and it crawls every page, then shows
what is broken and what to fix first, with a score for each page and for the whole site.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, rebuilds as you edit
```

`npm start` only serves a finished build, so run `npm run build` first (or just use `npm run dev`).

```bash
npm install
npm run dev          # http://localhost:3000
```

Production: `npm run build && npm start`

## Post meta descriptions

Choose **Post meta descriptions** on the home screen to fetch only your blog posts (through the
WordPress API, then your sitemap, then homepage links) and check every description:
missing, too short, too long, duplicated, or repeating the title. Open any post to edit a new
description with a live character counter and a Google-style preview, then export the results
as CSV. Pages that are not posts (archives like "Books Archives", author pages, and ordinary pages like
"Newsletter") are detected and hidden, with a button to show them. Descriptions are auto-drafted from each post's opening text. Edit them before use.

## Export to Google Docs

Export, then **Google Doc: only posts with errors** builds a report that lists just the posts (or pages)
that have errors. The report has four headline numbers, a "What needs fixing" table, and then either one row per post
with its problems, or one section per problem listing the posts it affects. Pick the layout in the dialog. Tick "Also include warnings" to widen it. Two ways to use it:

- **Copy and open Google Docs:** copies the report and opens a blank Google Doc. Paste with Cmd+V or Ctrl+V.
  Headings, links, the summary table, and bullets are kept.
- **Download Word file:** upload it to Google Drive, then right-click and choose Open with, Google Docs.

## Since your last audit

After you fix problems and run the audit again, the Overview shows a card with what you **fixed**, what is
**new**, and what is **still open**. Click any row to see that page. Orange keeps a small record of the last
audit of each site in your browser (nothing is sent anywhere), and only compares pages that appear in both
audits, so a lower page limit never makes problems look fixed.

The home screen magnifying glass uses Three.js (WebGL) as decoration only.

## Skipping archives and authors

By default the crawler does not visit date archives (like /2026/02/10/), category and tag pages, author pages,
page-number pages, or feeds, so your page limit is spent on real posts. It finds posts through your sitemap.
If a site has no sitemap, turn off **Skip archive and author pages** in Crawl settings so those pages can be
followed to reach older posts.

## Traffic impact

On the Overview, **What fixing these could be worth** takes the Search Console file you export (Performance, Search
results, Pages tab, Export) and shows how many clicks sit on the posts with each problem, the biggest wins, and any
traffic going to broken pages. Orange cannot read Google traffic by itself, so you upload the file. It stays in your
browser. The clicks are real numbers from your file. The gains are estimates: each page's click rate is compared with the
typical click rate for its Google position, and a fix is assumed to close 15% to 40% of that gap (see `lib/traffic.js`).
Only title and description problems are estimated, since other problems affect rankings in ways that cannot be put into a number.

## Posts only

In the results header, **Posts only** ignores archives (including date archives like /2026/07/17/), author pages, and
ordinary pages in every tab, report, and export. **All pages** shows everything. Your choice is remembered.

## Choosing which checks to report

Open `lib/config.js` to switch checks off or change how serious they are, then restart `npm run dev`.
Right now these are off: title too long, meta description too long, and the three slow-speed checks.
Heading levels skipped, more than one H1 heading, and duplicate meta descriptions are set to errors. Switched-off checks are not reported, scored, or exported.

## Hosting online

Orange crawls with long requests that stream results, so it needs a host that runs a normal Node server
(Render, Railway, Fly.io, or a VPS). Use `npm run build` as the build command and `npm start` as the start command,
with Node 20.9 or newer. Serverless hosts such as Netlify and Vercel stop requests after 10 to 60 seconds, so crawls
get cut off there. The app has no login, so anyone with the address can use it. Keep it private or add a password.

### Vercel

Set **Framework Preset** to **Next.js** and leave **Output Directory** empty (the included `vercel.json` also sets
the framework). Vercel stops each crawl after `maxDuration` in `app/api/crawl/route.js` (60 seconds by default, so about
100 to 300 pages). Raise it to 300 on Hobby or 800 on Pro for longer audits. For big audits, a normal Node host is better.

## Large sites

The page limit goes up to 5,000. Big audits stream in live, and the lists show a few hundred rows at a time
(with a Show more button) so the dashboard stays fast. A 3,000 page test crawl took about 15 seconds on a
local test site. Real sites are slower because each page has to download, so expect a few minutes.

## What it does

- Crawls on the server, so there are no CORS limits and results stream in live
- Checks 40 issues: titles, descriptions, headings, status codes, redirects, canonicals,
  noindex, broken internal and outbound links, duplicates, orphan pages, speed, compression,
  HTTPS, structured data, and more
- Reads robots.txt and sitemap.xml
- Dashboard with score, "fix these first", charts, filters, and a detail panel for every page
- Remembers past audits in your browser and shows what changed since the last run
- Export as CSV or JSON, or print to PDF. Light and dark themes

## Optional: run JavaScript (Playwright)

Turn on "Run JavaScript" in Crawl settings to render each page in Chromium. This finds
JavaScript errors and failed resources, and sees content that is built in the browser.

```bash
npm install playwright
npx playwright install chromium
```

If it is not installed, Orange falls back to normal fetching and tells you why.

## Auditing localhost or a private network

By default the server refuses private addresses so a deployed copy cannot be used to probe
your network. To audit localhost or an intranet site:

```bash
ALLOW_PRIVATE_HOSTS=1 npm run dev
```

## Deploying

Run it on a Node server (a VPS, Render, Railway, Fly.io, or Docker). Serverless hosts such
as Vercel cut long requests off, so big crawls may stop early, and Chromium will not run there.
Only audit sites you own or have permission to audit.

## Project layout

```
app/page.js              dashboard (client)
app/api/crawl/route.js   streaming crawl endpoint (NDJSON)
lib/crawler.js           crawl engine: queue, robots, sitemap, redirects, outbound links
lib/analyze.js           HTML analysis and page issues (cheerio)
lib/cross.js             site-wide checks: broken links, duplicates, orphans, scoring
lib/issues.js            the issue catalogue: edit titles and fixes here
lib/render.js            optional Playwright rendering
lib/safety.js            blocks private addresses
components/              Overview, IssuesView, PagesView, PageDrawer, ...
```

To add a check, add an entry to `lib/issues.js` and an `add("code")` call in `pageIssues()`
in `lib/analyze.js`.
