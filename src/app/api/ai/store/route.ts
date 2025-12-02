import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { callAIStorer } from "@/lib/ai-storer"
import type { StorerInput } from "@/lib/ai-storer"

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

    if (!input || !input.completedItem || !input.targetOpus) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const result = await callAIStorer(input as StorerInput, session.user.id)

    if (!result.decision || !result.decisionId) {
      return NextResponse.json(
        { error: "Failed to get integration suggestion" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      integrationDecision: result.decision.integrationDecision,
      location: result.decision.integration_location,
      method: result.decision.integration_method,
      newSectionHeading: result.decision.integration_location?.startsWith("NEW_SECTION:")
        ? result.decision.integration_location.replace("NEW_SECTION:", "")
        : null,
      suggestedContent: null, // Would need to generate this
      confidence: result.decision.confidence,
      reasoning: result.decision.reasoning,
      decisionId: result.decisionId
    })
  } catch (error) {
    console.error("AI Storer error:", error)
    return NextResponse.json(
      { error: "Failed to get integration suggestion", details: String(error) },
      { status: 500 }
    )
  }
}
