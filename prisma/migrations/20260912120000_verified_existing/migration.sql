-- Confirmation became required at sign-up. Accounts from before that were
-- never asked, so they count as confirmed rather than locked out.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
