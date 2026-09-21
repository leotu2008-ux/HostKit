-- A blank event, a live feed, and a record of what the agent did.
--
-- Create event now writes a row before the host has told us anything, so
-- every column the intake form used to fill needs a value to start from.
-- Defaults rather than nulls on purpose: ~45 readers of city / guestCount /
-- budgetTotalCents keep their types, their behaviour, and (for
-- lib/api/serialize.ts) their published iOS contract. What "not filled in
-- yet" means now lives in exactly one place — lib/brief.ts.

ALTER TABLE "Event" ALTER COLUMN "title" SET DEFAULT 'Untitled event';
ALTER TABLE "Event" ALTER COLUMN "type" SET DEFAULT 'MIXER';
ALTER TABLE "Event" ALTER COLUMN "guestCount" SET DEFAULT 0;
ALTER TABLE "Event" ALTER COLUMN "city" SET DEFAULT '';
ALTER TABLE "Event" ALTER COLUMN "budgetTotalCents" SET DEFAULT 0;

-- The host's own words. `type` stays the planning key derived from them.
ALTER TABLE "Event" ADD COLUMN "kind" TEXT;

CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Activity_eventId_createdAt_idx" ON "Activity"("eventId", "createdAt");

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "reason" TEXT NOT NULL DEFAULT 'brief',
    "briefHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- The idempotency guarantee: one run per set of facts, enforced by the
-- database rather than by a check-then-act that two tabs can both pass.
CREATE UNIQUE INDEX "AgentRun_eventId_briefHash_key" ON "AgentRun"("eventId", "briefHash");
CREATE INDEX "AgentRun_eventId_createdAt_idx" ON "AgentRun"("eventId", "createdAt");
CREATE INDEX "AgentRun_status_createdAt_idx" ON "AgentRun"("status", "createdAt");

ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
