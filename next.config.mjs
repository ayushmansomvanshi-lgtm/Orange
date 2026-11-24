import path from "node:path";
import { fileURLToPath } from "node:url";

// Always treat THIS folder as the project root, even if other package-lock.json files exist in parent folders
const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: root,
  turbopack: { root },
  // Keep these as plain Node modules on the server (not bundled)
  serverExternalPackages: ["playwright", "cheerio"],
};
export default nextConfig;
