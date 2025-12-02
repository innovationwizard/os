import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Feedback } from "@prisma/client"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { feedback, correction } = await request.json()

  if (!feedback || !Object.values(Feedback).includes(feedback)) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 })
  }

  // Verify the status change belongs to an item owned by the user
  const statusChange = await prisma.statusChange.findFirst({
    where: {
      id,
      item: {
        createdByUserId: session.user.id
      }
    },
    include: {
      item: true
    }
  })

  if (!statusChange) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // If correcting, update the item with corrected values
  if (feedback === Feedback.CORRECTED && correction) {
    const updateData: {
      swimlane?: string
      priority?: string
      labels?: string[]
    } = {}

    if (correction.swimlane) {
      updateData.swimlane = correction.swimlane
    }
    if (correction.priority) {
      updateData.priority = correction.priority
    }
    if (correction.labels) {
      updateData.labels = correction.labels
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.item.update({
        where: { id: statusChange.itemId },
        data: updateData
      })
    }
  }

  // Update the status change with feedback
  const updated = await prisma.statusChange.update({
    where: { id },
    data: {
      userFeedback: feedback as Feedback,
      userCorrection: correction ? correction : null
    }
  })

  return NextResponse.json(updated)
}
