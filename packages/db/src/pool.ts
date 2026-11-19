import type { PoolConfig } from "pg";
import { SUPABASE_ROOT_CA } from "./supabaseCa.ts";

/**
 * How to reach the database from DATABASE_URL.
 *
 * Supabase's certificates are signed by its own authority, which Node does
 * not know: rather than switch verification off, the authority is given here,
 * and the server's name is checked against it. Any other host (a local
 * Postgres) is taken as the URL says.
 */
export function poolConfig(url: string): PoolConfig {
  const parsed = new URL(url);
  if (!parsed.hostname.endsWith(".supabase.com") && !parsed.hostname.endsWith(".supabase.co")) {
    return { connectionString: url };
  }
  // The URL's own sslmode would replace the settings below.
  parsed.searchParams.delete("sslmode");
  return { connectionString: parsed.toString(), ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true } };
}
