import { prisma } from "@/lib/prisma"
import { AgentType, Feedback } from "@prisma/client"
import type {
  FilerState,
  FilerAction,
  LibrarianState,
  LibrarianAction,
  PrioritizerState,
  PrioritizerAction,
  StorerState,
  StorerAction,
  RetrieverState,
  RetrieverAction
} from "./agent-schemas"

/**
 * @deprecated Use getModelVersion from model-registry.ts instead
 * This function is kept for backward compatibility but should not be used in new code
 */
export function getModelVersionLegacy(modelName: string = "gpt-4.1-mini"): string {
  const date = new Date().toISOString().split("T")[0].replace(/-/g, "")
  return `${modelName}-${date}`
}

// Legacy types for backward compatibility
export interface DecisionState {
  [key: string]: unknown
}

export interface DecisionAction {
  [key: string]: unknown
}

// Type-safe state/action unions
export type AgentState =
  | FilerState
  | LibrarianState
  | PrioritizerState
  | StorerState
  | RetrieverState

export type AgentAction =
  | FilerAction
  | LibrarianAction
  | PrioritizerAction
  | StorerAction
  | RetrieverAction

export interface DecisionOutcomeMetrics {
  completedSuccessfully?: boolean
  cycleCount?: number
  blockedAt?: Date | null
  totalTimeInCreate?: number | null
  timeToComplete?: number | null
  strategicAlignment?: number
  [key: string]: unknown
}

export interface CreateDecisionParams {
  agentType: AgentType
  state: DecisionState
  action: DecisionAction
  userId: string
  modelVersion: string // e.g., "gpt-4.1-mini-20250101" or "ocd-filer-v3"
  itemId?: string
  opusId?: string
  confidence?: number
  reasoning?: string
  alternativeActions?: DecisionAction[]
  isTrainingData?: boolean
  isValidationData?: boolean
}

/**
 * Record an AI agent decision for RL training
 */
export async function recordDecision(params: CreateDecisionParams) {
  const decision = await prisma.decision.create({
    data: {
      agentType: params.agentType,
      state: params.state as any,
      action: params.action as any,
      userId: params.userId,
      modelVersion: params.modelVersion,
      itemId: params.itemId,
      opusId: params.opusId,
      confidence: params.confidence,
      reasoning: params.reasoning,
      alternativeActions: params.alternativeActions as any,
      isTrainingData: params.isTrainingData ?? true,
      isValidationData: params.isValidationData ?? false
    }
  })

  return decision
}

/**
 * Update a decision with user feedback
 */
export async function updateDecisionFeedback(
  decisionId: string,
  feedback: Feedback,
  correction?: DecisionAction
) {
  return prisma.decision.update({
    where: { id: decisionId },
    data: {
      userFeedback: feedback,
      userCorrection: correction as any,
      feedbackAt: new Date()
    }
  })
}

/**
 * Update a decision with outcome metrics and calculated reward
 */
export async function updateDecisionOutcome(
  decisionId: string,
  outcomeMetrics: DecisionOutcomeMetrics,
  reward: number,
  rewardComponents?: Record<string, number>,
  nextState?: DecisionState
) {
  return prisma.decision.update({
    where: { id: decisionId },
    data: {
      outcomeMetrics: outcomeMetrics as any,
      reward,
      rewardComponents: rewardComponents as any,
      nextState: nextState as any,
      outcomeObservedAt: new Date(),
      rewardComputedAt: new Date()
    }
  })
}

/**
 * Calculate reward for AI Filer agent
 * R_filer = α₁ * user_feedback + α₂ * outcome_quality + α₃ * strategic_alignment - α₄ * rework_penalty
 */
