-- Keep the door signal.
--
-- Checking a guest in used to overwrite rsvpStatus, so after the night there
-- was no way to tell "said yes and came" from "walked up". This records the
-- walk-up at the door instead, and freezes one immutable row per finished
-- event so there is something to learn from.

-- Someone admitted who never RSVP'd yes.
ALTER TABLE "Guest" ADD COLUMN "arrivedWithoutRsvp" BOOLEAN NOT NULL DEFAULT false;

-- Where a row came from, so a regenerate knows what it may replace.
CREATE TYPE "RowSource" AS ENUM ('GENERATED', 'HUMAN');

ALTER TABLE "Task" ADD COLUMN "source" "RowSource" NOT NULL DEFAULT 'GENERATED';
ALTER TABLE "RunSheetItem" ADD COLUMN "source" "RowSource" NOT NULL DEFAULT 'GENERATED';
ALTER TABLE "BudgetCategory" ADD COLUMN "source" "RowSource" NOT NULL DEFAULT 'GENERATED';

-- What actually happened. One row per event, written once, never updated.
CREATE TABLE "EventOutcome" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "expectedHeads" INTEGER NOT NULL,
    "attendingAtClose" INTEGER NOT NULL,
    "checkedIn" INTEGER NOT NULL,
    "walkUps" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "campusConflicts" INTEGER,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventOutcome_eventId_key" ON "EventOutcome"("eventId");
CREATE INDEX "EventOutcome_completedAt_idx" ON "EventOutcome"("completedAt");

ALTER TABLE "EventOutcome" ADD CONSTRAINT "EventOutcome_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
