-- A claim may carry a photo as proof of ownership alongside the required
-- free-text proof. Optional: null means the claimant attached nothing, which is
-- the same state every claim was in before this column existed.

ALTER TABLE "Claim" ADD COLUMN "proofImagePath" TEXT;
