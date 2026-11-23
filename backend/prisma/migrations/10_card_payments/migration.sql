-- Card payments (BML Connect): the gateway's transaction id for a purchase.
ALTER TABLE "Purchase" ADD COLUMN "gatewayRef" TEXT;
CREATE UNIQUE INDEX "Purchase_gatewayRef_key" ON "Purchase"("gatewayRef");

-- Reminders sent for this purchase so far (unpaid nudges, plan renewal and
-- grace-period notices), so each is sent once.
ALTER TABLE "Purchase" ADD COLUMN "reminderStage" INTEGER NOT NULL DEFAULT 0;

-- A store owner posts each listing either under their store or as themselves.
ALTER TABLE "Listing" ADD COLUMN "storeId" TEXT;
CREATE INDEX "Listing_storeId_idx" ON "Listing"("storeId");
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Premium: listing stats (views) and the daily "bump to top".
ALTER TABLE "Listing" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "bumpedAt" TIMESTAMP(3);
