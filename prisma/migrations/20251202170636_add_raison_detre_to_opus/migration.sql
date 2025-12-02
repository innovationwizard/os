/*
  Warnings:

  - Made the column `userId` on table `Decision` required. This step will fail if there are existing NULL values in that column.
  - Made the column `opusType` on table `Opus` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Decision_rewardComputedAt_idx";

-- DropIndex
DROP INDEX "Decision_userFeedback_idx";

-- AlterTable
ALTER TABLE "Decision" ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Opus" ADD COLUMN     "raisonDetre" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "opusType" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Opus_opusType_idx" ON "Opus"("opusType");
