import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AgentType, Feedback } from "@prisma/client"
import { calculateRewardForDecision, calculatePendingRewards } from "@/lib/reward-calculator"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const agentType = searchParams.get("agentType") as AgentType | null
  const minReward = parseFloat(searchParams.get("minReward") || "-2.0")
  const maxReward = parseFloat(searchParams.get("maxReward") || "2.0")
  const requireFeedback = searchParams.get("requireFeedback") === "true"
  const requireReward = searchParams.get("requireReward") === "true"
  const limit = parseInt(searchParams.get("limit") || "1000")

  const where: {
    item?: {
      createdByUserId: string
    }
    agentType?: AgentType
    reward?: {
      gte?: number
      lte?: number
    }
    userFeedback?: {
      not: null
    }
  } = {
    item: {
      createdByUserId: session.user.id
    }
  }

  if (agentType && Object.values(AgentType).includes(agentType)) {
    where.agentType = agentType
  }

  if (requireReward) {
    where.reward = {
      gte: minReward,
      lte: maxReward
    }
  }

  if (requireFeedback) {
    where.userFeedback = { not: null }
  }

  const decisions = await prisma.decision.findMany({
    where,
    include: {
      item: {
        select: {
          id: true,
          title: true,
          status: true
        }
      },
      opus: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  })

  return NextResponse.json(decisions)
}

/**
 * Calculate and update rewards for decisions that have outcomes
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { decisionIds } = await request.json()

  if (!Array.isArray(decisionIds)) {
    return NextResponse.json({ error: "decisionIds must be an array" }, { status: 400 })
  }

  const decisions = await prisma.decision.findMany({
    where: {
      id: { in: decisionIds },
      item: {
        createdByUserId: session.user.id
      },
      reward: null // Only calculate for decisions without rewards
    },
    include: {
      item: {
        select: {
          id: true,
          status: true,
          cycleCount: true,
          blockedAt: true,
          totalTimeInCreate: true,
          completedAt: true,
          startedAt: true
        }
      }
    }
  })

  const updated = []

  for (const decision of decisions) {
    if (!decision.item) continue

    const item = decision.item
    const outcomeMetrics = {
      completedSuccessfully: item.status === "DONE" || item.status === "COMPENDIUM",
      cycleCount: item.cycleCount,
      blockedAt: item.blockedAt,
      totalTimeInCreate: item.totalTimeInCreate,
      timeToComplete: item.completedAt && item.startedAt
        ? Math.floor((item.completedAt.getTime() - item.startedAt.getTime()) / (1000 * 60))
        : null
    }

    // Update outcome metrics first
    await prisma.decision.update({
      where: { id: decision.id },
      data: {
        outcomeMetrics: outcomeMetrics as any,
        outcomeObservedAt: new Date()
      }
    })

    // Fetch updated decision with item relation and calculate reward
    const updatedDecision = await prisma.decision.findUnique({
      where: { id: decision.id },
      include: { item: true }
    })

    if (!updatedDecision) continue

    const rewardResult = await calculateRewardForDecision(updatedDecision)

    updated.push({
      id: decision.id,
      reward: rewardResult.reward,
      components: rewardResult.components
    })
  }

  return NextResponse.json({ updated: updated.length, decisions: updated })
}
