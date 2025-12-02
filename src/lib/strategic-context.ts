import { prisma } from "./prisma"
import { AgentType } from "@prisma/client"

/**
 * Fetch strategic documents (opuses) for a user
 * Strategic documents are opuses marked with isStrategic: true
 * These contain guiding principles and strategic context
 */
export async function getStrategicDocuments(userId: string): Promise<Array<{
  id: string
  name: string
  content: string
}>> {
  const strategicOpuses = await prisma.opus.findMany({
    where: {
      createdByUserId: userId,
      isStrategic: true
    },
    select: {
      id: true,
      name: true,
      content: true
    },
    orderBy: {
      updatedAt: "desc" // Most recently updated first
    }
  })

  return strategicOpuses
}

/**
 * Format strategic documents for use in agent state schemas
 * Returns array with name and content (truncated if needed)
 */
export async function getStrategicDocumentsForState(
  userId: string,
  maxContentLength: number = 5000
): Promise<Array<{
  name: string
  content: string
}>> {
  const documents = await getStrategicDocuments(userId)

  return documents.map(doc => ({
    name: doc.name,
    content: doc.content.length > maxContentLength
      ? doc.content.substring(0, maxContentLength) + "..."
      : doc.content
  }))
}

/**
 * Fetch recent decisions for a user, optionally filtered by agent type
 * Returns the last 10 decisions with their action data
 */
export async function getRecentDecisions(
  userId: string,
  agentType?: AgentType
): Promise<Array<{
  action: unknown
  createdAt: Date
}>> {
  const decisions = await prisma.decision.findMany({
    where: {
      userId,
      ...(agentType && { agentType })
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 10,
    select: {
      action: true,
      createdAt: true
    }
  })

  return decisions
}

/**
 * Format recent decisions for use in userContext
 * Extracts status and swimlane from FILER decisions
 * Returns array suitable for userContext.recentDecisions
 */
export async function getRecentDecisionsForContext(
  userId: string,
  agentType?: AgentType
): Promise<Array<{
  status: string
  swimlane: string
}>> {
  const decisions = await getRecentDecisions(userId, agentType)

  return decisions
    .map(decision => {
      // Extract status and swimlane from action JSON
      // For FILER decisions, action contains: { status, swimlane, priority, labels, ... }
      const action = decision.action as Record<string, unknown>
      
      if (action && typeof action === "object") {
        return {
          status: String(action.status || ""),
          swimlane: String(action.swimlane || "")
        }
      }
      
      return null
    })
    .filter((dec): dec is { status: string; swimlane: string } => dec !== null)
}
