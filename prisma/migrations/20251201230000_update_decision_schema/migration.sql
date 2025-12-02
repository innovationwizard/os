-- Update Decision model to comprehensive RL schema

-- Step 1: Add OVERRIDDEN to Feedback enum
ALTER TYPE "Feedback" ADD VALUE IF NOT EXISTS 'OVERRIDDEN';

-- Step 2: Add new columns to Decision table
DO $$
BEGIN
    -- Add userId column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'userId') THEN
        ALTER TABLE "Decision" ADD COLUMN "userId" TEXT;
    END IF;

    -- Add modelVersion column (required)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'modelVersion') THEN
        ALTER TABLE "Decision" ADD COLUMN "modelVersion" TEXT NOT NULL DEFAULT 'gpt-4.1-mini-20250101';
    END IF;

    -- Add alternativeActions column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'alternativeActions') THEN
        ALTER TABLE "Decision" ADD COLUMN "alternativeActions" JSONB;
    END IF;

    -- Add feedbackAt column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'feedbackAt') THEN
        ALTER TABLE "Decision" ADD COLUMN "feedbackAt" TIMESTAMP(3);
    END IF;

    -- Add outcomeObservedAt column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'outcomeObservedAt') THEN
        ALTER TABLE "Decision" ADD COLUMN "outcomeObservedAt" TIMESTAMP(3);
    END IF;

    -- Add rewardComponents column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'rewardComponents') THEN
        ALTER TABLE "Decision" ADD COLUMN "rewardComponents" JSONB;
    END IF;

    -- Add isTrainingData column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'isTrainingData') THEN
        ALTER TABLE "Decision" ADD COLUMN "isTrainingData" BOOLEAN NOT NULL DEFAULT true;
    END IF;

    -- Add isValidationData column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'isValidationData') THEN
        ALTER TABLE "Decision" ADD COLUMN "isValidationData" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add trainingEpoch column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'trainingEpoch') THEN
        ALTER TABLE "Decision" ADD COLUMN "trainingEpoch" INTEGER;
    END IF;

    -- Add updatedAt column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Decision' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Decision" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Step 3: Update foreign key constraints (change from SetNull to Cascade)
DO $$
BEGIN
    -- Drop existing foreign key constraints
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Decision_itemId_fkey') THEN
        ALTER TABLE "Decision" DROP CONSTRAINT "Decision_itemId_fkey";
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Decision_opusId_fkey') THEN
        ALTER TABLE "Decision" DROP CONSTRAINT "Decision_opusId_fkey";
    END IF;

    -- Recreate with Cascade
    ALTER TABLE "Decision" 
        ADD CONSTRAINT "Decision_itemId_fkey" 
        FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "Decision" 
        ADD CONSTRAINT "Decision_opusId_fkey" 
        FOREIGN KEY ("opusId") REFERENCES "Opus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

-- Step 4: Add userId foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Decision_userId_fkey') THEN
        ALTER TABLE "Decision" 
        ADD CONSTRAINT "Decision_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 5: Create new indexes
CREATE INDEX IF NOT EXISTS "Decision_opusId_idx" ON "Decision"("opusId");
CREATE INDEX IF NOT EXISTS "Decision_userId_idx" ON "Decision"("userId");
CREATE INDEX IF NOT EXISTS "Decision_isTrainingData_idx" ON "Decision"("isTrainingData");
CREATE INDEX IF NOT EXISTS "Decision_agentType_reward_idx" ON "Decision"("agentType", "reward");
CREATE INDEX IF NOT EXISTS "Decision_modelVersion_createdAt_idx" ON "Decision"("modelVersion", "createdAt");

-- Step 6: Migrate existing data - set userId from item's createdByUserId
UPDATE "Decision" d
SET "userId" = i."createdByUserId"
FROM "Item" i
WHERE d."itemId" = i."id" AND d."userId" IS NULL;

-- Step 7: Make userId NOT NULL after migration (if all records have userId)
-- Note: This will fail if there are decisions without items, so we'll keep it nullable for now
-- You can manually set userId for any remaining nulls and then make it NOT NULL in a future migration

-- Step 8: Remove default from modelVersion after ensuring all records have it
ALTER TABLE "Decision" ALTER COLUMN "modelVersion" DROP DEFAULT;
