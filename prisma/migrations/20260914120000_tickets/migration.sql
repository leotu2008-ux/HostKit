-- Tickets: what's for sale, who bought it, what the door scans.

CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED');

CREATE TABLE "TicketTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "salesOpenAt" TIMESTAMP(3),
    "salesCloseAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "paidVia" TEXT,
    "paidAt" TIMESTAMP(3),
    "token" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ticketTierId" TEXT NOT NULL,
    "holderName" TEXT,
    "token" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_token_key" ON "Order"("token");
CREATE UNIQUE INDEX "Ticket_token_key" ON "Ticket"("token");
CREATE INDEX "TicketTier_eventId_idx" ON "TicketTier"("eventId");
CREATE INDEX "Order_eventId_createdAt_idx" ON "Order"("eventId", "createdAt");
CREATE INDEX "Order_email_idx" ON "Order"("email");
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");
CREATE INDEX "Ticket_ticketTierId_idx" ON "Ticket"("ticketTierId");

ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTierId_fkey"
    FOREIGN KEY ("ticketTierId") REFERENCES "TicketTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
