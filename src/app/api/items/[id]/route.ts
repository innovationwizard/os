import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { ItemStatus, ItemType, Priority, Swimlane, AnalysisType, OpusType, Feedback } from "@prisma/client"
import { callAIFiler, callAILibrarian } from "@/lib/ai"
import { recordDecision, type DecisionState, type DecisionAction } from "@/lib/decision-recorder"
import { trackItemOutcome } from "@/lib/outcome-tracker"
import { getStrategicDocumentsForState, getRecentDecisionsForContext } from "@/lib/strategic-context"
import { getModelVersion } from "@/lib/model-registry"
import { AgentType } from "@prisma/client"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { status, type, opusId, routingNotes, title, rawInstructions, swimlane, order, userFeedback, userCorrection } = await request.json()

  if (!status && !type && typeof opusId === "undefined" && typeof routingNotes === "undefined" && !title && !rawInstructions && !swimlane && typeof order === "undefined") {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 }
    )
  }

  const existing = await prisma.item.findFirst({
    where: {
      id,
      createdByUserId: session.user.id
    }
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}

  if (status) {
    data.status = status as ItemStatus
    data.statusChangedAt = new Date()
  }

  if (type) {
    data.type = type as ItemType
  }

  if (typeof opusId !== "undefined") {
    data.opusId = opusId || null
  }

  if (typeof routingNotes !== "undefined") {
    const cleaned =
      typeof routingNotes === "string"
        ? routingNotes.trim()
        : routingNotes == null
          ? null
          : String(routingNotes).trim()
    data.routingNotes = cleaned || null
  }

  if (title) {
    const trimmed = typeof title === "string" ? title.trim() : String(title).trim()
    if (!trimmed) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      )
    }
    data.title = trimmed
  }

  if (rawInstructions !== undefined) {
    const cleaned = typeof rawInstructions === "string" ? rawInstructions.trim() : String(rawInstructions).trim()
    data.rawInstructions = cleaned
  }

  if (swimlane) {
    data.swimlane = swimlane as Swimlane
  }

  if (typeof order !== "undefined") {
    data.order = order === null ? null : (typeof order === "number" ? order : parseInt(String(order), 10))
  }

  const previousStatus = existing.status
  const newStatus = status ? (status as ItemStatus) : previousStatus

  let item = await prisma.item.update({
    where: { id },
    data
  })

  // Track outcome if status changed to terminal state
  if (status && (newStatus === ItemStatus.DONE || newStatus === ItemStatus.COLD_STORAGE)) {
    // Set completion timestamp if moving to DONE
    if (newStatus === ItemStatus.DONE && !item.completedAt) {
      item = await prisma.item.update({
        where: { id },
        data: { completedAt: new Date() }
      })
    }

    // Track outcome asynchronously (don't block response)
    // This will update outcomeMetrics for ALL decisions associated with this item
    // (FILER, LIBRARIAN, PRIORITIZER, STORER, RETRIEVER, etc.)
    void trackItemOutcome(id)
      .then((result) => {
        if (result.updated > 0) {
          console.log(`[Items API] Tracked outcomes for item ${id}: ${result.updated} decisions updated, ${result.rewardsCalculated} rewards calculated`)
        }
      })
      .catch((error) => {
        console.error(`[Items API] Failed to track outcome for item ${id}:`, error)
      })
  }

  if (status) {
    const statusChangeData: {
      itemId: string
      fromStatus: ItemStatus | null
      toStatus: ItemStatus
      changedById: string
      userFeedback?: Feedback
      userCorrection?: Prisma.InputJsonValue
    } = {
      itemId: item.id,
      fromStatus: existing.status,
      toStatus: status as ItemStatus,
      changedById: session.user.id
    }

    if (userFeedback) {
      statusChangeData.userFeedback = userFeedback as Feedback
    }

    if (userCorrection) {
      statusChangeData.userCorrection = userCorrection as Prisma.InputJsonValue
    }

    await prisma.statusChange.create({
      data: statusChangeData
    })
  }

  const opusAssigned = typeof opusId !== "undefined" ? opusId : undefined

  if (opusAssigned) {
    const opus = opusAssigned
      ? await prisma.opus.findUnique({
          where: { id: opusAssigned },
          select: {
            id: true,
            name: true,
            content: true,
            opusType: true,
            isStrategic: true
          }
        })
      : null

    const opusesList = await prisma.opus.findMany({
      where: {
        createdByUserId: session.user.id,
        opusType: OpusType.PROJECT
      },
      select: {
        id: true,
        name: true,
        content: true,
        opusType: true
      }
    })

    const filerInput = {
      Instructions: item.rawInstructions,
      RoutingNotes: item.routingNotes,
      Project: opus ? {
        id: opus.id,
        title: opus.name,
        rawInstructions: opus.content,
        status: "ACTIVE"
      } : null,
      Projects: opusesList.map((o) => ({ id: o.id, title: o.name })),
      ItemTitle: item.title
    }

    const filerResult = await callAIFiler(filerInput)

    if (filerResult) {
      const statusMap: Record<"To Do" | "On Hold", ItemStatus> = {
        "To Do": ItemStatus.TODO,
        "On Hold": ItemStatus.ON_HOLD
      }

      const swimlaneMap: Record<string, Swimlane | undefined> = {
        Expedite: Swimlane.EXPEDITE,
        Project: Swimlane.PROJECT,
        Habit: Swimlane.HABIT,
        Home: Swimlane.HOME
      }

      const priorityMap: Record<string, Priority | undefined> = {
        High: Priority.HIGH,
        Medium: Priority.MEDIUM,
        Low: Priority.LOW
      }

      const nextStatus = statusMap[filerResult.urgency]
      const nextSwimlane = swimlaneMap[filerResult.swimlane] ?? Swimlane.PROJECT
      const nextPriority = priorityMap[filerResult.priority] ?? Priority.MEDIUM

      const previousStatus = item.status

      // Fetch strategic documents and recent decisions for context
      const [strategicDocuments, recentDecisions] = await Promise.all([
        getStrategicDocumentsForState(session.user.id, 5000),
        getRecentDecisionsForContext(session.user.id, AgentType.FILER)
      ])

      // Record decision for RL training (Filer schema)
      const state: DecisionState = {
        item: {
          id: item.id,
          title: item.title,
          rawInstructions: item.rawInstructions,
          routingNotes: item.routingNotes
        },
        assignedOpus: opus ? {
          id: opus.id,
          name: opus.name,
          opusType: opus.opusType,
          content: opus.content.substring(0, 1000), // First 1000 chars
          isStrategic: opus.isStrategic
        } : null,
        availableOpuses: opusesList.map(o => ({
          id: o.id,
          name: o.name,
          opusType: o.opusType || "PROJECT"
        })),
        strategicDocuments,
        userContext: {
          currentTime: new Date().toISOString(),
          recentDecisions
        }
      }

      const action: DecisionAction = {
        status: nextStatus,
        swimlane: nextSwimlane,
        priority: nextPriority,
        labels: filerResult.labels,
        confidence: filerResult.confidence,
        reasoning: filerResult.reasoning
      }

      const decision = await recordDecision({
        agentType: AgentType.FILER,
        state,
        action,
        userId: session.user.id,
        modelVersion: getModelVersion(AgentType.FILER),
        itemId: item.id,
        opusId: opus?.id,
        confidence: filerResult.confidence,
        reasoning: filerResult.reasoning
      })

      item = await prisma.item.update({
        where: { id: item.id },
        data: {
          status: nextStatus,
          swimlane: nextSwimlane,
          priority: nextPriority,
          labels: filerResult.labels,
          statusChangedAt: new Date()
        }
      })

      if (previousStatus !== nextStatus) {
        await prisma.statusChange.create({
          data: {
            itemId: item.id,
            fromStatus: previousStatus,
            toStatus: nextStatus,
            changedById: session.user.id,
            aiReasoning: filerResult.reasoning,
            aiConfidence: filerResult.confidence
          }
        })

        // Track outcome if item reached terminal state
        if (nextStatus === ItemStatus.DONE || nextStatus === ItemStatus.COLD_STORAGE) {
          // Set completion timestamp if moving to DONE
          if (nextStatus === ItemStatus.DONE && !item.completedAt) {
            await prisma.item.update({
              where: { id: item.id },
              data: { completedAt: new Date() }
            })
          }

          // Track outcome asynchronously (don't block response)
          void trackItemOutcome(item.id).catch((error) => {
            console.error(`Failed to track outcome for item ${item.id}:`, error)
          })
        }
      }

      // Kick off librarian analysis without blocking response
      const corpus = await prisma.item.findMany({
        where: {
          opusId: item.opusId,
          NOT: { id: item.id }
        },
        select: {
          id: true,
          title: true,
          rawInstructions: true,
          routingNotes: true,
          status: true
        },
        take: 50
      })

      void callAILibrarian({
        New_Item: {
          id: item.id,
          title: item.title,
          raw_instructions: item.rawInstructions,
          routing_notes: item.routingNotes,
          project: opus?.name ?? null
        },
        Strategic_Context: opus?.content ?? "",
        Corpus: corpus
      }).then(async (findings) => {
        if (!findings.length) return

        // Record decision for RL training (Librarian schema)
        const librarianState: DecisionState = {
          newItem: {
            id: item.id,
            title: item.title,
            rawInstructions: item.rawInstructions,
            routingNotes: item.routingNotes,
            opusId: item.opusId || ""
          },
          opus: {
            id: opus?.id || "",
            name: opus?.name || "",
            content: opus?.content || "",
            isStrategic: opus?.isStrategic || false
          },
          corpus: corpus.map(c => ({
            id: c.id,
            title: c.title,
            rawInstructions: c.rawInstructions || "",
            status: c.status
          })),
          strategicDocuments: await getStrategicDocumentsForState(session.user.id, 5000)
        }

        const librarianAction: DecisionAction = {
          findings: findings.map(f => ({
            type: f.type,
            text: f.text,
            confidence: 0.8, // TODO: Get from AI response
            relatedItemIds: [] // TODO: Extract from findings
          })),
          reasoning: `Found ${findings.length} findings: ${findings.map(f => f.type).join(", ")}`
        }

        await recordDecision({
          agentType: AgentType.LIBRARIAN,
          state: librarianState,
          action: librarianAction,
          userId: session.user.id,
          modelVersion: getModelVersion(AgentType.LIBRARIAN),
          itemId: item.id,
          opusId: opus?.id,
          reasoning: `Found ${findings.length} findings: ${findings.map(f => f.type).join(", ")}`
        })

        const typeMap: Record<string, AnalysisType> = {
          Conflict: AnalysisType.CONFLICT,
          Dependency: AnalysisType.DEPENDENCY,
          Redundancy: AnalysisType.REDUNDANCY,
          Relation: AnalysisType.RELATED,
          Suggestion: AnalysisType.SUGGESTION
        }

        const validFindings = findings
          .map((finding) => {
            const mappedType = typeMap[finding.type as keyof typeof typeMap]
            if (!mappedType) return null
            return {
              itemId: item.id,
              analysisType: mappedType,
              analysisText: finding.text
            }
          })
          .filter(Boolean)

        if (!validFindings.length) return

        await prisma.aIAnalysis.createMany({
          data: validFindings as Array<{
            itemId: string
            analysisType: AnalysisType
            analysisText: string
          }>
        })
      }).catch((err) => {
        console.error("AI Librarian scheduling failed:", err)
      })
    }
  }

  return NextResponse.json(item)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.item.findFirst({
    where: {
      id,
      createdByUserId: session.user.id,
      status: ItemStatus.COMPENDIUM // Only allow deletion of compendium items
    }
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.item.delete({
    where: { id }
  })

  return NextResponse.json({ success: true })
}