export function calculateFilerReward(
  userFeedback: Feedback | null,
  outcomeMetrics: DecisionOutcomeMetrics,
  alpha1: number = 1.0,
  alpha2: number = 0.5,
  alpha3: number = 0.3,
  alpha4: number = 0.2
): { reward: number; components: Record<string, number> } {
  const components: Record<string, number> = {
    immediate: 0,
    outcome: 0,
    strategic: 0,
    rework: 0
  }

  // α₁ * user_feedback (immediate signal)
  if (userFeedback === Feedback.CONFIRMED) {
    components.immediate = alpha1
  } else if (userFeedback === Feedback.CORRECTED) {
    components.immediate = -alpha1 * 0.5
  } else if (userFeedback === Feedback.IGNORED) {
    components.immediate = -alpha1 * 0.2
  } else if (userFeedback === Feedback.OVERRIDDEN) {
    components.immediate = -alpha1 * 0.8
  }

  // α₂ * outcome_quality (delayed signal)
  if (outcomeMetrics.completedSuccessfully) {
    components.outcome = alpha2
    if (outcomeMetrics.cycleCount === 0) {
      components.outcome += alpha2 * 0.5 // Smooth completion bonus
    }
  }

  if (outcomeMetrics.blockedAt) {
    components.outcome -= alpha2 * 0.3 // Blocked penalty
  }

  // α₄ * rework_penalty
  if (outcomeMetrics.cycleCount && outcomeMetrics.cycleCount > 2) {
    components.rework = -alpha4 * outcomeMetrics.cycleCount
  }

  // α₃ * strategic_alignment
  if (outcomeMetrics.strategicAlignment) {
    components.strategic = alpha3 * outcomeMetrics.strategicAlignment
  }

  const reward = components.immediate + components.outcome + components.strategic + components.rework
  const clampedReward = Math.max(-2.0, Math.min(2.0, reward))

  return { reward: clampedReward, components }
}

/**
 * Calculate reward for AI Librarian agent
 * R_librarian = β₁ * finding_accuracy + β₂ * conflict_prevention - β₃ * false_positive_penalty
 */
export function calculateLibrarianReward(
  userFeedback: Feedback | null,
  outcomeMetrics: DecisionOutcomeMetrics,
  beta1: number = 1.0,
  beta2: number = 0.5,
  beta3: number = 0.3
): { reward: number; components: Record<string, number> } {
  const components: Record<string, number> = {
    accuracy: 0,
    conflictPrevention: 0,
    falsePositive: 0
  }

  // β₁ * finding_accuracy
  if (userFeedback === Feedback.CONFIRMED) {
    components.accuracy = beta1
  } else if (userFeedback === Feedback.CORRECTED) {
    components.accuracy = -beta1 * 0.5
  } else if (userFeedback === Feedback.OVERRIDDEN) {
    components.accuracy = -beta1 * 0.8
  }

  // β₂ * conflict_prevention (did conflicts actually occur?)
  if (outcomeMetrics.conflictPrevented) {
    components.conflictPrevention = beta2
  }

  // β₃ * false_positive_penalty
  if (outcomeMetrics.falsePositive) {
    components.falsePositive = -beta3
  }

  const reward = components.accuracy + components.conflictPrevention + components.falsePositive
  const clampedReward = Math.max(-2.0, Math.min(2.0, reward))

  return { reward: clampedReward, components }
}

/**
 * Calculate reward for AI Prioritizer agent
 * R_prioritizer = γ₁ * user_acceptance + γ₂ * completion_success + γ₃ * strategic_progress - γ₄ * opportunity_cost
 */
export function calculatePrioritizerReward(
  userAccepted: boolean,
  outcomeMetrics: DecisionOutcomeMetrics,
  gamma1: number = 1.0,
  gamma2: number = 0.5,
  gamma3: number = 0.3,
  gamma4: number = 0.2
): { reward: number; components: Record<string, number> } {
  const components: Record<string, number> = {
    acceptance: 0,
    completion: 0,
    strategic: 0,
    opportunityCost: 0
  }

  // γ₁ * user_acceptance
  if (userAccepted) {
    components.acceptance = gamma1
  } else {
    components.acceptance = -gamma1 * 0.3
  }

  // γ₂ * completion_success
  if (outcomeMetrics.completedSuccessfully) {
    components.completion = gamma2
  }

  // γ₃ * strategic_progress
  if (outcomeMetrics.strategicAlignment) {
    components.strategic = gamma3 * outcomeMetrics.strategicAlignment
  }

  // γ₄ * opportunity_cost (simplified - could be more sophisticated)
  if (outcomeMetrics.opportunityCost) {
    components.opportunityCost = -gamma4 * outcomeMetrics.opportunityCost
  }

  const reward = components.acceptance + components.completion + components.strategic + components.opportunityCost
  const clampedReward = Math.max(-2.0, Math.min(2.0, reward))

  return { reward: clampedReward, components }
}

