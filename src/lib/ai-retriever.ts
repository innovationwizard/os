import OpenAI from "openai"
import { recordDecision, type DecisionState, type DecisionAction } from "./decision-recorder"
import { getModelVersion } from "./model-registry"
import { AgentType } from "@prisma/client"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const RETRIEVER_SYSTEM_PROMPT = `
You are the "Retriever" AI for a personal project management system. Your job is to generate dynamic documents or answer queries from the Opus Corpus.

You will be given:
- User query or request (e.g., "Generate Resume for Company X")
- Relevant Opuses (via semantic search)
- Request parameters (company, position, requirements, etc.)

Return a single JSON object with:
- "generated_document": The complete generated document text
- "source_citations": Array of {opusId, opusName, section} indicating which Opuses contributed
- "confidence": A value between 0.0 and 1.0
- "reasoning": Brief explanation of sources used and approach

Rules:
1. Only use information from provided Opuses - do not hallucinate
2. Maintain the user's writing style and voice
3. Be comprehensive but concise
4. Cite all sources clearly

You must return only the raw JSON object. Do not include Markdown, commentary, or additional text.
`

export type RetrieverResponse = {
  generated_document: string
  source_citations: Array<{
    opusId: string
    opusName: string
    section?: string
  }>
  confidence: number
  reasoning: string
}

export interface RetrieverInput {
  query: string
  relevantOpuses: Array<{
    id: string
    name: string
    content: string
    opusType: string
    sections?: Array<{ name: string; content: string }>
  }>
  parameters?: {
    company?: string
    position?: string
    requirements?: string[]
    [key: string]: unknown
  }
}

export async function callAIRetriever(
  input: RetrieverInput,
  userId: string
): Promise<{ decision: RetrieverResponse | null; decisionId: string | null }> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not configured; skipping AI Retriever.")
    return { decision: null, decisionId: null }
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: RETRIEVER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) }
      ],
      max_output_tokens: 2000
    })

    const output = response.output_text.trim()
    const parsed = JSON.parse(output)

    if (
      typeof parsed.generated_document !== "string" ||
      !Array.isArray(parsed.source_citations) ||
      typeof parsed.confidence !== "number" ||
      typeof parsed.reasoning !== "string"
    ) {
      throw new Error("Invalid Retriever response")
    }

    const decision: RetrieverResponse = {
      generated_document: parsed.generated_document,
      source_citations: parsed.source_citations,
      confidence: Math.max(0.0, Math.min(1.0, parsed.confidence)),
      reasoning: parsed.reasoning
    }

    // Record decision for RL training
    const state: DecisionState = {
      query: input.query,
      relevantOpuses: input.relevantOpuses.map(o => ({
        id: o.id,
        name: o.name,
        opusType: o.opusType,
        contentLength: o.content.length
      })),
      parameters: input.parameters
    }

    const action: DecisionAction = {
      generated_document_length: decision.generated_document.length,
      source_citations_count: decision.source_citations.length,
      confidence: decision.confidence
    }

    const recordedDecision = await recordDecision({
      agentType: AgentType.RETRIEVER,
      state,
      action,
      userId,
      modelVersion: getModelVersion(AgentType.RETRIEVER),
      opusId: input.relevantOpuses[0]?.id,
      confidence: decision.confidence,
      reasoning: decision.reasoning
    })

    return { decision, decisionId: recordedDecision.id }
  } catch (error) {
    console.error("AI Retriever failed:", error)
    return { decision: null, decisionId: null }
  }
}
