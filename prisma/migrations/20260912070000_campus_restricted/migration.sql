-- Official events a school lists for its own community: the feed shows the
-- title and time to everyone but keeps the place behind a school sign-in.
ALTER TABLE "CampusEvent" ADD COLUMN "restricted" BOOLEAN NOT NULL DEFAULT false;
