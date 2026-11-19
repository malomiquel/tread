import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * The CLI connects straight to Postgres (DIRECT_URL, Supabase's session
 * pooler), not through the transaction pooler: migrations take locks and use
 * prepared statements a transaction pooler does not keep. The app itself goes
 * through the transaction pooler (DATABASE_URL, see src/pool.ts). Both come
 * from `.env`, never from the repository.
 *
 * Generating the client needs no database, so a build without DIRECT_URL
 * (Vercel's, CI's) still works; a migration without it stops with Prisma's
 * own "no datasource url" error.
 */
const url = process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(url ? { datasource: { url } } : {}),
});
