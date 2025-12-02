import { prisma } from "@/lib/prisma"
import { AgentType, Feedback, ItemStatus, Swimlane, Priority, Prisma } from "@prisma/client"
import type { Decision } from "@prisma/client"
import {
  FilerRewardComponents,
  LibrarianRewardComponents,
  PrioritizerRewardComponents,
  StorerRewardComponents,
  RetrieverRewardComponents
} from "./agent-schemas"

// Type for Decision with item relation included
type DecisionWithItem = Prisma.DecisionGetPayload<{
  include: { item: true }
}>

/**
 * Reward weights for each agent and component
 * These are hyperparameters that will be tuned during training
 */
export const REWARD_WEIGHTS = {
  FILER: {
    immediate: {
      userFeedback: 1.0, // Primary signal
      confidenceCalibration: 0.1
    },
    delayed: {
      completionSuccess: 0.5,
      blockageAvoidance: 0.3,
      reworkPenalty: 0.2,
      timeEfficiency: 0.3
    },
    strategic: {
      goalAlignment: 0.4,
      opportunityCost: 0.2
    }
  },
  LIBRARIAN: {
    immediate: {
      userFeedback: 1.0
    },
    delayed: {
      conflictPrevention: 2.0, // High value - prevents wasted work
      falsePositivePenalty: 0.5,
      missedIssuePenalty: 2.0, // Very bad - missed critical issue
      dependencyAccuracy: 0.5
    }
  },
  PRIORITIZER: {
    immediate: {
      userAcceptance: 1.0
    },
    delayed: {
      completionSuccess: 1.0,
      timeEfficiency: 0.5,
      strategicProgress: 0.8, // High value - advances goals
      opportunityCost: 0.3
    },
    contextual: {
      energyAlignment: 0.2,
      flowMaintenance: 0.2
    }
  },
  STORER: {
    immediate: {
      userAcceptance: 1.0,
      editDistance: 0.5
    },
    delayed: {
      corpusCoherence: 0.7,
      findability: 0.6,
      duplicationPenalty: 0.4
    }
  },
  RETRIEVER: {
    immediate: {
      userAcceptance: 1.0,
      editDistance: 0.5
    },
    accuracy: {
      citationCorrectness: 0.8,
      hallucinationPenalty: 2.0, // Very bad - breaks trust
      completeness: 0.6
    },
    quality: {
      coherence: 0.4,
      styleAlignment: 0.3
    }
  }
} as const

/**
 * Helper to get nested weight value
 */
function getNestedWeight(
  weights: Record<string, unknown>,
  path: string
): number {
  const parts = path.split(".")
  let current: unknown = weights
  for (const part of parts) {
    if (typeof current === "object" && current !== null && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return 0
    }
  }
  return typeof current === "number" ? current : 0
}

/**
 * Calculate user feedback reward component
 */
function calculateUserFeedbackReward(feedback: Feedback | null): number {
  switch (feedback) {
    case Feedback.CONFIRMED:
      return 1.0
    case Feedback.CORRECTED:
      return -0.5
    case Feedback.OVERRIDDEN:
      return -0.8
    case Feedback.IGNORED:
      return 0.0
    default:
      return 0.0
  }
}

/**
 * Get expected time in minutes based on swimlane and priority
 */
function getExpectedTime(swimlane: Swimlane | null, priority: Priority | null): number {
  // Expected time in minutes based on historical averages
  const baseTime: Record<Swimlane, number> = {
    EXPEDITE: 120,  // 2 hours
    PROJECT: 480,   // 8 hours
    HABIT: 60,      // 1 hour
    HOME: 180       // 3 hours
  }

  const priorityMultiplier: Record<Priority, number> = {
    HIGH: 0.8,
    MEDIUM: 1.0,
    LOW: 1.2
  }

  const base = swimlane ? baseTime[swimlane] : 480
  const multiplier = priority ? priorityMultiplier[priority] : 1.0

  return base * multiplier
}

/**
 * Get strategic goal progress to determine current priorities
 */
