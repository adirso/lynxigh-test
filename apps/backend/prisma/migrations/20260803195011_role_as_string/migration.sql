-- AlterTable: convert role from the Role enum to a plain string, preserving
-- existing data (validated in application code instead of at the DB level).
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING "role"::TEXT;

-- DropEnum
DROP TYPE "Role";
