import { ISSUES, SEV_RANK } from "./issues.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const num = (n) => Number(n).toLocaleString("en-US");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (n, of) => { if (!of) return "0%"; const v = (n / of) * 100; return (v < 10 && v > 0 ? v.toFixed(1) : Math.round(v)) + "%"; };
const one = (noun) => noun.replace(/s$/, "");
const pathLabel = (url) => { try { const u = new URL(url); const p = (u.pathname || "/") + u.search; return p.length > 90 ? p.slice(0, 89) + "…" : p; } catch { return url; } };

// Colours (Orange brand)
const C = { brand: "FF6A13", brandDark: "E55400", soft: "FFEADB", ink: "24150C", muted: "6B5B4E", faint: "9A8A7C", line: "E4D5C7", error: "D92D20", warn: "B07300", link: "1155CC" };
const SEV_COLOR = { error: C.error, warning: C.warn, notice: C.muted };

/**
 * Collects only the pages that have errors (and optionally warnings).
 * `pages` are the analyzed pages from analyzePages().
 */
export function buildErrorReport(pages, { host, includeWarnings = false, noun = "posts" } = {}) {
  const want = new Set(includeWarnings ? ["error", "warning"] : ["error"]);
  const rows = [];
  const types = new Map();
  const groups = new Map();
  let total = 0;
  for (const p of pages) {
    const title = (p.data && p.data.title) || "";
    const issues = p.all
      .filter((i) => want.has(ISSUES[i.code].sev))
      .sort((a, b) => SEV_RANK[ISSUES[a.code].sev] - SEV_RANK[ISSUES[b.code].sev])
      .map((i) => ({ code: i.code, sev: ISSUES[i.code].sev, title: ISSUES[i.code].title, detail: i.detail, fix: ISSUES[i.code].fix }));
    if (!issues.length) continue;
    rows.push({ url: p.url, title, status: p.status, issues });
    total += issues.length;
    issues.forEach((i) => {
      const g = groups.get(i.code) || { code: i.code, title: i.title, sev: i.sev, posts: [] };
      g.posts.push({ url: p.url, title, detail: i.detail });
      groups.set(i.code, g);
    });
  }
  rows.sort((a, b) => b.issues.length - a.issues.length || a.url.localeCompare(b.url));
  const byProblem = Array.from(groups.values()).sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || b.posts.length - a.posts.length);
  return {
    host, noun, includeWarnings, date: new Date(), audited: pages.length, total,
    title: includeWarnings ? "Errors and warnings report" : "Errors report",
    posts: rows,
    types: byProblem.map((g) => ({ code: g.code, title: g.title, sev: g.sev, posts: g.posts.length })),
    groups: byProblem,
  };
}

const what = (r) => (r.includeWarnings ? "errors or warnings" : "errors");
const statCells = (r) => [
  [num(r.audited), `${cap(r.noun)} audited`],
  [num(r.posts.length), `${cap(r.noun)} with ${what(r)}`],
  [num(r.total), r.total === 1 ? "Problem found" : "Problems found"],
  [num(r.types.length), r.types.length === 1 ? "Type of problem" : "Types of problem"],
];

/* ====================================================================
   HTML for pasting into Google Docs (also used for the preview)
   ==================================================================== */
