-- The OSAS intake flow records who handed an item over at the counter. Null on
-- a student's own report, where the reporter is the finder.
ALTER TABLE "Item" ADD COLUMN "finderName" TEXT;
ALTER TABLE "Item" ADD COLUMN "finderContact" TEXT;
