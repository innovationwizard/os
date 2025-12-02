import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Feedback } from "@prisma/client"
import { updateDecisionFeedback } from "@/lib/decision-recorder"

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

  // Verify the decision belongs to an item owned by the user
  const decision = await prisma.decision.findFirst({
    where: {
      id,
      item: {
        createdByUserId: session.user.id
      }
    }
  })

  if (!decision) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Update the decision with feedback
  const updated = await updateDecisionFeedback(
    id,
    feedback as Feedback,
    correction
  )

  return NextResponse.json(updated)
}
