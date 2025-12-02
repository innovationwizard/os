import { prisma } from "./prisma"
import { AgentType } from "@prisma/client"
import fs from "fs"
import path from "path"
import { FILER_SYSTEM_PROMPT } from "./ai"

export interface TrainingExample {
  prompt: string
  completion: string
  reward: number
  confidence: number | null
  metadata: {
    decisionId: string
    itemId: string | null
    opusId: string | null
    userFeedback: string | null
    rewardComponents: any
    createdAt: string
  }
}

export interface ExportStats {
  count: number
  avgReward: number
  confirmedCount: number
  correctedCount: number
  ignoredCount: number
  minReward: number
  maxReward: number
}

/**
 * Export training data for a specific agent type
 */
export async function exportTrainingData(
  agentType: AgentType,
  outputPath: string,
  options: {
    limit?: number
    minReward?: number
    requireFeedback?: boolean
    requireReward?: boolean
  } = {}
): Promise<ExportStats> {
  const {
    limit = 1000,
    minReward = -2.0,
    requireFeedback = false,
    requireReward = true
  } = options

  const where: any = {
    agentType,
    isTrainingData: true
  }

  if (requireReward) {
    where.reward = { not: null, gte: minReward }
  }

  if (requireFeedback) {
    where.userFeedback = { not: null }
  }

  const decisions = await prisma.decision.findMany({
    where,
    include: {
      item: true,
      opus: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  })

  console.log(`Exporting ${decisions.length} training examples for ${agentType}`)

  // Format for TRL
  const trainingExamples = decisions.map(decision => {
    const prompt = formatPrompt(agentType, decision.state as any)
    const completion = formatCompletion(agentType, decision.action as any)

    return {
      prompt,
      completion,
      reward: decision.reward || 0,
      confidence: decision.confidence,
      metadata: {
        decisionId: decision.id,
        itemId: decision.itemId,
        opusId: decision.opusId,
        userFeedback: decision.userFeedback,
        rewardComponents: decision.rewardComponents,
        createdAt: decision.createdAt.toISOString()
      }
    } as TrainingExample
  })

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write JSONL
  const jsonl = trainingExamples.map(ex => JSON.stringify(ex)).join("\n")
  fs.writeFileSync(outputPath, jsonl)

  console.log(`Wrote training data to ${outputPath}`)

  // Calculate statistics
  const rewards = trainingExamples.map(ex => ex.reward).filter(r => r !== null) as number[]
  const avgReward = rewards.length > 0
    ? rewards.reduce((sum, r) => sum + r, 0) / rewards.length
    : 0

  const confirmedCount = trainingExamples.filter(
    ex => ex.metadata.userFeedback === "CONFIRMED"
  ).length
  const correctedCount = trainingExamples.filter(
    ex => ex.metadata.userFeedback === "CORRECTED"
  ).length
  const ignoredCount = trainingExamples.filter(
    ex => ex.metadata.userFeedback === "IGNORED"
  ).length

  const minReward = rewards.length > 0 ? Math.min(...rewards) : 0
  const maxReward = rewards.length > 0 ? Math.max(...rewards) : 0

  const stats: ExportStats = {
    count: trainingExamples.length,
    avgReward,
    confirmedCount,
    correctedCount,
    ignoredCount,
    minReward,
    maxReward
  }

  console.log(`Average reward: ${avgReward.toFixed(3)}`)
  console.log(`Reward range: [${minReward.toFixed(3)}, ${maxReward.toFixed(3)}]`)
  console.log(`Confirmed: ${confirmedCount}/${trainingExamples.length} (${((100 * confirmedCount) / trainingExamples.length).toFixed(1)}%)`)
  console.log(`Corrected: ${correctedCount}/${trainingExamples.length} (${((100 * correctedCount) / trainingExamples.length).toFixed(1)}%)`)
  console.log(`Ignored: ${ignoredCount}/${trainingExamples.length} (${((100 * ignoredCount) / trainingExamples.length).toFixed(1)}%)`)

  return stats
}

/**
 * Get system prompt for agent type
 */
function getSystemPrompt(agentType: AgentType): string {
  switch (agentType) {
    case AgentType.FILER:
      return FILER_SYSTEM_PROMPT
    case AgentType.LIBRARIAN:
      return `You are an AI Project Analyst. Your job is to analyze a new, incoming task (New_Item) against its surrounding context,
which includes the project's strategic goals (Strategic_Context) and all other existing tasks in the same project (Corpus).

Look for Conflicts, Dependencies, Relations, Redundancies, or Suggestions as defined:
1. Conflict: New item violates a strategic goal.
2. Redundancy: New item duplicates existing work.
3. Relation: New item is logically related to other items.
4. Dependency: New item depends on another item being completed first.
5. Suggestion: Any actionable insight that helps clarify next steps.

Return only a JSON array. Each element must have "type" (Conflict | Dependency | Redundancy | Relation | Suggestion)
and "text" (brief, direct explanation).

If you find nothing, return [].`
    case AgentType.PRIORITIZER:
      return `You are the "Prioritizer" AI for a personal project management system. Your job is to select the next Item to work on from all available TODO items.

Consider:
1. Strategic alignment (Job 1 Income vs Job 2 Authority)
2. Urgency vs Importance balance
3. Energy/time of day matching
4. Dependencies and blockers
5. Recent work patterns (avoid context switching)

Return a single JSON object with recommended_item_id, confidence, and reasoning.`
    case AgentType.STORER:
      return `You are the "Storer" AI for a personal project management system. Your job is to decide how to integrate completed Items into their Opus.

Consider:
1. Semantic coherence (does it fit with existing content?)
2. Document structure (should it be a new section or merged?)
3. Findability (will it be easy to locate later?)
4. Avoiding duplication

Return a JSON object with integrationDecision, location, method, and reasoning.`
    case AgentType.RETRIEVER:
      return `You are the "Retriever" AI for a personal project management system. Your job is to generate dynamic documents or answer queries from the Opus Corpus.

Rules:
1. Only use information from provided Opuses - do not hallucinate
2. Maintain the user's writing style and voice
3. Be comprehensive but concise
4. Cite all sources clearly

Return a JSON object with generatedContent, sourceCitations, and reasoning.`
    default:
      return ""
  }
}

/**
 * Format prompt for TRL training
 */
function formatPrompt(agentType: AgentType, state: any): string {
  const systemPrompt = getSystemPrompt(agentType)

  switch (agentType) {
    case AgentType.FILER: {
      const item = state.item || {}
      const assignedOpus = state.assignedOpus || null

      return `<|system|>
${systemPrompt}
<|user|>
Item: ${item.title || ""}
Instructions: ${item.rawInstructions || ""}
Routing Notes: ${item.routingNotes || "None"}
Assigned Opus: ${assignedOpus?.name || "None"}
Opus Type: ${assignedOpus?.opusType || "None"}
${assignedOpus?.isStrategic ? "Strategic: Yes" : ""}

Classify this item with swimlane, priority, labels, and urgency.
<|assistant|>`

    }

    case AgentType.LIBRARIAN: {
      const newItem = state.newItem || {}
      const opus = state.opus || {}
      const corpus = state.corpus || []

      return `<|system|>
${systemPrompt}
<|user|>
New Item:
- Title: ${newItem.title || ""}
- Instructions: ${newItem.rawInstructions || ""}
- Routing Notes: ${newItem.routingNotes || "None"}

Project Context:
- Name: ${opus.name || ""}
- Strategic: ${opus.isStrategic ? "Yes" : "No"}
- Content: ${opus.content?.substring(0, 1000) || ""}...

Existing Items in Project (${corpus.length} items):
${corpus.slice(0, 20).map((item: any) => 
  `- [${item.status || ""}] ${item.title || ""}: ${(item.rawInstructions || "").substring(0, 100)}...`
).join("\n")}

Analyze this item for conflicts, dependencies, redundancies, relations, or suggestions.
<|assistant|>`

    }

    case AgentType.PRIORITIZER: {
      const availableItems = state.availableItems || []
      const userContext = state.userContext || {}
      const strategicState = state.strategicState || {}
      const constraints = state.constraints || {}

      return `<|system|>
${systemPrompt}
<|user|>
Available TODO Items (${availableItems.length} items):

${availableItems.slice(0, 20).map((item: any) => 
  `- ID: ${item.id || ""}
  Title: ${item.title || ""}
  Swimlane: ${item.swimlane || ""}
  Priority: ${item.priority || ""}
  Labels: ${(item.labels || []).join(", ")}
  Age: ${item.statusChangedAt || "Unknown"}`
).join("\n\n")}

User Context:
- Current Time: ${userContext.currentTime || "Unknown"}
- Day of Week: ${userContext.dayOfWeek || "Unknown"}
- Current Focus: ${userContext.currentFocus || "None"}

Strategic State:
- Income Goal Progress: ${((strategicState.incomeGoalProgress || 0) * 100).toFixed(1)}%
- Authority Goal Progress: ${((strategicState.authorityGoalProgress || 0) * 100).toFixed(1)}%

Constraints:
- WIP Count: ${constraints.wipCount || 0}
- Blocked Count: ${constraints.blockedCount || 0}
- Average Cycle Time: ${(constraints.averageCycleTime || 0).toFixed(1)} days

Select the next item to work on.
<|assistant|>`

    }

    case AgentType.STORER: {
      const completedItem = state.completedItem || {}
      const targetOpus = state.targetOpus || {}

      return `<|system|>
${systemPrompt}
<|user|>
Completed Item:
- Title: ${completedItem.title || ""}
- Instructions: ${completedItem.rawInstructions || ""}
- Labels: ${(completedItem.labels || []).join(", ")}
- Outcome: ${JSON.stringify(completedItem.outcomeMetrics || {})}

Target Opus:
- Name: ${targetOpus.name || ""}
- Type: ${targetOpus.opusType || ""}
- Content Length: ${targetOpus.content?.length || 0} chars

Decide how to integrate this completed item into the opus.
<|assistant|>`

    }

    case AgentType.RETRIEVER: {
      const query = state.query || ""
      const requestType = state.requestType || ""
      const parameters = state.parameters || {}
      const relevantOpuses = state.relevantOpuses || []

      return `<|system|>
${systemPrompt}
<|user|>
Query: ${query}
Request Type: ${requestType}
Parameters: ${JSON.stringify(parameters)}

Relevant Opuses (${relevantOpuses.length}):
${relevantOpuses.map((opus: any) => 
  `- ${opus.name || ""} (${opus.opusType || ""}): ${(opus.content || "").substring(0, 500)}...`
).join("\n\n")}

Generate the requested document or answer.
<|assistant|>`

    }

    default:
      throw new Error(`Unknown agent type: ${agentType}`)
  }
}

/**
 * Format completion for TRL training
 */
function formatCompletion(agentType: AgentType, action: any): string {
  switch (agentType) {
    case AgentType.FILER: {
      return JSON.stringify({
        swimlane: action.swimlane,
        priority: action.priority,
        labels: action.labels || [],
        urgency: action.status === "TODO" ? "To Do" : action.status === "ON_HOLD" ? "On Hold" : "To Do",
        reasoning: action.reasoning || "",
        confidence: action.confidence || 0.5
      })
    }

    case AgentType.LIBRARIAN: {
      return JSON.stringify({
        findings: action.findings || [],
        reasoning: action.reasoning || ""
      })
    }

    case AgentType.PRIORITIZER: {
      return JSON.stringify({
        recommended_item_id: action.recommendedItemId || action.recommended_item_id,
        confidence: action.confidence || 0.5,
        reasoning: action.reasoning || "",
        alternativeItems: action.alternativeItems || []
      })
    }

    case AgentType.STORER: {
      return JSON.stringify({
        integrationDecision: action.integrationDecision || "INTEGRATE",
        location: action.location || null,
        method: action.method || "APPEND",
        newSectionHeading: action.newSectionHeading || null,
        suggestedContent: action.suggestedContent || null,
        confidence: action.confidence || 0.5,
        reasoning: action.reasoning || ""
      })
    }

    case AgentType.RETRIEVER: {
      return JSON.stringify({
        generatedContent: action.generatedContent || action.generated_document || "",
        sourceCitations: action.sourceCitations || action.source_citations || [],
        confidence: action.confidence || 0.5,
        reasoning: action.reasoning || ""
      })
    }

    default:
      throw new Error(`Unknown agent type: ${agentType}`)
  }
}

/**
 * Export training data to a temporary file and return the path
 */
export async function exportTrainingDataToTemp(
  agentType: AgentType,
  options: {
    limit?: number
    minReward?: number
    requireFeedback?: boolean
    requireReward?: boolean
  } = {}
): Promise<{ path: string; stats: ExportStats }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `training-${agentType.toLowerCase()}-${timestamp}.jsonl`
  const outputPath = path.join(process.cwd(), "training", "data", filename)

  const stats = await exportTrainingData(agentType, outputPath, options)

  return { path: outputPath, stats }
}
