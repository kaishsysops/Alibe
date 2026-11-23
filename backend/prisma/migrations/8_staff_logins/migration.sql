-- Sessions made by the staff sign-in (username + password on the admin and
-- portal sites). Only these unlock staff APIs.
ALTER TABLE "Session" ADD COLUMN "staff" BOOLEAN NOT NULL DEFAULT false;

-- Email invites are replaced by logins admins create.
DELETE FROM "AppSetting" WHERE "key" = 'staffInvites';

-- One-time sign-in links: an admin invites staff, the link lets them choose
-- their password once. Only a hash of the token is stored.
CREATE TABLE "StaffInvite" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "StaffInvite_userId_idx" ON "StaffInvite"("userId");
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
