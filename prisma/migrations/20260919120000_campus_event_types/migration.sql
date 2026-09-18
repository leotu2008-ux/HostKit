-- Real usage shows students picking the least-wrong of five corporate/social
-- event types (83 of 88 events are DINNER_PARTY). These five are what student
-- organisations actually host, so the planner can template for them directly
-- instead of forcing a mixer into a dinner-party mould.

-- AlterEnum
-- Postgres 12+ allows ADD VALUE inside a transaction as long as the new value
-- isn't used within that same transaction — which none of these are, so this
-- migration runs safely wrapped like any other.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'MIXER';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'GENERAL_MEETING';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'FORMAL';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'PITCH_NIGHT';
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'STUDY_BREAK';
