import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // @tread/core and @tread/db ship TypeScript sources, not a build: Next compiles them with the app.
  transpilePackages: ["@tread/core", "@tread/db"],
  // Prisma's driver adapter stays a Node module rather than being bundled.
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  // The workspace root, so tracing and Turbopack look for packages where pnpm hoists them.
  turbopack: { root: path.join(__dirname, "../..") },
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default config;
