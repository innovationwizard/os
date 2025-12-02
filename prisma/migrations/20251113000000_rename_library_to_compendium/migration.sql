-- Rename LIBRARY to COMPENDIUM in ItemStatus enum
-- This requires dropping and recreating the enum type, which affects all columns using it

-- Step 1: Create new enum with COMPENDIUM (replacing LIBRARY)
CREATE TYPE "ItemStatus_new" AS ENUM ('INBOX', 'TODO', 'CREATE', 'IN_REVIEW', 'BLOCKED', 'DONE', 'COMPENDIUM', 'ON_HOLD', 'COLD_STORAGE');

-- Step 2: Alter the columns to use the new enum, converting LIBRARY to COMPENDIUM during the conversion
-- First drop the default, change the type, then restore the default
ALTER TABLE "Item" ALTER COLUMN status DROP DEFAULT;
ALTER TABLE "Item" ALTER COLUMN status TYPE "ItemStatus_new" USING 
  CASE 
    WHEN status::text = 'LIBRARY' THEN 'COMPENDIUM'::"ItemStatus_new"
    ELSE status::text::"ItemStatus_new"
  END;
ALTER TABLE "Item" ALTER COLUMN status SET DEFAULT 'INBOX'::"ItemStatus_new";

ALTER TABLE "StatusChange" ALTER COLUMN "fromStatus" TYPE "ItemStatus_new" USING 
  CASE 
    WHEN "fromStatus"::text = 'LIBRARY' THEN 'COMPENDIUM'::"ItemStatus_new"
    WHEN "fromStatus" IS NULL THEN NULL
    ELSE "fromStatus"::text::"ItemStatus_new"
  END;

ALTER TABLE "StatusChange" ALTER COLUMN "toStatus" TYPE "ItemStatus_new" USING 
  CASE 
    WHEN "toStatus"::text = 'LIBRARY' THEN 'COMPENDIUM'::"ItemStatus_new"
    ELSE "toStatus"::text::"ItemStatus_new"
  END;

-- Step 3: Drop the old enum
DROP TYPE IF EXISTS "ItemStatus";

-- Step 4: Rename the new enum to the original name
ALTER TYPE "ItemStatus_new" RENAME TO "ItemStatus";
