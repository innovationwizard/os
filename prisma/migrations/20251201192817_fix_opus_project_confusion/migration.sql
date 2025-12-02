-- Fix Opus vs Project Confusion
-- This migration:
-- 1. Creates OpusType enum
-- 2. Creates Opus table (if it doesn't exist)
-- 3. Adds opusType column to Opus table
-- 4. Removes PROJECT from ItemType enum
-- 5. Removes projectId and subItems relation from Item table

-- Step 1: Create OpusType enum
CREATE TYPE "OpusType" AS ENUM ('PROJECT', 'BOOK', 'CONTEXT', 'CODEBASE', 'WORKSHOP', 'APPLICATION', 'PORTFOLIO', 'RESEARCH');

-- Step 2: Create Opus table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Opus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "isStrategic" BOOLEAN NOT NULL DEFAULT false,
    "isDynamic" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opus_pkey" PRIMARY KEY ("id")
);

-- Step 3: Add opusType column to Opus table with default PROJECT (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Opus' AND column_name = 'opusType'
    ) THEN
        ALTER TABLE "Opus" ADD COLUMN "opusType" "OpusType" NOT NULL DEFAULT 'PROJECT';
    END IF;
END $$;

-- Step 4: Create indexes on Opus table (if they don't exist)
CREATE INDEX IF NOT EXISTS "Opus_createdByUserId_idx" ON "Opus"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Opus_isStrategic_idx" ON "Opus"("isStrategic");
CREATE INDEX IF NOT EXISTS "Opus_opusType_idx" ON "Opus"("opusType");

-- Step 5: Add foreign key constraint for Opus.createdByUserId (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Opus_createdByUserId_fkey'
    ) THEN
        ALTER TABLE "Opus" ADD CONSTRAINT "Opus_createdByUserId_fkey" 
        FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 6: Add opusId column to Item table (if it doesn't exist) and foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Item' AND column_name = 'opusId'
    ) THEN
        ALTER TABLE "Item" ADD COLUMN "opusId" TEXT;
        CREATE INDEX IF NOT EXISTS "Item_opusId_idx" ON "Item"("opusId");
        ALTER TABLE "Item" ADD CONSTRAINT "Item_opusId_fkey" 
        FOREIGN KEY ("opusId") REFERENCES "Opus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 7: Remove PROJECT from ItemType enum
-- First, update any existing PROJECT items to TASK (they should be migrated to Opus separately)
UPDATE "Item" SET type = 'TASK'::"ItemType" WHERE type = 'PROJECT'::"ItemType";

-- Create new ItemType enum without PROJECT
CREATE TYPE "ItemType_new" AS ENUM ('TASK', 'INFO');

-- Drop the default, change the type, then restore the default
ALTER TABLE "Item" ALTER COLUMN type DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN type TYPE "ItemType_new" USING type::text::"ItemType_new";
ALTER TABLE "Item" ALTER COLUMN type SET DEFAULT 'TASK'::"ItemType_new";

-- Drop the old enum
DROP TYPE IF EXISTS "ItemType";

-- Rename the new enum to the original name
ALTER TYPE "ItemType_new" RENAME TO "ItemType";

-- Step 5: Drop projectId foreign key constraint and column
-- First drop the foreign key constraint
ALTER TABLE "Item" DROP CONSTRAINT IF EXISTS "Item_projectId_fkey";

-- Drop the projectId column
ALTER TABLE "Item" DROP COLUMN IF EXISTS "projectId";

-- Note: subItems relation is automatically removed when projectId is dropped
-- as it's just the reverse side of the self-referential relation
