-- An event can last an hour and a half. The column keeps its name and its
-- default; only the type widens, so every reader that does arithmetic on
-- hours keeps working and the iOS contract stays a number.
ALTER TABLE "Event" ALTER COLUMN "durationHours" TYPE DOUBLE PRECISION;