export function reportToHtml(r, layout = "post") {
  const F = "font-family:Arial,Helvetica,sans-serif;";
  const td = (inner, extra = "") => `<td style="${F}font-size:10pt;line-height:1.45;padding:7px 10px;border:1px solid #${C.line};vertical-align:top;${extra}">${inner}</td>`;
  const th = (t, extra = "") => `<th style="${F}font-size:10pt;padding:8px 10px;border:1px solid #${C.brandDark};background:#${C.brand};color:#${C.ink};text-align:left;${extra}">${t}</th>`;
  const h2 = (t) => `<h2 style="${F}font-size:16pt;font-weight:700;color:#${C.ink};margin:26px 0 4px;">${t}</h2>`;
  const note = (t) => `<p style="${F}font-size:10pt;color:#${C.muted};margin:0 0 10px;">${t}</p>`;
  const postCell = (p) => `<a href="${esc(p.url)}" style="color:#${C.link};font-weight:700;">${esc(p.title || pathLabel(p.url))}</a><br><span style="font-size:9pt;color:#${C.faint};">${esc(pathLabel(p.url))}</span>`;
  const problem = (i) => `<span style="color:#${SEV_COLOR[i.sev]};">■</span>&nbsp;<b>${esc(i.title)}</b>${i.detail ? ` <span style="color:#${C.muted};">${esc(i.detail)}</span>` : ""}`;

  let h = `<h1 style="${F}font-size:28pt;font-weight:700;color:#${C.ink};margin:0;">${esc(r.title)}</h1>`;
  h += `<p style="${F}font-size:12pt;color:#${C.muted};margin:2px 0 16px;">${esc(r.host)}, ${esc(fmtDate(r.date))}</p>`;

  // Four headline numbers
  h += `<table style="border-collapse:collapse;width:100%;"><tr>`;
  statCells(r).forEach(([n, label]) => {
    h += `<td style="${F}width:25%;background:#${C.soft};border:5px solid #FFFFFF;padding:12px 14px;vertical-align:top;"><span style="font-size:24pt;font-weight:700;color:#${C.brandDark};">${n}</span><br><span style="font-size:9pt;color:#${C.muted};">${esc(label)}</span></td>`;
  });
  h += `</tr></table>`;

  // What needs fixing
  h += h2("What needs fixing");
  h += `<table style="border-collapse:collapse;width:100%;"><tr>${th("Problem", "width:58%;")}${th("Type", "width:14%;")}${th(`${esc(cap(r.noun))} affected`, "width:16%;text-align:right;")}${th("Share", "width:12%;text-align:right;")}</tr>`;
  r.types.forEach((t, i) => {
    const bg = i % 2 ? "background:#FFF8F2;" : "";
    h += `<tr>${td(`<b>${esc(t.title)}</b>`, bg)}${td(`<span style="color:#${SEV_COLOR[t.sev]};font-weight:700;">${t.sev === "error" ? "Error" : "Warning"}</span>`, bg)}${td(num(t.posts), bg + "text-align:right;")}${td(pct(t.posts, r.audited), bg + "text-align:right;")}</tr>`;
  });
  h += `</table>`;

  if (!r.posts.length) {
    h += `<p style="${F}font-size:11pt;margin-top:22px;">No ${esc(r.noun)} have ${what(r)}.</p>`;
  } else if (layout === "problem") {
    // One section per problem, listing the posts it affects
    h += h2(`Fix by problem`);
    h += note("Each section lists every post with that problem, so you can work through one fix at a time.");
    r.groups.forEach((g) => {
      const hasDetail = g.posts.some((p) => p.detail);
      h += `<h3 style="${F}font-size:13pt;font-weight:700;color:#${C.ink};margin:22px 0 2px;">${esc(g.title)}</h3>`;
      h += note(`${num(g.posts.length)} ${g.posts.length === 1 ? one(r.noun) : r.noun}, ${pct(g.posts.length, r.audited)} of those audited`);
      h += `<table style="border-collapse:collapse;width:100%;"><tr>${th("#", "width:6%;text-align:right;")}${th(cap(one(r.noun)), hasDetail ? "width:56%;" : "width:94%;")}${hasDetail ? th("Detail", "width:38%;") : ""}</tr>`;
      g.posts.forEach((p, i) => {
        const bg = i % 2 ? "background:#FFF8F2;" : "";
        h += `<tr>${td(i + 1, bg + `color:#${C.faint};text-align:right;`)}${td(postCell(p), bg)}${hasDetail ? td(esc(p.detail || ""), bg + `color:#${C.muted};`) : ""}</tr>`;
      });
      h += `</table>`;
    });
  } else {
    // One row per post
    h += h2(`${cap(r.noun)} with ${what(r)}`);
    h += note("Most problems first. Click a title to open the post.");
    h += `<table style="border-collapse:collapse;width:100%;"><tr>${th("#", "width:6%;text-align:right;")}${th(cap(one(r.noun)), "width:48%;")}${th("Problems", "width:46%;")}</tr>`;
    r.posts.forEach((p, i) => {
      const bg = i % 2 ? "background:#FFF8F2;" : "";
      h += `<tr>${td(i + 1, bg + `color:#${C.faint};text-align:right;`)}${td(postCell(p), bg)}${td(p.issues.map(problem).join("<br>"), bg)}</tr>`;
    });
    h += `</table>`;
  }
  h += `<p style="${F}font-size:9pt;color:#${C.faint};margin-top:22px;">Created with Orange on ${esc(fmtDate(r.date))}.</p>`;
  return h;
}

