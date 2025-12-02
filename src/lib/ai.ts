import OpenAI from "openai"
import { recordDecision, type DecisionState, type DecisionAction } from "./decision-recorder"
import { AgentType } from "@prisma/client"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const FILER_SYSTEM_PROMPT = `
You are the "Filer" AI for a personal project management system (OCD - Opus Corpus Documenter). Your job is to act as a natural language parser.
You will be given the human's original Instructions, any supplemental routing notes, the project this item was routed to,
and the list of all known projects.

Return a single JSON object with the keys: "swimlane", "priority", "labels", "urgency", "reasoning", and "confidence".

Rules:
1. swimlane (string):
   - "Expedite": if instructions imply urgency, external interrupt, bug, stakeholder request, or "wife" task.
   - "Home": if instructions imply a domestic or personal errand.
   - "Habit": if instructions imply a recurring personal development task (study, content creation, etc.).
   - "Project": default for standard project-related work.
2. priority (string):
   - "High" if swimlane is "Expedite" or "Home".
   - "Medium" if swimlane is "Project".
   - "Low" if swimlane is "Habit".
3. labels (array of strings):
   - Add "Job 1 (Income)" if instructions reference Latina, AI Refill, IngePro, Tragaldabas, or Candidatos.
   - Add "Job 2 (Authority)" if instructions reference Portfolio, GitHub Green, Data Science, or Content Creation.
   - Add the matching project name if instructions reference a known project.
4. urgency (string):
   - Must be either "To Do" or "On Hold". Pick "To Do" for items that should move forward immediately; otherwise "On Hold".
5. reasoning (string):
   - Provide a clear, concise explanation of why you made this classification. Include specific keywords or patterns from the instructions that led to your decision.
   - Example: "Classified as Expedite because instructions mention 'urgent' and 'stakeholder request'"
6. confidence (number):
   - A value between 0.0 and 1.0 indicating how confident you are in this classification.
   - 1.0 = very clear indicators, unambiguous
   - 0.7-0.9 = strong indicators but some ambiguity
   - 0.5-0.7 = moderate indicators, some uncertainty
   - 0.3-0.5 = weak indicators, significant uncertainty
   - <0.3 = very uncertain

You must return only the raw JSON object. Do not include Markdown, commentary, or additional text.
`

const LIBRARIAN_SYSTEM_PROMPT = `
You are an AI Project Analyst. Your job is to analyze a new, incoming task (New_Item) against its surrounding context,
which includes the project's strategic goals (Strategic_Context) and all other existing tasks in the same project (Corpus).

Look for Conflicts, Dependencies, Relations, Redundancies, or Suggestions as defined:
1. Conflict: New item violates a strategic goal.
2. Redundancy: New item duplicates existing work.
3. Relation: New item is logically related to other items.
4. Dependency: New item depends on another item being completed first.
5. Suggestion: Any actionable insight that helps clarify next steps.

Return only a JSON array. Each element must have "type" (Conflict | Dependency | Redundancy | Relation | Suggestion)
and "text" (brief, direct explanation).

If you find nothing, return [].
`

export type FilerResponse = {
  swimlane: string
  priority: string
  labels: string[]
  urgency: "To Do" | "On Hold"
  reasoning: string
  confidence: number
}

export async function callAIFiler(input: Record<string, unknown>): Promise<FilerResponse | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not configured; skipping AI Filer.")
    return null
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: FILER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) }
      ],
      max_output_tokens: 400
    })

    const output = response.output_text.trim()
    const parsed = JSON.parse(output)

    if (
      typeof parsed.swimlane !== "string" ||
      typeof parsed.priority !== "string" ||
      !Array.isArray(parsed.labels) ||
      (parsed.urgency !== "To Do" && parsed.urgency !== "On Hold") ||
      typeof parsed.reasoning !== "string" ||
      typeof parsed.confidence !== "number"
    ) {
      throw new Error("Invalid Filer response")
    }

    // Clamp confidence to 0.0-1.0 range
    const confidence = Math.max(0.0, Math.min(1.0, parsed.confidence))

    return {
      swimlane: parsed.swimlane,
      priority: parsed.priority,
      labels: parsed.labels,
      urgency: parsed.urgency,
      reasoning: parsed.reasoning,
      confidence
    }
  } catch (error) {
    console.error("AI Filer failed:", error)
    return null
  }
}

export type LibrarianFinding = {
  type: string
  text: string
}

export async function callAILibrarian(input: Record<string, unknown>): Promise<LibrarianFinding[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not configured; skipping AI Librarian.")
    return []
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: LIBRARIAN_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(input) }
      ],
      max_output_tokens: 600
    })

    const output = response.output_text.trim()
    const parsed = JSON.parse(output)

    if (!Array.isArray(parsed)) {
      throw new Error("Invalid Librarian response")
    }

    return parsed.filter((finding: LibrarianFinding) => finding?.type && finding?.text)
  } catch (error) {
    console.error("AI Librarian failed:", error)
    return []
  }
}

