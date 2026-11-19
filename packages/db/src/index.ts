import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.ts";
import { poolConfig } from "./pool.ts";

export * from "./generated/client.ts";
export { poolConfig } from "./pool.ts";

/**
 * The one Prisma client of a server process.
 *
 * Through Supabase's pooler (DATABASE_URL). Kept on `globalThis` because a
 * Next.js dev server reloads modules on every edit, and each reload would
 * otherwise open a fresh pool until Postgres ran out of connections.
 *
 * Server only: the phone app never imports this package, it talks to the
 * web app's API.
 */
const shared = globalThis as unknown as { treadPrisma?: PrismaClient };

function connect(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg(poolConfig(url)) });
}

export const prisma: PrismaClient = shared.treadPrisma ?? connect();
if (process.env.NODE_ENV !== "production") shared.treadPrisma = prisma;
