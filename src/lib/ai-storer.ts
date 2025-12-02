import OpenAI from "openai"
import { recordDecision, type DecisionState, type DecisionAction } from "./decision-recorder"
import { getModelVersion } from "./model-registry"
import { AgentType } from "@prisma/client"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const STORER_SYSTEM_PROMPT = `
You are the "Storer" AI for a personal project management system. Your job is to decide how to integrate completed Items into their Opus.

You will be given:
- Completed Item (title, content, labels, outcome metrics)
- Target Opus (full content, structure, existing sections)
- Previous integration patterns for this Opus

Return a single JSON object with:
- "integration_location": Where in Opus (section name or "end" or "new_section:SectionName")
- "integration_method": One of "APPEND", "MERGE", "CREATE_SECTION", "REPLACE"
- "confidence": A value between 0.0 and 1.0
- "reasoning": Clear explanation of why this integration approach

Consider:
1. Semantic coherence (does it fit with existing content?)
2. Document structure (should it be a new section or merged?)
3. Findability (will it be easy to locate later?)
4. Avoiding duplication

You must return only the raw JSON object. Do not include Markdown, commentary, or additional text.
`

export type StorerResponse = {
  integration_location: string
  integration_method: "APPEND" | "MERGE" | "CREATE_SECTION" | "REPLACE"
  confidence: number
  reasoning: string
}

export interface StorerInput {
  completedItem: {
    id: string
    title: string
    content: string
    labels: string[]
    outcomeMetrics?: {
      completedSuccessfully: boolean
      timeToComplete?: number
    }
  }
  targetOpus: {
    id: string
    name: string
    content: string
    structure?: {
      sections: Array<{ name: string; startIndex: number; endIndex: number }>
    }
  }
  previousIntegrations?: Array<{
    location: string
    method: string
    itemTitle: string
  }>
}

export async function callAIStorer(
  input: StorerInput,
  userId: string
): Promise<{ decision: StorerResponse | null; decisionId: string | null }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not configured; skipping AI Storer.")
    return { decision: null, decisionId: null }
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: STORER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) }
      ],
      max_output_tokens: 500
    })

    const output = response.output_text.trim()
    const parsed = JSON.parse(output)

    if (
      typeof parsed.integration_location !== "string" ||
      !["APPEND", "MERGE", "CREATE_SECTION", "REPLACE"].includes(parsed.integration_method) ||
      typeof parsed.confidence !== "number" ||
      typeof parsed.reasoning !== "string"
    ) {
      throw new Error("Invalid Storer response")
    }

    const decision: StorerResponse = {
      integration_location: parsed.integration_location,
      integration_method: parsed.integration_method,
      confidence: Math.max(0.0, Math.min(1.0, parsed.confidence)),
      reasoning: parsed.reasoning
    }

    // Record decision for RL training
    const state: DecisionState = {
      completedItem: input.completedItem,
      targetOpus: {
        id: input.targetOpus.id,
        name: input.targetOpus.name,
        contentLength: input.targetOpus.content.length,
        structure: input.targetOpus.structure
      },
      previousIntegrations: input.previousIntegrations
    }

    const action: DecisionAction = {
      integration_location: decision.integration_location,
      integration_method: decision.integration_method,
      confidence: decision.confidence
    }

    const recordedDecision = await recordDecision({
      agentType: AgentType.STORER,
      state,
      action,
      userId,
      modelVersion: getModelVersion(AgentType.STORER),
      itemId: input.completedItem.id,
      opusId: input.targetOpus.id,
      confidence: decision.confidence,
      reasoning: decision.reasoning
    })

    return { decision, decisionId: recordedDecision.id }
  } catch (error) {
    console.error("AI Storer failed:", error)
    return { decision: null, decisionId: null }
  }
}
