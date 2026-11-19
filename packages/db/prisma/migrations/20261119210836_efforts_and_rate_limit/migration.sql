-- AlterTable
ALTER TABLE "outing" ADD COLUMN     "efforts" JSONB;

-- CreateTable
CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");

-- Same rule as every other table: closed to the Data API.
ALTER TABLE "rateLimit" ENABLE ROW LEVEL SECURITY;
