-- Bumped by a password reset; tokens and sessions carry the version they
-- were issued at, so older ones stop working.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
