-- Waitlist approval: additive only.
ALTER TABLE "User" ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "EmailListEntry" ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "EmailListEntry_userId_key" ON "EmailListEntry"("userId");

ALTER TABLE "EmailListEntry" ADD CONSTRAINT "EmailListEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
