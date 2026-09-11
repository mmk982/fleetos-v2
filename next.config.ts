import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@sentry/node", "argon2"],
  // Pin Turbopack to the repo root — Windows/agent runs sometimes infer
  // `src/app` as the workspace root and then fail to resolve `next`.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
