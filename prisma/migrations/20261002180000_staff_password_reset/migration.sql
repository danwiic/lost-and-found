-- Staff-issued temporary passwords: the flag that forces the owner to choose a
-- new one, and the audit columns that record who issued a reset.

CREATE TYPE "PasswordResetMethod" AS ENUM ('QUESTIONS', 'STAFF');

ALTER TABLE "User"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PasswordReset"
  ADD COLUMN "method" "PasswordResetMethod" NOT NULL DEFAULT 'QUESTIONS',
  ADD COLUMN "actorId" TEXT;

CREATE INDEX "PasswordReset_actorId_idx" ON "PasswordReset"("actorId");

ALTER TABLE "PasswordReset"
  ADD CONSTRAINT "PasswordReset_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
