-- Where an inquiry goes. Null until the host finds the address: Listing holds
-- no contact details, because HostKit has no supply side.
ALTER TABLE "Inquiry" ADD COLUMN "toEmail" TEXT;
