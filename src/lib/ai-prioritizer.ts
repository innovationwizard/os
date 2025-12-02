import OpenAI from "openai"
import { recordDecision, type DecisionState, type DecisionAction } from "./decision-recorder"
import { getModelVersion } from "./model-registry"
import { AgentType } from "@prisma/client"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const PRIORITIZER_SYSTEM_PROMPT = `
You are the "Prioritizer" AI for a personal project management system. Your job is to select the next Item to work on from all available TODO items.

You will be given:
- All TODO items (with their swimlane, priority, labels, age, and context)
- Current context (time of day, recent work patterns)
- Strategic goals (monetization, portfolio building, authority building)
- External constraints (deadlines, stakeholder expectations)

Return a single JSON object with:
- "recommended_item_id": The ID of the Item to pull to CREATING
- "confidence": A value between 0.0 and 1.0 indicating confidence
- "reasoning": Clear explanation of why this Item should be worked on now

Consider:
1. Strategic alignment (Job 1 Income vs Job 2 Authority)
2. Urgency vs Importance balance
3. Energy/time of day matching
4. Dependencies and blockers
5. Recent work patterns (avoid context switching)

You must return only the raw JSON object. Do not include Markdown, commentary, or additional text.
`

export type PrioritizerResponse = {
  recommended_item_id: string
  confidence: number
  reasoning: string
}

export interface PrioritizerInput {
  todoItems: Array<{
    id: string
    title: string
    swimlane: string
    priority: string
    labels: string[]
    age: number // days since statusChangedAt
    opusName?: string
  }>
  currentContext: {
    timeOfDay?: string
    recentWork?: string[]
    energyLevel?: "high" | "medium" | "low"
  }
  strategicGoals: {
    monetization?: string[]
    portfolio?: string[]
    authority?: string[]
  }
  constraints?: {
    deadlines?: Array<{ itemId: string; deadline: string }>
    stakeholderRequests?: string[]
  }
}

export async function callAIPrioritizer(
  input: PrioritizerInput,
  userId: string
): Promise<{ decision: PrioritizerResponse | null; decisionId: string | null }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not configured; skipping AI Prioritizer.")
    return { decision: null, decisionId: null }
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: PRIORITIZER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) }
      ],
      max_output_tokens: 400
    })

    const output = response.output_text.trim()
    const parsed = JSON.parse(output)

    if (
      typeof parsed.recommended_item_id !== "string" ||
      typeof parsed.confidence !== "number" ||
      typeof parsed.reasoning !== "string"
    ) {
      throw new Error("Invalid Prioritizer response")
    }

    const decision: PrioritizerResponse = {
      recommended_item_id: parsed.recommended_item_id,
      confidence: Math.max(0.0, Math.min(1.0, parsed.confidence)),
      reasoning: parsed.reasoning
    }

    // Record decision for RL training
    const state: DecisionState = {
      todoItems: input.todoItems,
      currentContext: input.currentContext,
      strategicGoals: input.strategicGoals,
      constraints: input.constraints
    }

    const action: DecisionAction = {
      recommended_item_id: decision.recommended_item_id,
      confidence: decision.confidence
    }

    const recordedDecision = await recordDecision({
      agentType: AgentType.PRIORITIZER,
      state,
      action,
      userId,
      modelVersion: getModelVersion(AgentType.PRIORITIZER),
      itemId: decision.recommended_item_id,
      confidence: decision.confidence,
      reasoning: decision.reasoning
    })

    return { decision, decisionId: recordedDecision.id }
  } catch (error) {
    console.error("AI Prioritizer failed:", error)
    return { decision: null, decisionId: null }
  }
}
