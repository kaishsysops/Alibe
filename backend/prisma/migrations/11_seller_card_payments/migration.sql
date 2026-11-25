-- Card payments for item sales (Premium sellers and stores), held by Alibe
-- until delivery. See src/orderCard.ts.
CREATE TYPE "CardPaymentStatus" AS ENUM ('PENDING', 'FAILED', 'HELD', 'PAYOUT_DUE', 'PAID_OUT', 'REFUND_DUE', 'REFUNDED');

CREATE TABLE "CardPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "gatewayRef" TEXT,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "status" "CardPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "payoutDueAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "settledAt" TIMESTAMP(3),
    "settledBy" TEXT,
    "settleNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CardPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardPayment_reference_key" ON "CardPayment"("reference");
CREATE UNIQUE INDEX "CardPayment_gatewayRef_key" ON "CardPayment"("gatewayRef");
CREATE INDEX "CardPayment_orderId_status_idx" ON "CardPayment"("orderId", "status");
CREATE INDEX "CardPayment_status_idx" ON "CardPayment"("status");
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A seller's card switch and payout bank account (its own table so no user
-- lookup can ever expose it).
CREATE TABLE "PayoutAccount" (
    "userId" TEXT NOT NULL,
    "cardPaymentsOn" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "detailsChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
