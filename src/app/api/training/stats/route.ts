import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AgentType } from "@prisma/client"

/**
 * Get training statistics for decisions
 * GET /api/training/stats?agentType=FILER
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const agentType = searchParams.get("agentType") as AgentType | null

  const where: {
    userId: string
    agentType?: AgentType
  } = {
    userId: session.user.id
  }

  if (agentType && Object.values(AgentType).includes(agentType)) {
    where.agentType = agentType
  }

  // Get total decisions
  const totalDecisions = await prisma.decision.count({
    where
  })

  // Get decisions with rewards
  const decisionsWithReward = await prisma.decision.count({
    where: {
      ...where,
      reward: { not: null }
    }
  })

  // Get decisions with feedback
  const decisionsWithFeedback = await prisma.decision.count({
    where: {
      ...where,
      userFeedback: { not: null }
    }
  })

  // Get decisions by agent type
  const byAgentType = await prisma.decision.groupBy({
    by: ["agentType"],
    where: {
      userId: session.user.id
    },
    _count: {
      id: true
    }
  })

  // Get average reward
  const avgRewardResult = await prisma.decision.aggregate({
    where: {
      ...where,
      reward: { not: null }
    },
    _avg: {
      reward: true
    }
  })

  // Calculate progress (blocks of 100)
  const progressBlocks = Math.floor(totalDecisions / 100)
  const progressInCurrentBlock = totalDecisions % 100
  const progressPercentage = (progressInCurrentBlock / 100) * 100

  return NextResponse.json({
    totalDecisions,
    decisionsWithReward,
    decisionsWithFeedback,
    avgReward: avgRewardResult._avg.reward || 0,
    progressBlocks,
    progressInCurrentBlock,
    progressPercentage,
    byAgentType: byAgentType.reduce((acc, item) => {
      acc[item.agentType] = item._count.id
      return acc
    }, {} as Record<string, number>),
    readyForTraining: totalDecisions >= 100 && decisionsWithReward >= 50 // At least 50 with rewards
  })
}
