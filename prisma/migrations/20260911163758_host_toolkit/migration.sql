-- CreateEnum
CREATE TYPE "CollaboratorSource" AS ENUM ('MANUAL', 'APPLE_MAPS', 'CATALOG');

-- AlterTable
ALTER TABLE "EventCollaborator" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "source" "CollaboratorSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Guest" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "Blast" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Blast_eventId_sentAt_idx" ON "Blast"("eventId", "sentAt");

-- CreateIndex
CREATE INDEX "Guest_userId_idx" ON "Guest"("userId");

-- AddForeignKey
ALTER TABLE "Blast" ADD CONSTRAINT "Blast_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
