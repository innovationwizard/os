import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { trackPendingOutcomes } from "@/lib/outcome-tracker"

/**
 * Manually trigger outcome tracking for pending items
 * POST /api/training/track-outcomes?limit=100
 */
export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = parseInt(searchParams.get("limit") || "100")

  try {
    const result = await trackPendingOutcomes(limit)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.processed} items, updated ${result.updated} decisions, calculated ${result.rewardsCalculated} rewards`
    })
  } catch (error) {
    console.error("Error tracking outcomes:", error)
    return NextResponse.json(
      { error: "Failed to track outcomes", details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check pending outcomes
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")
  const { ItemStatus } = await import("@prisma/client")

  // Count items in terminal states with untracked decisions
  const pendingCount = await prisma.item.count({
    where: {
      createdByUserId: session.user.id,
      status: {
        in: [ItemStatus.DONE, ItemStatus.COLD_STORAGE]
      },
      decisions: {
        some: {
          outcomeObservedAt: null
        }
      }
    }
  })

  return NextResponse.json({
    pendingOutcomes: pendingCount,
    message: `${pendingCount} items need outcome tracking`
  })
}
