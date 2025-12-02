-- Add Decision model for RL training data

-- Step 1: Create AgentType enum
CREATE TYPE "AgentType" AS ENUM ('FILER', 'LIBRARIAN', 'PRIORITIZER', 'STORER', 'RETRIEVER', 'GUARDRAIL');

-- Step 2: Create Decision table
CREATE TABLE IF NOT EXISTS "Decision" (
    "id" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "state" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "reward" DOUBLE PRECISION,
    "nextState" JSONB,
    "itemId" TEXT,
    "opusId" TEXT,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "userFeedback" "Feedback",
    "userCorrection" JSONB,
    "outcomeMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardComputedAt" TIMESTAMP(3),

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS "Decision_agentType_createdAt_idx" ON "Decision"("agentType", "createdAt");
CREATE INDEX IF NOT EXISTS "Decision_itemId_idx" ON "Decision"("itemId");
CREATE INDEX IF NOT EXISTS "Decision_reward_idx" ON "Decision"("reward");
CREATE INDEX IF NOT EXISTS "Decision_userFeedback_idx" ON "Decision"("userFeedback");
CREATE INDEX IF NOT EXISTS "Decision_rewardComputedAt_idx" ON "Decision"("rewardComputedAt");

-- Step 4: Add foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Decision_itemId_fkey'
    ) THEN
        ALTER TABLE "Decision" 
        ADD CONSTRAINT "Decision_itemId_fkey" 
        FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Decision_opusId_fkey'
    ) THEN
        ALTER TABLE "Decision" 
        ADD CONSTRAINT "Decision_opusId_fkey" 
        FOREIGN KEY ("opusId") REFERENCES "Opus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