async function getStrategicGoalProgress(userId: string): Promise<{
  incomeIsPriority: boolean
  authorityIsPriority: boolean
}> {
  // Check user's current strategic focus
  // If more Job 1 items completed recently, income is priority
  const recentCompletions = await prisma.item.findMany({
    where: {
      createdByUserId: userId,
      status: ItemStatus.DONE,
      completedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    },
    select: { labels: true }
  })

  const job1Count = recentCompletions.filter(i => 
    i.labels.includes("Job 1 (Income)")
  ).length
  const job2Count = recentCompletions.filter(i => 
    i.labels.includes("Job 2 (Authority)")
  ).length

  return {
    incomeIsPriority: job1Count >= job2Count,
    authorityIsPriority: job2Count > job1Count
  }
}

/**
 * Calculate Filer reward components
 */
async function calculateFilerRewardComponents(
  decision: DecisionWithItem
): Promise<FilerRewardComponents> {
  const components: FilerRewardComponents = {
    immediate: {
      userFeedback: calculateUserFeedbackReward(decision.userFeedback),
      confidenceCalibration: 0
    },
    delayed: {
      completionSuccess: 0,
      blockageAvoidance: 0,
      reworkPenalty: 0,
      timeEfficiency: 0
    },
    strategic: {
      goalAlignment: 0,
      opportunityCost: 0
    }
  }

  // Confidence calibration (how well-calibrated is AI's confidence?)
  if (decision.confidence !== null && decision.userFeedback) {
    const wasCorrect = decision.userFeedback === Feedback.CONFIRMED ? 1 : 0
    components.immediate.confidenceCalibration = -Math.abs(decision.confidence - wasCorrect)
  }

  // Delayed signals (from item outcome)
  if (decision.item) {
    const item = decision.item

    // Completion success
    if (item.status === ItemStatus.DONE) {
      components.delayed.completionSuccess = item.cycleCount === 0 ? 1.0 : 0.5
    } else if (item.status === ItemStatus.COLD_STORAGE) {
      components.delayed.completionSuccess = -0.3 // Item was abandoned
    }

    // Blockage avoidance
    if (item.blockedAt) {
      components.delayed.blockageAvoidance = -1.0
    }

    // Rework penalty
    components.delayed.reworkPenalty = -0.2 * (item.cycleCount || 0)

    // Time efficiency
    if (item.totalTimeInCreate && item.status === ItemStatus.DONE) {
      const expectedTime = getExpectedTime(item.swimlane, item.priority)
      const ratio = item.totalTimeInCreate / expectedTime

      if (ratio < 1.2) {
        components.delayed.timeEfficiency = 0.5 // Under estimate
      } else if (ratio > 2.0) {
        components.delayed.timeEfficiency = -0.5 // Way over estimate
      }
    }
  }

  // Strategic signals
  if (decision.item && decision.userId) {
    const action = decision.action as any
    const hasJob1Label = action.labels?.includes("Job 1 (Income)")
    const hasJob2Label = action.labels?.includes("Job 2 (Authority)")

    if (hasJob1Label || hasJob2Label) {
      const goalProgress = await getStrategicGoalProgress(decision.userId)
      
      if (hasJob1Label && goalProgress.incomeIsPriority) {
        components.strategic.goalAlignment = 0.5
      } else if (hasJob2Label && goalProgress.authorityIsPriority) {
        components.strategic.goalAlignment = 0.5
      }
    }
  }

  return components
}

/**
 * Calculate Librarian reward components
 */
async function calculateLibrarianRewardComponents(
  decision: Decision
): Promise<LibrarianRewardComponents> {
  const components: LibrarianRewardComponents = {
    immediate: {
      userFeedback: calculateUserFeedbackReward(decision.userFeedback)
    },
    delayed: {
      conflictPrevention: 0,
      falsePositivePenalty: 0,
      missedIssuePenalty: 0,
      dependencyAccuracy: 0
    }
  }

  if (decision.outcomeMetrics) {
    const metrics = decision.outcomeMetrics as any

    if (metrics.conflictPrevented) {
      components.delayed.conflictPrevention = 1.0
    }

    if (metrics.falsePositive) {
      components.delayed.falsePositivePenalty = -0.5
    }

    if (metrics.missedIssue) {
      components.delayed.missedIssuePenalty = -1.0
    }

    if (metrics.dependencyWasReal) {
      components.delayed.dependencyAccuracy = 0.5
    }
  }

  return components
}

