-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "CollaboratorKind" AS ENUM ('VENUE', 'SPEAKER', 'COHOST');

-- CreateEnum
CREATE TYPE "CollaboratorStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "ownerId" DROP NOT NULL,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "ticketType" "TicketType" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "ticketPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "visibility" "EventVisibility" NOT NULL DEFAULT 'UNLISTED',
ADD COLUMN     "claimToken" TEXT;

-- Existing live nights stay on Discover.
UPDATE "Event" SET "visibility" = 'PUBLIC' WHERE "published" = true;
UPDATE "Event" SET "description" = "vibe" WHERE "vibe" IS NOT NULL AND "description" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Event_claimToken_key" ON "Event"("claimToken");

-- DropIndex
DROP INDEX IF EXISTS "Event_published_date_idx";

-- CreateIndex
CREATE INDEX "Event_published_visibility_date_idx" ON "Event"("published", "visibility", "date");

-- CreateTable
CREATE TABLE "EventCollaborator" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "CollaboratorKind" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "detail" TEXT,
    "status" "CollaboratorStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventCollaborator_eventId_kind_idx" ON "EventCollaborator"("eventId", "kind");

-- AddForeignKey
ALTER TABLE "EventCollaborator" ADD CONSTRAINT "EventCollaborator_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
