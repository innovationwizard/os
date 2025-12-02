import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { AgentType } from "@prisma/client"
import { FILER_SYSTEM_PROMPT } from "@/lib/ai"
import { exportTrainingData } from "@/lib/training-export"

/**
 * Export training data in JSONL format for RL fine-tuning
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const agentType = searchParams.get("agentType") as AgentType | null
  const minReward = parseFloat(searchParams.get("minReward") || "-2.0")
  const requireReward = searchParams.get("requireReward") === "true"
  const requireFeedback = searchParams.get("requireFeedback") === "true"
  const limit = parseInt(searchParams.get("limit") || "1000")

  const where: {
    item?: {
      createdByUserId: string
    }
    agentType?: AgentType
    reward?: {
      gte?: number
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
      gte: minReward
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
          title: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  })

  // Format as training data (JSONL)
  const trainingData = decisions.map((decision) => {
    // Format depends on agent type
    let messages: Array<{ role: string; content: string }> = []
    let systemPrompt = ""

    switch (decision.agentType) {
      case AgentType.FILER:
        systemPrompt = FILER_SYSTEM_PROMPT.trim()
        messages = [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: JSON.stringify(decision.state)
          },
          {
            role: "assistant",
            content: JSON.stringify({
              ...decision.action,
              reasoning: decision.reasoning,
              confidence: decision.confidence
            })
          }
        ]
        break

      case AgentType.PRIORITIZER:
        systemPrompt = "You are the Prioritizer AI. Select the next Item to work on."
        messages = [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: JSON.stringify(decision.state)
          },
          {
            role: "assistant",
            content: JSON.stringify({
              recommended_item_id: (decision.action as any).recommended_item_id,
              reasoning: decision.reasoning,
              confidence: decision.confidence
            })
          }
        ]
        break

      // Add other agent types as needed
      default:
        messages = [
          {
            role: "system",
            content: `You are the ${decision.agentType} AI agent.`
          },
          {
            role: "user",
            content: JSON.stringify(decision.state)
          },
          {
            role: "assistant",
            content: JSON.stringify({
              ...decision.action,
              reasoning: decision.reasoning
            })
          }
        ]
    }

    return {
      messages,
      reward: decision.reward ?? 0,
      metadata: {
        decisionId: decision.id,
        agentType: decision.agentType,
        itemId: decision.itemId,
        opusId: decision.opusId,
        userFeedback: decision.userFeedback,
        userCorrection: decision.userCorrection,
        outcomeMetrics: decision.outcomeMetrics,
        createdAt: decision.createdAt.toISOString(),
        rewardComputedAt: decision.rewardComputedAt?.toISOString()
      }
    }
  })

  // Return as JSONL format (newline-delimited JSON)
  const jsonl = trainingData.map((entry) => JSON.stringify(entry)).join("\n")

  return new NextResponse(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": `attachment; filename="training-data-${agentType || "all"}-${Date.now()}.jsonl"`
    }
  })
}
