import assert from "node:assert/strict";
import { test } from "node:test";
import { poolConfig } from "./pool.ts";

test("a Supabase host is verified against Supabase's authority, whatever sslmode says", () => {
  const config = poolConfig("postgresql://u:p@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true");
  assert.ok(!String(config.connectionString).includes("sslmode"));
  assert.ok(String(config.connectionString).includes("pgbouncer=true"));
  assert.deepEqual(Object.keys(config.ssl as object).sort(), ["ca", "rejectUnauthorized"]);
  assert.equal((config.ssl as { rejectUnauthorized: boolean }).rejectUnauthorized, true);
});

test("any other host is taken as written", () => {
  const url = "postgresql://tread:x@localhost:54329/tread";
  assert.deepEqual(poolConfig(url), { connectionString: url });
});
