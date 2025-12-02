import { prisma } from "./prisma"
import { ItemStatus } from "@prisma/client"
import { calculateRewardForDecision } from "./reward-calculator"

/**
 * Track outcome metrics for decisions when an item reaches terminal state
 */
export async function trackItemOutcome(itemId: string): Promise<{
  updated: number
  rewardsCalculated: number
  errors: number
}> {
  // Get the item with all relevant data
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      status: true,
      cycleCount: true,
      blockedAt: true,
      totalTimeInCreate: true,
      completedAt: true,
      startedAt: true,
      statusChangedAt: true,
      createdAt: true,
      swimlane: true,
      priority: true,
      labels: true,
      opusId: true
    }
  })

  if (!item) {
    throw new Error(`Item ${itemId} not found`)
  }

  // Only track outcomes for terminal states
  const terminalStates: ItemStatus[] = [ItemStatus.DONE, ItemStatus.COLD_STORAGE]
  if (!terminalStates.includes(item.status)) {
    console.log(`[OutcomeTracker] Item ${itemId} is not in terminal state (${item.status}), skipping outcome tracking`)
    return { updated: 0, rewardsCalculated: 0, errors: 0 }
  }

  // Find all decisions for this item
  const decisions = await prisma.decision.findMany({
    where: {
      itemId: item.id,
      outcomeObservedAt: null // Only process decisions that haven't been tracked yet
    },
    include: {
      item: {
        select: {
          swimlane: true,
          priority: true
        }
      }
    }
  })

  if (decisions.length === 0) {
    return { updated: 0, rewardsCalculated: 0, errors: 0 }
  }

  let updated = 0
  let rewardsCalculated = 0
  let errors = 0

  // Calculate expected time for time efficiency metric
  const expectedTime = calculateExpectedTime(item.swimlane, item.priority)

  // Calculate time to complete (from creation to completion/abandonment)
  const now = new Date()
  const timeToComplete = item.completedAt
    ? Math.floor((item.completedAt.getTime() - item.createdAt.getTime()) / (1000 * 60)) // minutes
    : item.status === ItemStatus.COLD_STORAGE
      ? Math.floor((now.getTime() - item.createdAt.getTime()) / (1000 * 60)) // minutes
      : null

  // Prepare outcome metrics
  const outcomeMetrics = {
    completedSuccessfully: item.status === ItemStatus.DONE,
    cycleCount: item.cycleCount || 0,
    blockedAt: item.blockedAt,
    totalTimeInCreate: item.totalTimeInCreate || 0,
    timeToComplete,
    expectedTime,
    timeEfficiency: item.totalTimeInCreate && expectedTime && expectedTime > 0
      ? expectedTime / item.totalTimeInCreate
      : null,
    wasBlocked: !!item.blockedAt,
    abandoned: item.status === ItemStatus.COLD_STORAGE,
    // Strategic alignment (simplified - can be enhanced)
    strategicAlignment: calculateStrategicAlignment(item.labels),
    // Opportunity cost (simplified - can be enhanced based on alternative items)
    opportunityCost: 0
  }

  // Update each decision with outcome metrics
  // This updates ALL agent types (FILER, LIBRARIAN, PRIORITIZER, etc.) that have decisions for this item
  for (const decision of decisions) {
    try {
      // Update outcome metrics for this decision
      await prisma.decision.update({
        where: { id: decision.id },
        data: {
          outcomeMetrics: outcomeMetrics as any,
          outcomeObservedAt: new Date()
        }
      })

      updated++

      // Trigger reward calculation if reward hasn't been calculated yet
      if (decision.reward === null) {
        try {
          // Fetch updated decision with item relation for reward calculation
          const updatedDecision = await prisma.decision.findUnique({
            where: { id: decision.id },
            include: {
              item: true
            }
          })

          if (updatedDecision) {
            await calculateRewardForDecision(updatedDecision)
            rewardsCalculated++
          }
        } catch (rewardError) {
          console.error(`Failed to calculate reward for decision ${decision.id} (${decision.agentType}):`, rewardError)
          errors++
        }
      }
    } catch (error) {
      console.error(`Failed to update outcome metrics for decision ${decision.id} (${decision.agentType}):`, error)
      errors++
    }
  }

  if (updated > 0) {
    console.log(`[OutcomeTracker] Updated ${updated} decisions for item ${itemId} (${decisions.length} total, ${rewardsCalculated} rewards calculated)`)
  }

  return { updated, rewardsCalculated, errors }
}

/**
 * Calculate expected time in minutes based on swimlane and priority
 */
function calculateExpectedTime(
  swimlane: string | null,
  priority: string | null
): number {
  const baseTime: Record<string, number> = {
    EXPEDITE: 120,  // 2 hours
    PROJECT: 480,   // 8 hours
    HABIT: 60,      // 1 hour
    HOME: 180       // 3 hours
  }

  const priorityMultiplier: Record<string, number> = {
    HIGH: 0.8,
    MEDIUM: 1.0,
    LOW: 1.2
  }

  const base = swimlane ? baseTime[swimlane] || 480 : 480
  const multiplier = priority ? priorityMultiplier[priority] || 1.0 : 1.0

  return base * multiplier
}

/**
 * Calculate strategic alignment score based on labels
 * Returns 0-1 score indicating how well item aligned with strategic goals
 */
function calculateStrategicAlignment(labels: string[]): number {
  // Simple heuristic: items with Job 1 or Job 2 labels are strategically aligned
  const hasJob1 = labels.includes("Job 1 (Income)")
  const hasJob2 = labels.includes("Job 2 (Authority)")

  if (hasJob1 || hasJob2) {
    return 1.0
  }

  // Items with project labels might be aligned
  if (labels.length > 0) {
    return 0.5
  }

  return 0.0
}

/**
 * Batch process items that reached terminal states but haven't been tracked
 * Useful for catching up on missed outcomes
 */
export async function trackPendingOutcomes(limit: number = 100): Promise<{
  processed: number
  updated: number
  rewardsCalculated: number
  errors: number
}> {
  // Find items in terminal states that have decisions without outcome metrics
  const items = await prisma.item.findMany({
    where: {
      status: {
        in: [ItemStatus.DONE, ItemStatus.COLD_STORAGE]
      },
      decisions: {
        some: {
          outcomeObservedAt: null
        }
      }
    },
    take: limit,
    select: {
      id: true
    }
  })

  let processed = 0
  let totalUpdated = 0
  let totalRewardsCalculated = 0
  let totalErrors = 0

  for (const item of items) {
    try {
      const result = await trackItemOutcome(item.id)
      totalUpdated += result.updated
      totalRewardsCalculated += result.rewardsCalculated
      totalErrors += result.errors
      processed++
    } catch (error) {
      console.error(`Failed to track outcome for item ${item.id}:`, error)
      totalErrors++
    }
  }

  return {
    processed,
    updated: totalUpdated,
    rewardsCalculated: totalRewardsCalculated,
    errors: totalErrors
  }
}
