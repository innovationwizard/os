/**
 * Agent-specific state and action schemas for RL training
 */

// ============================================================================
// AI FILER
// ============================================================================

export interface FilerState {
  item: {
    id: string
    title: string
    rawInstructions: string
    routingNotes: string | null
  }
  assignedOpus: {
    id: string
    name: string
    opusType: string
    content: string // First 1000 chars
    isStrategic: boolean
  } | null
  availableOpuses: Array<{
    id: string
    name: string
    opusType: string
  }>
  strategicDocuments: Array<{
    name: string
    content: string // Summary or full text
  }>
  userContext: {
    currentTime: string // ISO timestamp
    recentDecisions: Array<{ status: string; swimlane: string }> // Last 10 decisions
  }
}

export interface FilerAction {
  status: "TODO" | "ON_HOLD" | "COMPENDIUM" | "TRASH"
  swimlane: "EXPEDITE" | "PROJECT" | "HABIT" | "HOME"
  priority: "HIGH" | "MEDIUM" | "LOW"
  labels: string[]
  confidence: number // [0,1]
  reasoning: string
}

export interface FilerRewardComponents {
  immediate: {
    userFeedback: number // +1 confirmed, -0.5 corrected, 0 ignored
    confidenceCalibration: number // -|confidence - actual_correctness|
  }
  delayed: {
    completionSuccess: number // +0.5 if item completed without cycles
    blockageAvoidance: number // -0.3 if item got blocked
    reworkPenalty: number // -0.1 * cycleCount
    timeEfficiency: number // +0.3 if under expected time
  }
  strategic: {
    goalAlignment: number // +0.2 if advanced strategic goals
    opportunityCost: number // -0.1 if higher-value item was available
  }
}

// ============================================================================
// AI LIBRARIAN
// ============================================================================

export interface LibrarianState {
  newItem: {
    id: string
    title: string
    rawInstructions: string
    routingNotes: string | null
    opusId: string
  }
  opus: {
    id: string
    name: string
    content: string // Full or summary
    isStrategic: boolean
  }
  corpus: Array<{
    id: string
    title: string
    rawInstructions: string
    status: string
  }> // Limited to recent 50-100 items in same opus
  strategicDocuments: Array<{
    name: string
    content: string
  }>
}

export interface LibrarianAction {
  findings: Array<{
    type: "CONFLICT" | "DEPENDENCY" | "REDUNDANCY" | "RELATED" | "SUGGESTION"
    text: string
    confidence: number
    relatedItemIds: string[] // For dependencies/redundancies
  }>
  reasoning: string
}

export interface LibrarianRewardComponents {
  immediate: {
    userFeedback: number // User marks findings as helpful/not helpful
  }
  delayed: {
    conflictPrevention: number // +1 if flagged conflict was validated by outcome
    falsePositivePenalty: number // -0.5 if flagged issue didn't occur
    missedIssuePenalty: number // -1 if real conflict occurred but wasn't flagged
    dependencyAccuracy: number // +0.5 if dependency was real
  }
}

// ============================================================================
// AI PRIORITIZER
// ============================================================================

export interface PrioritizerState {
  availableItems: Array<{
    id: string
    title: string
    rawInstructions: string
    status: "TODO"
    swimlane: string
    priority: string
    labels: string[]
    opusId: string
    statusChangedAt: string
    lastProgressAt: string | null
  }>
  userContext: {
    currentTime: string
    dayOfWeek: string
    recentCompletions: Array<{ opusId: string; swimlane: string }> // Last 5
    currentFocus: string | null // Current strategic goal
  }
  strategicState: {
    incomeGoalProgress: number // % of income target achieved
    authorityGoalProgress: number // % of authority target achieved
    urgentDeadlines: Array<{ opusId: string; deadline: string }>
  }
  constraints: {
    wipCount: number // Current items in CREATING
    blockedCount: number // Items in BLOCKED
    averageCycleTime: number // Days per item historically
  }
}

export interface PrioritizerAction {
  recommendedItemId: string
  confidence: number
  reasoning: string
  alternativeItems: Array<{
    itemId: string
    score: number
    reasoning: string
  }> // Top 3 alternatives
}

export interface PrioritizerRewardComponents {
  immediate: {
    userAcceptance: number // +1 if user chose this item, -0.5 if chose different
  }
  delayed: {
    completionSuccess: number // +1 if item completed smoothly
    timeEfficiency: number // +0.5 if completed faster than avg
    strategicProgress: number // +0.3 if advanced high-priority goal
    opportunityCost: number // -0.2 * value_of_best_alternative
  }
  contextual: {
    energyAlignment: number // Did item match user's energy level?
    flowMaintenance: number // Did it maintain momentum from previous work?
  }
}

// ============================================================================
// AI STORER
// ============================================================================

export interface StorerState {
  completedItem: {
    id: string
    title: string
    rawInstructions: string
    routingNotes: string | null
    labels: string[]
    outcomeMetrics: {
      cycleCount: number
      totalTimeInCreate: number
      wasBlocked: boolean
    }
  }
  targetOpus: {
    id: string
    name: string
    content: string // Full content
    opusType: string
    structure: {
      // Parsed structure (sections, headings)
      sections: Array<{
        heading: string
        startIndex: number
        endIndex: number
        content: string
      }>
    }
  }
  previousIntegrations: Array<{
    itemTitle: string
    location: string
    method: string
    wasSuccessful: boolean
  }> // Last 10 integrations for this opus
}

export interface StorerAction {
  integrationDecision: "INTEGRATE" | "COLD_STORAGE"
  location: string | null // Section name or "NEW_SECTION"
  method: "APPEND" | "MERGE" | "REPLACE" | "NEW_SECTION"
  newSectionHeading: string | null // If method=NEW_SECTION
  suggestedContent: string | null // AI's integration text
  confidence: number
  reasoning: string
}

export interface StorerRewardComponents {
  immediate: {
    userAcceptance: number // +1 if user accepted integration, -0.5 if rejected
    editDistance: number // -0.1 * (chars_changed / total_chars)
  }
  delayed: {
    corpusCoherence: number // +0.5 if opus remains coherent (measured by later retrieval success)
    findability: number // +0.3 if content can be found via search later
    duplicationPenalty: number // -0.5 if creates redundancy with existing content
  }
}

// ============================================================================
// AI RETRIEVER
// ============================================================================

export interface RetrieverState {
  query: string
  requestType: "GENERATE_DOCUMENT" | "ANSWER_QUESTION" | "FIND_CONTENT"
  parameters: {
    // For dynamic documents
    targetAudience?: string
    context?: string
    format?: string
    [key: string]: unknown
  }
  relevantOpuses: Array<{
    // Retrieved via semantic search
    id: string
    name: string
    content: string
    opusType: string
    relevanceScore: number
  }>
  userHistory: {
    previousQueries: string[]
    preferredSources: string[] // Opuses user frequently references
  }
}

export interface RetrieverAction {
  generatedContent: string
  sourceCitations: Array<{
    opusId: string
    opusName: string
    excerpt: string
  }>
  confidence: number
  reasoning: string
}

export interface RetrieverRewardComponents {
  immediate: {
    userAcceptance: number // +1 if accepted, -1 if rejected
    editDistance: number // -0.1 * (chars_changed / total_chars)
  }
  accuracy: {
    citationCorrectness: number // +0.5 if all citations are accurate
    hallucinationPenalty: number // -1 per hallucinated fact
    completeness: number // +0.3 if all relevant info included
  }
  quality: {
    coherence: number // Measured by user rating or readability score
    styleAlignment: number // +0.2 if matches user's writing style
  }
}
