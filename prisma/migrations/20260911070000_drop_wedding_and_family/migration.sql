-- HostKit is for student, professional and fun events. Weddings, engagements
-- and baby showers leave the product, along with the two wedding-only vendor
-- categories. Existing rows are moved or removed first so the enums can shrink.

UPDATE "Event" SET "type" = 'DINNER_PARTY'
WHERE "type" IN ('WEDDING', 'ENGAGEMENT', 'BABY_SHOWER');

UPDATE "Task" SET "category" = NULL
WHERE "category" IN ('HAIR_MAKEUP', 'OFFICIANT');

-- Budget items under these categories cascade away with them.
DELETE FROM "BudgetCategory" WHERE "category" IN ('HAIR_MAKEUP', 'OFFICIANT');

-- Saved listings and inquiries cascade; budget items keep their line but lose
-- the listing link.
DELETE FROM "Listing" WHERE "category" IN ('HAIR_MAKEUP', 'OFFICIANT');

-- AlterEnum
BEGIN;
CREATE TYPE "EventType_new" AS ENUM ('BIRTHDAY', 'CORPORATE_OFFSITE', 'LAUNCH_PARTY', 'DINNER_PARTY', 'FUNDRAISER');
ALTER TABLE "Event" ALTER COLUMN "type" TYPE "EventType_new" USING ("type"::text::"EventType_new");
ALTER TYPE "EventType" RENAME TO "EventType_old";
ALTER TYPE "EventType_new" RENAME TO "EventType";
DROP TYPE "EventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ListingCategory_new" AS ENUM ('VENUE', 'CATERING', 'PHOTOGRAPHY', 'VIDEOGRAPHY', 'FLORALS', 'MUSIC_DJ', 'AV_PRODUCTION', 'RENTALS', 'BAR_SERVICE', 'CAKE_DESSERT', 'TRANSPORT', 'STAFFING', 'DECOR_STYLING', 'INVITATIONS');
ALTER TABLE "Listing" ALTER COLUMN "category" TYPE "ListingCategory_new" USING ("category"::text::"ListingCategory_new");
ALTER TABLE "BudgetCategory" ALTER COLUMN "category" TYPE "ListingCategory_new" USING ("category"::text::"ListingCategory_new");
ALTER TABLE "Task" ALTER COLUMN "category" TYPE "ListingCategory_new" USING ("category"::text::"ListingCategory_new");
ALTER TYPE "ListingCategory" RENAME TO "ListingCategory_old";
ALTER TYPE "ListingCategory_new" RENAME TO "ListingCategory";
DROP TYPE "ListingCategory_old";
COMMIT;