export function reportToText(r, layout = "post") {
  let t = `${r.title}: ${r.host}\n${fmtDate(r.date)}\n\n`;
  statCells(r).forEach(([n, label]) => { t += `${label}: ${n}\n`; });
  t += `\nWhat needs fixing\n`;
  r.types.forEach((x) => { t += `- ${x.title} (${x.sev}): ${x.posts} ${r.noun}, ${pct(x.posts, r.audited)}\n`; });
  t += `\n`;
  if (layout === "problem") {
    r.groups.forEach((g) => {
      t += `${g.title} (${g.posts.length})\n`;
      g.posts.forEach((p, i) => { t += `  ${i + 1}. ${p.title || pathLabel(p.url)}\n     ${p.url}${p.detail ? `\n     ${p.detail}` : ""}\n`; });
      t += `\n`;
    });
  } else {
    r.posts.forEach((p, i) => {
      t += `${i + 1}. ${p.title || pathLabel(p.url)}\n   ${p.url}\n`;
      p.issues.forEach((x) => { t += `   - ${x.title}${x.detail ? `: ${x.detail}` : ""}\n`; });
      t += `\n`;
    });
  }
  return t;
}

/* ====================================================================
   Word file (.docx). Upload to Google Drive and open with Google Docs.
   ==================================================================== */