/**
 * Calculate reward for AI Storer agent
 * R_storer = δ₁ * user_acceptance + δ₂ * corpus_coherence + δ₃ * findability - δ₄ * duplication_penalty
 */
export function calculateStorerReward(
  userFeedback: Feedback | null,
  outcomeMetrics: DecisionOutcomeMetrics,
  delta1: number = 1.0,
  delta2: number = 0.3,
  delta3: number = 0.2,
  delta4: number = 0.3
): { reward: number; components: Record<string, number> } {
  const components: Record<string, number> = {
    acceptance: 0,
    coherence: 0,
    findability: 0,
    duplication: 0
  }

  // δ₁ * user_acceptance
  if (userFeedback === Feedback.CONFIRMED) {
    components.acceptance = delta1
  } else if (userFeedback === Feedback.CORRECTED) {
    components.acceptance = -delta1 * 0.5
  } else if (userFeedback === Feedback.OVERRIDDEN) {
    components.acceptance = -delta1 * 0.8
  }

  // δ₂ * corpus_coherence (simplified - would need semantic analysis)
  if (outcomeMetrics.corpusCoherence) {
    components.coherence = delta2 * outcomeMetrics.corpusCoherence
  }

  // δ₃ * findability
  if (outcomeMetrics.findability) {
    components.findability = delta3 * outcomeMetrics.findability
  }

  // δ₄ * duplication_penalty
  if (outcomeMetrics.duplicationDetected) {
    components.duplication = -delta4
  }

  const reward = components.acceptance + components.coherence + components.findability + components.duplication
  const clampedReward = Math.max(-2.0, Math.min(2.0, reward))

  return { reward: clampedReward, components }
}

/**
 * Calculate reward for AI Retriever agent
 * R_retriever = ε₁ * user_satisfaction + ε₂ * accuracy + ε₃ * completeness - ε₄ * hallucination_penalty
 */
export function calculateRetrieverReward(
  userFeedback: Feedback | null,
  outcomeMetrics: DecisionOutcomeMetrics,
  epsilon1: number = 1.0,
  epsilon2: number = 0.5,
  epsilon3: number = 0.3,
  epsilon4: number = 0.5
): { reward: number; components: Record<string, number> } {
  const components: Record<string, number> = {
    satisfaction: 0,
    accuracy: 0,
    completeness: 0,
    hallucination: 0
  }

  // ε₁ * user_satisfaction
  if (userFeedback === Feedback.CONFIRMED) {
    components.satisfaction = epsilon1
  } else if (userFeedback === Feedback.CORRECTED) {
    components.satisfaction = -epsilon1 * 0.5
  } else if (userFeedback === Feedback.OVERRIDDEN) {
    components.satisfaction = -epsilon1 * 0.8
  }

  // ε₂ * accuracy
  if (outcomeMetrics.accuracy) {
    components.accuracy = epsilon2 * outcomeMetrics.accuracy
  }

  // ε₃ * completeness
  if (outcomeMetrics.completeness) {
    components.completeness = epsilon3 * outcomeMetrics.completeness
  }

  // ε₄ * hallucination_penalty
  if (outcomeMetrics.hallucinationDetected) {
    components.hallucination = -epsilon4
  }

  const reward = components.satisfaction + components.accuracy + components.completeness + components.hallucination
  const clampedReward = Math.max(-2.0, Math.min(2.0, reward))

  return { reward: clampedReward, components }
}
