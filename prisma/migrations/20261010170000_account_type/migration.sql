-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('STUDENT', 'PERSONNEL');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'STUDENT';

-- Existing OSAS staff accounts are personnel accounts.
UPDATE "User"
SET "accountType" = 'PERSONNEL'
WHERE "role" = 'ADMIN';
