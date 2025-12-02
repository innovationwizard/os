import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { exportTrainingData } from "@/lib/training-export"
import { AgentType } from "@prisma/client"

/**
 * Export training data to a file
 * GET /api/training/export-file?agentType=FILER&limit=1000&minReward=-2.0&requireFeedback=false
 */
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const agentTypeParam = searchParams.get("agentType")
  const limit = parseInt(searchParams.get("limit") || "1000")
  const minReward = parseFloat(searchParams.get("minReward") || "-2.0")
  const requireFeedback = searchParams.get("requireFeedback") === "true"
  const requireReward = searchParams.get("requireReward") !== "false" // Default true

  if (!agentTypeParam || !Object.values(AgentType).includes(agentTypeParam as AgentType)) {
    return NextResponse.json(
      { error: "Invalid agentType. Must be one of: FILER, LIBRARIAN, PRIORITIZER, STORER, RETRIEVER" },
      { status: 400 }
    )
  }

  const agentType = agentTypeParam as AgentType

  try {
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `training-${agentType.toLowerCase()}-${timestamp}.jsonl`
    const outputPath = `/tmp/${filename}` // Use /tmp for serverless environments

    // Export training data
    const stats = await exportTrainingData(agentType, outputPath, {
      limit,
      minReward,
      requireFeedback,
      requireReward
    })

    // Read file and return as download
    const fs = await import("fs")
    if (!fs.existsSync(outputPath)) {
      return NextResponse.json({ error: "Failed to create export file" }, { status: 500 })
    }

    const fileContent = fs.readFileSync(outputPath, "utf-8")

    // Clean up temp file
    fs.unlinkSync(outputPath)

    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error("Error exporting training data:", error)
    return NextResponse.json(
      { error: "Failed to export training data", details: String(error) },
      { status: 500 }
    )
  }
}