/**
 * Calculate Prioritizer reward components
 */
async function calculatePrioritizerRewardComponents(
  decision: Decision
): Promise<PrioritizerRewardComponents> {
  const components: PrioritizerRewardComponents = {
    immediate: {
      userAcceptance:
        decision.userFeedback === Feedback.CONFIRMED
          ? 1.0
          : decision.userFeedback === Feedback.CORRECTED
            ? -0.5
            : 0.0
    },
    delayed: {
      completionSuccess: 0,
      timeEfficiency: 0,
      strategicProgress: 0,
      opportunityCost: 0
    },
    contextual: {
      energyAlignment: 0,
      flowMaintenance: 0
    }
  }

  if (decision.outcomeMetrics) {
    const metrics = decision.outcomeMetrics as any

    if (metrics.completedSuccessfully) {
      components.delayed.completionSuccess = 1.0
    }

    if (metrics.timeEfficiency) {
      components.delayed.timeEfficiency = 0.5
    }

    if (metrics.strategicProgress) {
      components.delayed.strategicProgress = 0.3 * metrics.strategicProgress
    }

    if (metrics.opportunityCost) {
      components.delayed.opportunityCost = -0.2 * metrics.opportunityCost
    }

    if (metrics.energyAlignment) {
      components.contextual.energyAlignment = 0.2 * metrics.energyAlignment
    }

    if (metrics.flowMaintenance) {
      components.contextual.flowMaintenance = 0.2 * metrics.flowMaintenance
    }
  }

  return components
}

/**
 * Calculate Storer reward components
 */
async function calculateStorerRewardComponents(
  decision: Decision
): Promise<StorerRewardComponents> {
  const components: StorerRewardComponents = {
    immediate: {
      userAcceptance:
        decision.userFeedback === Feedback.CONFIRMED
          ? 1.0
          : decision.userFeedback === Feedback.CORRECTED
            ? -0.5
            : 0.0,
      editDistance: 0
    },
    delayed: {
      corpusCoherence: 0,
      findability: 0,
      duplicationPenalty: 0
    }
  }

  // Calculate edit distance from userCorrection
  if (decision.userCorrection && decision.action) {
    const action = decision.action as any
    const correction = decision.userCorrection as any
    
    // Simple edit distance: count changed fields
    let changedFields = 0
    let totalFields = 0
    
    for (const key in action) {
      totalFields++
      if (correction[key] !== undefined && correction[key] !== action[key]) {
        changedFields++
      }
    }
    
    if (totalFields > 0) {
      components.immediate.editDistance = -0.1 * (changedFields / totalFields)
    }
  }

  if (decision.outcomeMetrics) {
    const metrics = decision.outcomeMetrics as any

    if (metrics.corpusCoherence) {
      components.delayed.corpusCoherence = 0.5 * metrics.corpusCoherence
    }

    if (metrics.findability) {
      components.delayed.findability = 0.3 * metrics.findability
    }

    if (metrics.duplicationDetected) {
      components.delayed.duplicationPenalty = -0.5
    }
  }

  return components
}

/**
 * Calculate Retriever reward components
 */
