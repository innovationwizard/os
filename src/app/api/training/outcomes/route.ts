import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { trackPendingOutcomes } from "@/lib/outcome-tracker"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/training/outcomes
 * Returns count of items that need outcome tracking
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Count items in terminal states with untracked decisions
    const count = await prisma.item.count({
      where: {
        createdByUserId: session.user.id,
        status: {
          in: ["DONE", "COLD_STORAGE"]
        },
        decisions: {
          some: {
            outcomeObservedAt: null
          }
        }
      }
    })

    return NextResponse.json({
      pendingCount: count
    })
  } catch (error) {
    console.error("Failed to get pending outcomes count:", error)
    return NextResponse.json(
      { error: "Failed to get pending outcomes count", details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/training/outcomes
 * Manually trigger outcome tracking for pending items
 * 
 * Authentication: Either requires valid session OR internal API key (for cron jobs)
 */
export async function POST(request: NextRequest) {
  // Check for internal API key (for cron jobs)
  const apiKey = request.headers.get("x-internal-api-key")
  const isInternalCall = apiKey === process.env.INTERNAL_API_KEY

  // If not internal call, require authentication
  if (!isInternalCall) {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const { limit } = await request.json().catch(() => ({}))
    const result = await trackPendingOutcomes(limit || 100)

    console.log(`[Cron] Outcome tracking complete: ${result.processed} processed, ${result.errors} errors`)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error("Failed to track pending outcomes:", error)
    return NextResponse.json(
      { error: "Failed to track pending outcomes", details: String(error) },
      { status: 500 }
    )
  }
}
