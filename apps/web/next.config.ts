import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // @tread/core ships TypeScript sources, not a build: Next compiles it with the app.
  transpilePackages: ["@tread/core"],
  // The workspace root, so tracing and Turbopack look for packages where pnpm hoists them.
  turbopack: { root: path.join(__dirname, "../..") },
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default config;
