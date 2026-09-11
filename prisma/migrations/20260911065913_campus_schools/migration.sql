-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "schoolDomain" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "classYear" INTEGER,
ADD COLUMN     "schoolDomain" TEXT;

-- CreateIndex
CREATE INDEX "Event_schoolDomain_published_date_idx" ON "Event"("schoolDomain", "published", "date");