export async function reportToDocx(r, layout = "post") {
  const D = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType, VerticalAlign, LevelFormat } = D;

  const CW = 10040; // usable width in twips (US Letter, 0.76 inch side margins)
  const run = (text, o = {}) => new TextRun({ text: String(text), font: "Arial", size: 20, color: C.ink, ...o });
  const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...o });
  const line = { style: BorderStyle.SINGLE, size: 4, color: C.line };
  const borders = { top: line, bottom: line, left: line, right: line };
  const cell = (children, w, o = {}) => new TableCell({
    children: Array.isArray(children) ? children : [children], width: { size: w, type: WidthType.DXA }, borders,
    margins: { top: 90, bottom: 90, left: 130, right: 130 }, verticalAlign: VerticalAlign.TOP,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined, ...o.extra,
  });
  const head = (text, w, right) => cell(para(run(text, { bold: true }), { alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT }), w, { fill: C.brand });
  const table = (widths, rows) => new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: widths, rows });
  const h2 = (t) => para(run(t, { bold: true, size: 32 }), { heading: HeadingLevel.HEADING_1, spacing: { before: 420, after: 80 } });
  const note = (t) => para(run(t, { color: C.muted, size: 20 }), { spacing: { after: 160 } });
  const postCell = (p, w, fill) => cell([
    para(new ExternalHyperlink({ link: p.url, children: [run(p.title || pathLabel(p.url), { bold: true, color: C.link, underline: {} })] })),
    para(run(pathLabel(p.url), { size: 17, color: C.faint })),
  ], w, { fill });
  const idCell = (i, w, fill) => cell(para(run(i, { color: C.faint, size: 18 }), { alignment: AlignmentType.RIGHT }), w, { fill });

  const kids = [];
  kids.push(para(run(r.title, { bold: true, size: 56 }), { heading: HeadingLevel.TITLE, spacing: { after: 40 } }));
  kids.push(para(run(`${r.host}, ${fmtDate(r.date)}`, { color: C.muted, size: 24 }), { spacing: { after: 280 } }));

  // Four headline numbers, separated by thick white borders
  const gap = { style: BorderStyle.SINGLE, size: 30, color: "FFFFFF" };
  const sw = Math.floor(CW / 4);
  kids.push(table([sw, sw, sw, CW - sw * 3], [new TableRow({
    children: statCells(r).map(([n, label], i) => new TableCell({
      width: { size: i === 3 ? CW - sw * 3 : sw, type: WidthType.DXA },
      borders: { top: gap, bottom: gap, left: gap, right: gap },
      margins: { top: 150, bottom: 150, left: 190, right: 190 },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: C.soft },
      children: [para(run(n, { bold: true, size: 48, color: C.brandDark })), para(run(label, { size: 18, color: C.muted }))],
    })),
  })]));

  kids.push(h2("What needs fixing"));
  const w1 = [5800, 1400, 1700, 1140];
  kids.push(table(w1, [
    new TableRow({ tableHeader: true, children: [head("Problem", w1[0]), head("Type", w1[1]), head(`${cap(r.noun)} affected`, w1[2], true), head("Share", w1[3], true)] }),
    ...r.types.map((t, i) => {
      const fill = i % 2 ? "FFF8F2" : undefined;
      return new TableRow({ children: [
        cell(para(run(t.title, { bold: true })), w1[0], { fill }),
        cell(para(run(t.sev === "error" ? "Error" : "Warning", { bold: true, color: SEV_COLOR[t.sev] })), w1[1], { fill }),
        cell(para(run(num(t.posts)), { alignment: AlignmentType.RIGHT }), w1[2], { fill }),
        cell(para(run(pct(t.posts, r.audited)), { alignment: AlignmentType.RIGHT }), w1[3], { fill }),
      ] });
    }),
  ]));

  if (!r.posts.length) {
    kids.push(para(run(`No ${r.noun} have ${what(r)}.`), { spacing: { before: 300 } }));
  } else if (layout === "problem") {
    kids.push(h2("Fix by problem"));
    kids.push(note("Each section lists every post with that problem, so you can work through one fix at a time."));
    r.groups.forEach((g) => {
      const hasDetail = g.posts.some((p) => p.detail);
      const w = hasDetail ? [620, 5600, 3820] : [620, 9420];
      kids.push(para(run(g.title, { bold: true, size: 26 }), { heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 40 }, keepNext: true }));
      kids.push(para(run(`${num(g.posts.length)} ${g.posts.length === 1 ? one(r.noun) : r.noun}, ${pct(g.posts.length, r.audited)} of those audited`, { color: C.muted }), { spacing: { after: 120 }, keepNext: true }));
      kids.push(table(w, [
        new TableRow({ tableHeader: true, children: [head("#", w[0], true), head(cap(one(r.noun)), w[1]), ...(hasDetail ? [head("Detail", w[2])] : [])] }),
        ...g.posts.map((p, i) => {
          const fill = i % 2 ? "FFF8F2" : undefined;
          return new TableRow({ cantSplit: true, children: [idCell(i + 1, w[0], fill), postCell(p, w[1], fill), ...(hasDetail ? [cell(para(run(p.detail || "", { color: C.muted })), w[2], { fill })] : [])] });
        }),
      ]));
    });
  } else {
    kids.push(h2(`${cap(r.noun)} with ${what(r)}`));
    kids.push(note("Most problems first. Click a title to open the post."));
    const w = [620, 4800, 4620];
    kids.push(table(w, [
      new TableRow({ tableHeader: true, children: [head("#", w[0], true), head(cap(one(r.noun)), w[1]), head("Problems", w[2])] }),
      ...r.posts.map((p, i) => {
        const fill = i % 2 ? "FFF8F2" : undefined;
        return new TableRow({ cantSplit: true, children: [
          idCell(i + 1, w[0], fill),
          postCell(p, w[1], fill),
          cell(p.issues.map((x) => para([run("■ ", { color: SEV_COLOR[x.sev], size: 16 }), run(x.title, { bold: true }), ...(x.detail ? [run(`  ${x.detail}`, { color: C.muted })] : [])], { spacing: { after: 40 } })), w[2], { fill }),
        ] });
      }),
    ]));
  }
  kids.push(para(run(`Created with Orange on ${fmtDate(r.date)}.`, { size: 18, color: C.faint }), { spacing: { before: 400 } }));

  return Packer.toBlob(new Document({
    creator: "Orange", title: `${r.title}: ${r.host}`,
    styles: {
      default: { document: { run: { font: "Arial", size: 20, color: C.ink } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 56, bold: true, color: C.ink }, paragraph: { spacing: { after: 40 } } },
        { id: "Heading1", name: "heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 32, bold: true, color: C.ink }, paragraph: { spacing: { before: 420, after: 80 }, outlineLevel: 0 } },
        { id: "Heading2", name: "heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Arial", size: 26, bold: true, color: C.ink }, paragraph: { spacing: { before: 360, after: 40 }, outlineLevel: 1 } },
      ],
    },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids }],
  }));
}
