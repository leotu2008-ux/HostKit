-- Eight nights recurring hosts run that the ten types couldn't describe:
-- a networking night was filed as a mixer, a workshop as a general meeting.
-- Sources: Eventbrite's event formats and the event types student
-- organisations run most (docs/superpowers/specs/2026-09-25-venue-scouting-and-event-types-design.md).

-- AlterEnum
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the new value
-- isn't used within that same transaction, which none of these are.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'NETWORKING';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'WORKSHOP';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SPEAKER_EVENT';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'HACKATHON';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'GAME_NIGHT';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'WATCH_PARTY';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SHOWCASE';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'RUN_CLUB';
