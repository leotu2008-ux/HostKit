-- CreateTable
CREATE TABLE "CampusEvent" (
    "id" TEXT NOT NULL,
    "schoolDomain" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "host" TEXT,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampusSync" (
    "sourceKey" TEXT NOT NULL,
    "schoolDomain" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "eventCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CampusSync_pkey" PRIMARY KEY ("sourceKey")
);

-- CreateIndex
CREATE INDEX "CampusEvent_schoolDomain_startsAt_idx" ON "CampusEvent"("schoolDomain", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampusEvent_sourceKey_externalId_key" ON "CampusEvent"("sourceKey", "externalId");

