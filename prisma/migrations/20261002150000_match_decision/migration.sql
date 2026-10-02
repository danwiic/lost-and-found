-- A suggested pair stays SUGGESTED until OSAS confirms or dismisses it.
CREATE TYPE "MatchStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'DISMISSED');

-- Existing pairs were never decided, so the default marks them SUGGESTED.
ALTER TABLE "Match"
  ADD COLUMN "status" "MatchStatus" NOT NULL DEFAULT 'SUGGESTED',
  ADD COLUMN "decidedById" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3);

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
