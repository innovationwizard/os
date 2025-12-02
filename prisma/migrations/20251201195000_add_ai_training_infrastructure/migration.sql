-- Add AI Training Infrastructure
-- This migration adds Feedback enum and extends StatusChange with AI training fields

-- Step 1: Ensure ItemStatus enum is correct (handle drift from CREATE->CREATING, LIBRARY->COMPENDIUM)
DO $$
BEGIN
  -- Check if CREATE exists and needs to be converted to CREATING
  IF EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'ItemStatus' AND e.enumlabel = 'CREATE'
  ) THEN
    -- Create new enum with CREATING
    CREATE TYPE "ItemStatus_new" AS ENUM ('INBOX', 'TODO', 'CREATING', 'IN_REVIEW', 'BLOCKED', 'DONE', 'COMPENDIUM', 'ON_HOLD', 'COLD_STORAGE');
    
    -- Convert columns
    ALTER TABLE "Item" ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE "Item" ALTER COLUMN status TYPE "ItemStatus_new" USING 
      CASE 
        WHEN status::text = 'CREATE' THEN 'CREATING'::"ItemStatus_new"
        WHEN status::text = 'LIBRARY' THEN 'COMPENDIUM'::"ItemStatus_new"
        ELSE status::text::"ItemStatus_new"
      END;
    ALTER TABLE "Item" ALTER COLUMN status SET DEFAULT 'INBOX'::"ItemStatus_new";
    
    ALTER TABLE "StatusChange" ALTER COLUMN "fromStatus" TYPE "ItemStatus_new" USING 
      CASE 
        WHEN "fromStatus"::text = 'CREATE' THEN 'CREATING'::"ItemStatus_new"
        WHEN "fromStatus"::text = 'LIBRARY' THEN 'COMPENDIUM'::"ItemStatus_new"
        WHEN "fromStatus" IS NULL THEN NULL
        ELSE "fromStatus"::text::"ItemStatus_new"
      END;
    
    ALTER TABLE "StatusChange" ALTER COLUMN "toStatus" TYPE "ItemStatus_new" USING 
      CASE 
        WHEN "toStatus"::text = 'CREATE' THEN 'CREATING'::"ItemStatus_new"
        WHEN "toStatus"::text = 'LIBRARY' THEN 'COMPENDIUM'::"ItemStatus_new"
        ELSE "toStatus"::text::"ItemStatus_new"
      END;
    
    -- Drop old enum and rename new one
    DROP TYPE IF EXISTS "ItemStatus";
    ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";
  END IF;
END $$;

-- Step 2: Create Feedback enum
CREATE TYPE "Feedback" AS ENUM ('CONFIRMED', 'CORRECTED', 'IGNORED');

-- Step 3: Add AI training fields to StatusChange table
ALTER TABLE "StatusChange" 
  ADD COLUMN IF NOT EXISTS "aiReasoning" TEXT,
  ADD COLUMN IF NOT EXISTS "aiConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "userFeedback" "Feedback",
  ADD COLUMN IF NOT EXISTS "userCorrection" JSONB,
  ADD COLUMN IF NOT EXISTS "outcomeScore" DOUBLE PRECISION;

-- Step 4: Add index for userFeedback (for training data queries)
CREATE INDEX IF NOT EXISTS "StatusChange_userFeedback_idx" ON "StatusChange"("userFeedback");

-- Step 5: Ensure Item.order column exists (handle drift)
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "order" INTEGER;

-- Step 6: Ensure Item index exists (handle drift)
CREATE INDEX IF NOT EXISTS "Item_status_swimlane_order_idx" ON "Item"("status", "swimlane", "order");
