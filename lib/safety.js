import dns from "node:dns/promises";
import net from "node:net";

const cache = new Map();

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true;
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

/**
 * Stops the crawler being used to reach private networks (SSRF) when you deploy it.
 * Set ALLOW_PRIVATE_HOSTS=1 to audit localhost or intranet sites.
 */
export async function assertPublic(urlStr) {
  if (process.env.ALLOW_PRIVATE_HOSTS === "1") return;
  const { hostname } = new URL(urlStr);
  const host = hostname.replace(/^\[|\]$/g, "");
  if (cache.has(host)) {
    if (cache.get(host)) return;
    throw new Error(`Blocked: ${host} is a private address`);
  }
  let ok = true;
  if (net.isIP(host)) ok = !isPrivateIp(host);
  else {
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) ok = false;
    else {
      try {
        const addrs = await dns.lookup(host, { all: true });
        ok = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
      } catch {
        ok = true; // let fetch report the DNS failure
      }
    }
  }
  cache.set(host, ok);
  if (!ok) throw new Error(`Blocked: ${host} is a private address. Set ALLOW_PRIVATE_HOSTS=1 to allow it.`);
}
