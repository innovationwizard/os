-- Add OpusTypeConfig table for dynamic opus type management
-- Change Opus.opusType from enum to String

-- Step 1: Create OpusTypeConfig table
CREATE TABLE IF NOT EXISTS "OpusTypeConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'FolderKanban',
    "color" TEXT NOT NULL DEFAULT 'bg-blue-100',
    "textColor" TEXT NOT NULL DEFAULT 'text-blue-700',
    "description" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpusTypeConfig_pkey" PRIMARY KEY ("id")
);

-- Step 2: Create unique constraint on key
CREATE UNIQUE INDEX IF NOT EXISTS "OpusTypeConfig_key_key" ON "OpusTypeConfig"("key");

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS "OpusTypeConfig_isActive_idx" ON "OpusTypeConfig"("isActive");
CREATE INDEX IF NOT EXISTS "OpusTypeConfig_isBuiltIn_idx" ON "OpusTypeConfig"("isBuiltIn");

-- Step 4: Add foreign key for createdByUserId
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'OpusTypeConfig_createdByUserId_fkey'
    ) THEN
        ALTER TABLE "OpusTypeConfig" 
        ADD CONSTRAINT "OpusTypeConfig_createdByUserId_fkey" 
        FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 5: Change Opus.opusType from enum to String
-- First, add a new column with String type
ALTER TABLE "Opus" ADD COLUMN IF NOT EXISTS "opusType_new" TEXT;

-- Step 6: Migrate existing data from enum to string
UPDATE "Opus" SET "opusType_new" = "opusType"::text;

-- Step 7: Drop the old enum column and rename the new one
ALTER TABLE "Opus" DROP COLUMN IF EXISTS "opusType";
ALTER TABLE "Opus" RENAME COLUMN "opusType_new" TO "opusType";

-- Step 8: Set default value
ALTER TABLE "Opus" ALTER COLUMN "opusType" SET DEFAULT 'PROJECT';

-- Step 9: Insert built-in opus type configs
-- Using simple IDs based on key for consistency
INSERT INTO "OpusTypeConfig" ("id", "key", "label", "icon", "color", "textColor", "description", "isBuiltIn", "isActive", "createdByUserId", "createdAt", "updatedAt")
VALUES
    ('builtin-project', 'PROJECT', 'Project', 'FolderKanban', 'bg-blue-100', 'text-blue-700', 'Active development project', true, true, NULL, NOW(), NOW()),
    ('builtin-book', 'BOOK', 'Book', 'BookOpen', 'bg-purple-100', 'text-purple-700', 'Written work', true, true, NULL, NOW(), NOW()),
    ('builtin-context', 'CONTEXT', 'Context', 'FileText', 'bg-slate-100', 'text-slate-700', 'Strategic documents', true, true, NULL, NOW(), NOW()),
    ('builtin-codebase', 'CODEBASE', 'Codebase', 'Code', 'bg-green-100', 'text-green-700', 'Software repositories', true, true, NULL, NOW(), NOW()),
    ('builtin-workshop', 'WORKSHOP', 'Workshop', 'GraduationCap', 'bg-amber-100', 'text-amber-700', 'Educational content', true, true, NULL, NOW(), NOW()),
    ('builtin-application', 'APPLICATION', 'Application', 'Briefcase', 'bg-rose-100', 'text-rose-700', 'Job applications', true, true, NULL, NOW(), NOW()),
    ('builtin-portfolio', 'PORTFOLIO', 'Portfolio', 'Sparkles', 'bg-indigo-100', 'text-indigo-700', 'Portfolio pieces', true, true, NULL, NOW(), NOW()),
    ('builtin-research', 'RESEARCH', 'Research', 'Search', 'bg-teal-100', 'text-teal-700', 'Research projects', true, true, NULL, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
