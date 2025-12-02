import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ItemStatus } from "@prisma/client"

const WORKFLOW_STATUSES = [
  ItemStatus.TODO,
  ItemStatus.ON_HOLD,
  ItemStatus.CREATING,
  ItemStatus.IN_REVIEW,
  ItemStatus.BLOCKED,
  ItemStatus.DONE
]

export async function GET(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const items = await prisma.item.findMany({
    where: {
      createdByUserId: session.user.id,
      status: {
        in: WORKFLOW_STATUSES
      }
    },
    select: {
      id: true,
      humanId: true,
      title: true,
      rawInstructions: true,
      status: true,
      priority: true,
      swimlane: true,
      labels: true,
      createdAt: true,
      statusChangedAt: true,
      order: true,
      opusId: true,
      createdBy: {
        select: {
          email: true
        }
      },
      statusHistory: {
        where: {
          aiReasoning: {
            not: null
          }
        },
        orderBy: {
          changedAt: 'desc'
        },
        take: 1,
        select: {
          id: true,
          aiReasoning: true,
          aiConfidence: true,
          userFeedback: true,
          userCorrection: true
        }
      }
    },
    orderBy: [
      { priority: 'asc' },
      { statusChangedAt: 'asc' }
    ]
  })

  return NextResponse.json(items)
}