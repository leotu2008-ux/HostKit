-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WEDDING', 'BIRTHDAY', 'CORPORATE_OFFSITE', 'LAUNCH_PARTY', 'BABY_SHOWER', 'DINNER_PARTY', 'FUNDRAISER', 'ENGAGEMENT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('VENUE', 'VENDOR');

-- CreateEnum
CREATE TYPE "ListingCategory" AS ENUM ('VENUE', 'CATERING', 'PHOTOGRAPHY', 'VIDEOGRAPHY', 'FLORALS', 'MUSIC_DJ', 'AV_PRODUCTION', 'RENTALS', 'BAR_SERVICE', 'CAKE_DESSERT', 'HAIR_MAKEUP', 'OFFICIANT', 'TRANSPORT', 'STAFFING', 'DECOR_STYLING', 'INVITATIONS');

-- CreateEnum
CREATE TYPE "PriceUnit" AS ENUM ('HOUR', 'DAY', 'PERSON', 'FLAT');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('DRAFT', 'SENT', 'REPLIED', 'QUOTED', 'BOOKED', 'DECLINED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DONE');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('INVITED', 'ATTENDING', 'DECLINED', 'MAYBE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PLANNING',
    "date" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "datesFlexible" BOOLEAN NOT NULL DEFAULT false,
    "durationHours" INTEGER NOT NULL DEFAULT 6,
    "guestCount" INTEGER NOT NULL,
    "city" TEXT NOT NULL,
    "budgetTotalCents" INTEGER NOT NULL,
    "vibe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "priceUnit" "PriceUnit" NOT NULL,
    "capacityMin" INTEGER,
    "capacityMax" INTEGER,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPhoto" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListing" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "note" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'DRAFT',
    "message" TEXT NOT NULL,
    "quotedCents" INTEGER,
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCategory" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "allocatedCents" INTEGER NOT NULL,

    CONSTRAINT "BudgetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "estimatedCents" INTEGER NOT NULL DEFAULT 0,
    "actualCents" INTEGER,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "listingId" TEXT,
    "inquiryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "offsetDays" INTEGER NOT NULL,
    "category" "ListingCategory",
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'INVITED',
    "plusOnes" INTEGER NOT NULL DEFAULT 0,
    "dietary" TEXT,
    "note" TEXT,
    "rsvpToken" TEXT NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunSheetItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunSheetItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Event_ownerId_idx" ON "Event"("ownerId");

-- CreateIndex
CREATE INDEX "Listing_city_category_idx" ON "Listing"("city", "category");

-- CreateIndex
CREATE INDEX "Listing_category_idx" ON "Listing"("category");

-- CreateIndex
CREATE INDEX "ListingPhoto_listingId_position_idx" ON "ListingPhoto"("listingId", "position");

-- CreateIndex
CREATE INDEX "SavedListing_eventId_idx" ON "SavedListing"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListing_eventId_listingId_key" ON "SavedListing"("eventId", "listingId");

-- CreateIndex
CREATE INDEX "Inquiry_eventId_status_idx" ON "Inquiry"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_eventId_listingId_key" ON "Inquiry"("eventId", "listingId");

-- CreateIndex
CREATE INDEX "BudgetCategory_eventId_idx" ON "BudgetCategory"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCategory_eventId_category_key" ON "BudgetCategory"("eventId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetItem_inquiryId_key" ON "BudgetItem"("inquiryId");

-- CreateIndex
CREATE INDEX "BudgetItem_eventId_idx" ON "BudgetItem"("eventId");

-- CreateIndex
CREATE INDEX "BudgetItem_categoryId_idx" ON "BudgetItem"("categoryId");

-- CreateIndex
CREATE INDEX "Task_eventId_status_idx" ON "Task"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_rsvpToken_key" ON "Guest"("rsvpToken");

-- CreateIndex
CREATE INDEX "Guest_eventId_idx" ON "Guest"("eventId");

-- CreateIndex
CREATE INDEX "RunSheetItem_eventId_startsAt_idx" ON "RunSheetItem"("eventId", "startsAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCategory" ADD CONSTRAINT "BudgetCategory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunSheetItem" ADD CONSTRAINT "RunSheetItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
