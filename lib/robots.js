// Minimal robots.txt parser: groups, Allow/Disallow with * and $, longest match wins.
export function parseRobots(text, agent = "orange") {
  const groups = [];
  const sitemaps = [];
  let cur = null, lastWasAgent = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === "sitemap") { sitemaps.push(value); continue; }
    if (field === "user-agent") {
      if (!lastWasAgent || !cur) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (cur && (field === "allow" || field === "disallow") && value) cur.rules.push({ allow: field === "allow", pattern: value });
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules).map((r) => ({
    allow: r.allow,
    len: r.pattern.length,
    rx: new RegExp("^" + r.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")),
  }));
  return {
    sitemaps,
    isAllowed(path) {
      let best = null;
      for (const r of rules) {
        if (r.rx.test(path) && (!best || r.len > best.len || (r.len === best.len && r.allow))) best = r;
      }
      return best ? best.allow : true;
    },
  };
}
