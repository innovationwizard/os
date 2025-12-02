import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AgentType, Feedback } from "@prisma/client"
import { getAvailableVersions } from "@/lib/model-registry"

/**
 * Get A/B test statistics comparing model versions
 * GET /api/training/ab-test?agentType=FILER
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const agentTypeParam = searchParams.get("agentType")

  if (!agentTypeParam || !Object.values(AgentType).includes(agentTypeParam as AgentType)) {
    return NextResponse.json(
      { error: "Valid agentType is required" },
      { status: 400 }
    )
  }

  const agentType = agentTypeParam as AgentType
  const availableVersions = getAvailableVersions(agentType)

  if (availableVersions.length < 2) {
    return NextResponse.json({
      agentType,
      abTestingEnabled: false,
      message: "A/B testing not enabled (only one version configured)",
      versions: availableVersions.map(v => ({
        version: v.version,
        description: v.description,
        weight: v.weight
      }))
    })
  }

  // Get statistics for each version
  const versionStats = await Promise.all(
    availableVersions.map(async (config) => {
      const where = {
        userId: session.user.id,
        agentType,
        modelVersion: config.version
      }

      const [
        totalDecisions,
        decisionsWithReward,
        decisionsWithFeedback,
        avgRewardResult,
        confirmedCount,
        correctedCount,
        ignoredCount,
        avgConfidenceResult
      ] = await Promise.all([
        prisma.decision.count({ where }),
        prisma.decision.count({ where: { ...where, reward: { not: null } } }),
        prisma.decision.count({ where: { ...where, userFeedback: { not: null } } }),
        prisma.decision.aggregate({
          where: { ...where, reward: { not: null } },
          _avg: { reward: true }
        }),
        prisma.decision.count({ where: { ...where, userFeedback: Feedback.CONFIRMED } }),
        prisma.decision.count({ where: { ...where, userFeedback: Feedback.CORRECTED } }),
        prisma.decision.count({ where: { ...where, userFeedback: Feedback.IGNORED } }),
        prisma.decision.aggregate({
          where: { ...where, confidence: { not: null } },
          _avg: { confidence: true }
        })
      ])

      const avgReward = avgRewardResult._avg.reward || null
      const avgConfidence = avgConfidenceResult._avg.confidence || null

      // Calculate acceptance rate (confirmed / (confirmed + corrected))
      const totalFeedback = confirmedCount + correctedCount
      const acceptanceRate = totalFeedback > 0
        ? confirmedCount / totalFeedback
        : null

      return {
        version: config.version,
        description: config.description,
        weight: config.weight,
        stats: {
          totalDecisions,
          decisionsWithReward,
          decisionsWithFeedback,
          avgReward,
          avgConfidence,
          acceptanceRate,
          feedbackBreakdown: {
            confirmed: confirmedCount,
            corrected: correctedCount,
            ignored: ignoredCount
          }
        }
      }
    })
  )

  // Calculate overall statistics for comparison
  const totalDecisionsAll = versionStats.reduce((sum, v) => sum + v.stats.totalDecisions, 0)
  const totalRewardsAll = versionStats.reduce((sum, v) => sum + v.stats.decisionsWithReward, 0)
  const avgRewardAll = versionStats
    .filter(v => v.stats.avgReward !== null)
    .reduce((sum, v) => sum + (v.stats.avgReward || 0) * v.stats.decisionsWithReward, 0) / totalRewardsAll || null

  return NextResponse.json({
    agentType,
    abTestingEnabled: true,
    totalDecisions: totalDecisionsAll,
    overallAvgReward: avgRewardAll,
    versions: versionStats,
    comparison: {
      bestReward: versionStats.reduce((best, v) => 
        (v.stats.avgReward || -Infinity) > (best.stats.avgReward || -Infinity) ? v : best,
        versionStats[0]
      ),
      bestAcceptanceRate: versionStats.reduce((best, v) => 
        (v.stats.acceptanceRate || -Infinity) > (best.stats.acceptanceRate || -Infinity) ? v : best,
        versionStats[0]
      ),
      mostDecisions: versionStats.reduce((most, v) => 
        v.stats.totalDecisions > most.stats.totalDecisions ? v : most,
        versionStats[0]
      )
    }
  })
}
