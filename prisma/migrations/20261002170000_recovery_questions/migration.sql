-- Account recovery: hashed security answers, the counters that throttle answer
-- guessing, the session epoch a reset bumps, and the reset history.

ALTER TYPE "NotificationType" ADD VALUE 'PASSWORD_RESET';

ALTER TABLE "User"
  ADD COLUMN "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recoveryAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "recoveryLockedUntil" TIMESTAMP(3),
  ADD COLUMN "recoveryPromptHiddenAt" TIMESTAMP(3);

CREATE TABLE "SecurityAnswer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "answerHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecurityAnswer_userId_questionKey_key" ON "SecurityAnswer"("userId", "questionKey");
CREATE INDEX "SecurityAnswer_userId_idx" ON "SecurityAnswer"("userId");

ALTER TABLE "SecurityAnswer"
  ADD CONSTRAINT "SecurityAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PasswordReset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordReset_userId_createdAt_idx" ON "PasswordReset"("userId", "createdAt");

ALTER TABLE "PasswordReset"
  ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
