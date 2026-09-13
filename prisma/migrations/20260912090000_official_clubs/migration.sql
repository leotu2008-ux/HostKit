-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "isOfficial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "CampusEvent" ADD COLUMN     "hostRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Club_sourceRef_key" ON "Club"("sourceRef");

-- CreateIndex
CREATE INDEX "CampusEvent_hostRef_idx" ON "CampusEvent"("hostRef");
