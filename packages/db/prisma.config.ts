import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * The CLI connects straight to Postgres (DIRECT_URL), not through Supabase's
 * pooler: migrations take locks and use prepared statements a transaction
 * pooler does not keep. The app itself goes through the pooler (DATABASE_URL,
 * see src/index.ts). Both come from `.env`, never from the repository.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DIRECT_URL") },
});
