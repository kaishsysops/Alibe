-- Why a post was held for review (risk checks), shown to Post approvers.
ALTER TABLE "Listing" ADD COLUMN "holdReason" TEXT;
