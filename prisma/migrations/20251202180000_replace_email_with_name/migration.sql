-- Step 1: Add name column (nullable first)
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- Step 2: Populate name from email for existing users
UPDATE "User" SET "name" = 'condor' WHERE "email" = 'jorgeluiscontrerasherrera@gmail.com';
UPDATE "User" SET "name" = 'estefani' WHERE "email" = 'stefani121@gmail.com';

-- Step 3: Make name non-nullable and unique, drop email
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_name_key" UNIQUE ("name");
ALTER TABLE "User" DROP COLUMN "email";
