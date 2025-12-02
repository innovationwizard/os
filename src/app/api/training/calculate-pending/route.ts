import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { calculatePendingRewards } from "@/lib/reward-calculator"

/**
 * Background job endpoint to calculate rewards for pending decisions
 * Can be called via cron job or scheduled task
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
    const result = await calculatePendingRewards()

    console.log(`[Cron] Reward calculation complete: ${result.processed} processed, ${result.errors} errors`)

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      message: `Processed ${result.processed} decisions, ${result.errors} errors`
    })
  } catch (error) {
    console.error("Error calculating pending rewards:", error)
    return NextResponse.json(
      { error: "Failed to calculate pending rewards", details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check pending rewards status
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { prisma } = await import("@/lib/prisma")
  const { ItemStatus } = await import("@prisma/client")

  const pendingCount = await prisma.decision.count({
    where: {
      userId: session.user.id,
      reward: null,
      item: {
        OR: [
          { status: ItemStatus.DONE },
          { status: ItemStatus.COLD_STORAGE }
        ]
      }
    }
  })

  return NextResponse.json({
    pendingRewards: pendingCount,
    message: `${pendingCount} decisions are ready for reward calculation`
  })
}
