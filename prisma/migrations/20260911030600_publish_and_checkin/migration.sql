-- AlterTable
ALTER TABLE "Event" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN "checkedInAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Event_published_date_idx" ON "Event"("published", "date");
