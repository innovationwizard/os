import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { callAIPrioritizer } from "@/lib/ai-prioritizer"
import type { PrioritizerInput } from "@/lib/ai-prioritizer"

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { input, userId } = await request.json()

    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!input || !input.todoItems || input.todoItems.length === 0) {
      return NextResponse.json(
        { error: "No TODO items provided" },
        { status: 400 }
      )
    }

    const result = await callAIPrioritizer(input as PrioritizerInput, session.user.id)

    if (!result.decision || !result.decisionId) {
      return NextResponse.json(
        { error: "Failed to get recommendation" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      recommended_item_id: result.decision.recommended_item_id,
      confidence: result.decision.confidence,
      reasoning: result.decision.reasoning,
      decisionId: result.decisionId
    })
  } catch (error) {
    console.error("AI Prioritizer error:", error)
    return NextResponse.json(
      { error: "Failed to get recommendation", details: String(error) },
      { status: 500 }
    )
  }
}
