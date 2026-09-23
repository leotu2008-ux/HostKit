-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "copiedFromId" TEXT,
ADD COLUMN     "seriesId" TEXT;

-- AlterTable
ALTER TABLE "EventCollaborator" ADD COLUMN     "vendorContactId" TEXT;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "contactId" TEXT;

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "CollaboratorKind",
    "category" "ListingCategory",
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "listingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Series_ownerId_idx" ON "Series"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_email_key" ON "Contact"("ownerId", "email");

-- CreateIndex
CREATE INDEX "VendorContact_ownerId_idx" ON "VendorContact"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorContact_ownerId_listingId_key" ON "VendorContact"("ownerId", "listingId");

-- CreateIndex
CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");

-- CreateIndex
CREATE INDEX "Guest_contactId_idx" ON "Guest"("contactId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_copiedFromId_fkey" FOREIGN KEY ("copiedFromId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCollaborator" ADD CONSTRAINT "EventCollaborator_vendorContactId_fkey" FOREIGN KEY ("vendorContactId") REFERENCES "VendorContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Series" ADD CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the guest book: one Contact per host and lowercased email, from existing guests.
INSERT INTO "Contact" ("id", "ownerId", "name", "email", "createdAt")
SELECT gen_random_uuid()::text, e."ownerId", MAX(g."name"), lower(trim(g."email")), MIN(g."createdAt")
FROM "Guest" g
JOIN "Event" e ON e."id" = g."eventId"
WHERE g."email" IS NOT NULL AND trim(g."email") <> '' AND e."ownerId" IS NOT NULL
GROUP BY e."ownerId", lower(trim(g."email"))
ON CONFLICT ("ownerId", "email") DO NOTHING;

UPDATE "Guest" g
SET "contactId" = c."id"
FROM "Event" e, "Contact" c
WHERE e."id" = g."eventId"
  AND c."ownerId" = e."ownerId"
  AND c."email" = lower(trim(g."email"))
  AND g."contactId" IS NULL;