async function calculateRetrieverRewardComponents(
  decision: Decision
): Promise<RetrieverRewardComponents> {
  const components: RetrieverRewardComponents = {
    immediate: {
      userAcceptance:
        decision.userFeedback === Feedback.CONFIRMED
          ? 1.0
          : decision.userFeedback === Feedback.CORRECTED
            ? -1.0
            : 0.0,
      editDistance: 0
    },
    accuracy: {
      citationCorrectness: 0,
      hallucinationPenalty: 0,
      completeness: 0
    },
    quality: {
      coherence: 0,
      styleAlignment: 0
    }
  }

  // Calculate edit distance from userCorrection
  if (decision.userCorrection && decision.action) {
    const action = decision.action as any
    const correction = decision.userCorrection as any
    
    if (action.generatedContent && correction.generatedContent) {
      const originalLength = action.generatedContent.length
      const correctedLength = correction.generatedContent.length
      const editRatio = Math.abs(originalLength - correctedLength) / Math.max(originalLength, 1)
      components.immediate.editDistance = -0.1 * editRatio
    }
  }

  if (decision.outcomeMetrics) {
    const metrics = decision.outcomeMetrics as any

    if (metrics.citationCorrectness) {
      components.accuracy.citationCorrectness = 0.5 * metrics.citationCorrectness
    }

    if (metrics.hallucinationCount) {
      components.accuracy.hallucinationPenalty = -1.0 * metrics.hallucinationCount
    }

    if (metrics.completeness) {
      components.accuracy.completeness = 0.3 * metrics.completeness
    }

    if (metrics.coherence) {
      components.quality.coherence = 0.4 * metrics.coherence
    }

    if (metrics.styleAlignment) {
      components.quality.styleAlignment = 0.2 * metrics.styleAlignment
    }
  }

  return components
}

/**
 * Calculate total reward from components using weights
 */
function calculateTotalReward(
  components: Record<string, unknown>,
  weights: Record<string, unknown>
): number {
  let totalReward = 0

  function traverse(obj: Record<string, unknown>, prefix = ""): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key

      if (typeof value === "number") {
        const weight = getNestedWeight(weights, path)
        totalReward += weight * value
      } else if (typeof value === "object" && value !== null) {
        traverse(value as Record<string, unknown>, path)
      }
    }
  }

  traverse(components)
  return Math.max(-5.0, Math.min(5.0, totalReward)) // Clamp to reasonable range
}

/**
 * Calculate reward for a single decision by ID
 */
export async function calculateReward(decisionId: string): Promise<number> {
  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    include: {
      item: true
    }
  })

  if (!decision) {
    throw new Error("Decision not found")
  }

  return (await calculateRewardForDecision(decision)).reward
}

/**
 * Main reward calculation function
 */
export async function calculateRewardForDecision(decision: DecisionWithItem): Promise<{
  reward: number
  components: Record<string, unknown>
}> {
  let components: Record<string, unknown>

  switch (decision.agentType) {
    case AgentType.FILER:
      components = await calculateFilerRewardComponents(decision) as Record<string, unknown>
      break
    case AgentType.LIBRARIAN:
      components = await calculateLibrarianRewardComponents(decision as Decision) as Record<string, unknown>
      break
    case AgentType.PRIORITIZER:
      components = await calculatePrioritizerRewardComponents(decision as Decision) as Record<string, unknown>
      break
    case AgentType.STORER:
      components = await calculateStorerRewardComponents(decision as Decision) as Record<string, unknown>
      break
    case AgentType.RETRIEVER:
      components = await calculateRetrieverRewardComponents(decision as Decision) as Record<string, unknown>
      break
    default:
      components = {}
  }

  const weights = REWARD_WEIGHTS[decision.agentType] || {}
  const reward = calculateTotalReward(components, weights)

  // Store breakdown for debugging
  await prisma.decision.update({
    where: { id: decision.id },
    data: {
      reward,
      rewardComponents: components as any,
      rewardComputedAt: new Date()
    }
  })

  return { reward, components }
}

/**
 * Background job to calculate rewards for completed items
 * Call this periodically (e.g., via cron or scheduled job)
 */
export async function calculatePendingRewards(): Promise<{
  processed: number
  errors: number
}> {
  // Find decisions with outcomes but no reward calculated
  const decisions = await prisma.decision.findMany({
    where: {
      reward: null,
      item: {
        OR: [
          { status: ItemStatus.DONE },
          { status: ItemStatus.COLD_STORAGE }
        ]
      }
    },
    include: { item: true },
    take: 100
  })

  console.log(`Calculating rewards for ${decisions.length} decisions`)

  let processed = 0
  let errors = 0

  for (const decision of decisions) {
    try {
      await calculateRewardForDecision(decision)
      processed++
    } catch (error) {
      console.error(`Failed to calculate reward for decision ${decision.id}:`, error)
      errors++
    }
  }

  return { processed, errors }
}
