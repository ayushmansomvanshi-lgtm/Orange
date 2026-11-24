const KEY = "sitelens-history";
export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveRun(run) {
  try {
    const list = loadHistory().filter((r) => !(r.host === run.host && Math.abs(r.date - run.date) < 1000));
    list.unshift(run);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {}
}
export function clearHistory() { try { localStorage.removeItem(KEY); } catch {} }

// One snapshot per site and mode, so the next audit can show what changed. Only the latest 8 are kept.
const SNAP = "sitelens-snap:";
const SNAP_INDEX = "sitelens-snap-index";
export function loadSnapshot(id) {
  try { return JSON.parse(localStorage.getItem(SNAP + id) || "null"); } catch { return null; }
}
export function saveSnapshot(id, snap) {
  try {
    const index = JSON.parse(localStorage.getItem(SNAP_INDEX) || "[]").filter((x) => x !== id);
    index.unshift(id);
    index.slice(8).forEach((old) => localStorage.removeItem(SNAP + old));
    localStorage.setItem(SNAP_INDEX, JSON.stringify(index.slice(0, 8)));
    localStorage.setItem(SNAP + id, JSON.stringify(snap));
  } catch {}
}

// Traffic exported from Search Console, kept per site in this browser only
export function loadTraffic(host) {
  try { return JSON.parse(localStorage.getItem("sitelens-traffic:" + host) || "null"); } catch { return null; }
}
export function saveTraffic(host, t) {
  try { localStorage.setItem("sitelens-traffic:" + host, JSON.stringify(t)); } catch {}
}
export function clearTraffic(host) {
  try { localStorage.removeItem("sitelens-traffic:" + host); } catch {}
}
