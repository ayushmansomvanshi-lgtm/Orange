// Meta description status for each page, worst first.
export const STATUS_ORDER = ["missing", "duplicate", "same-title", "short", "long", "good"];

export const META_STATUS = {
  missing:      { label: "Missing",        tone: "error",   hint: "No meta description" },
  duplicate:    { label: "Duplicate",      tone: "warning", hint: "Same description as another post" },
  "same-title": { label: "Repeats title",  tone: "warning", hint: "Description is the same as the title" },
  short:        { label: "Too short",      tone: "warning", hint: "Under 70 characters" },
  long:         { label: "Too long",       tone: "warning", hint: "Over 160 characters, so Google cuts it off" },
  good:         { label: "Good",           tone: "good",    hint: "70 to 160 characters and unique" },
};

export function metaStatus(p) {
  const codes = new Set(p.all.map((i) => i.code));
  if (codes.has("desc-missing")) return "missing";
  if (codes.has("dup-desc")) return "duplicate";
  if (codes.has("desc-same-title")) return "same-title";
  if (codes.has("desc-short")) return "short";
  if (codes.has("desc-long")) return "long";
  return "good";
}

/** One row per page that loaded as HTML. */
export function metaRows(pages) {
  return pages.filter((p) => p.data).map((p) => ({
    page: p,
    key: p.key,
    status: metaStatus(p),
    title: p.data.title || "",
    desc: p.data.description || "",
    suggestion: p.data.suggestion || "",
    detail: (p.all.find((i) => i.code === "dup-desc") || {}).detail || "",
  }));
}

export const startValue = (r, edits) => (edits[r.key] ?? (r.status === "good" ? r.desc : r.suggestion || ""));
