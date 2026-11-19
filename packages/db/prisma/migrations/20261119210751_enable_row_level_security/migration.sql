-- Supabase exposes the `public` schema through its Data API. Row level
-- security with no policy shuts that door: the anon and authenticated roles
-- see nothing, and only this server, connecting as the table owner, reads
-- and writes. Every table added later needs the same line.
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "track" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "route" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shoe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "preferences" ENABLE ROW LEVEL SECURITY;
-- Prisma's own history table, where it exists (a shadow database has none yet).
DO $$ BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
