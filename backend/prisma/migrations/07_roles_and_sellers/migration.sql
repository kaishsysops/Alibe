-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SELLER_APPROVER', 'POST_APPROVER', 'MODERATOR', 'SUPPORT');

-- CreateEnum
CREATE TYPE "SellerKind" AS ENUM ('INDIVIDUAL', 'STORE');

-- CreateEnum
CREATE TYPE "ApplicationKind" AS ENUM ('VERIFY', 'STORE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'PENDING';
ALTER TYPE "ListingStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "PurchaseKind" ADD VALUE 'STORE_PLAN';
ALTER TYPE "PurchaseKind" ADD VALUE 'PREMIUM_PLAN';

-- AlterEnum
ALTER TYPE "ReportReason" ADD VALUE 'BUSINESS_AS_INDIVIDUAL';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "renewalReminded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sellerKind" "SellerKind" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "staffRoles" "StaffRole"[] DEFAULT ARRAY[]::"StaffRole"[];

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "registrationNumber" TEXT NOT NULL,
    "status" "StoreStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SellerApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ApplicationKind" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "idNumberLast4" TEXT,
    "idFront" TEXT,
    "idBack" TEXT,
    "selfie" TEXT,
    "note" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_userId_key" ON "Store"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "SellerApplication_status_createdAt_idx" ON "SellerApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SellerApplication_userId_idx" ON "SellerApplication"("userId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerApplication" ADD CONSTRAINT "SellerApplication_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
