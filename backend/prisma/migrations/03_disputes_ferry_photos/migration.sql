-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cargoReceiptUrl" TEXT,
ADD COLUMN     "disputeNote" TEXT,
ADD COLUMN     "disputeOutcome" TEXT,
ADD COLUMN     "disputeResolvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DisputeEvidence" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageHash" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "hash" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageHash_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisputeEvidence_orderId_idx" ON "DisputeEvidence"("orderId");

-- CreateIndex
CREATE INDEX "ImageHash_sellerId_idx" ON "ImageHash"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageHash_listingId_imageUrl_key" ON "ImageHash"("listingId", "imageUrl");

-- AddForeignKey
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageHash" ADD CONSTRAINT "ImageHash_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
