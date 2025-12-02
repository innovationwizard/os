import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { callAIRetriever } from "@/lib/ai-retriever"
import { prisma } from "@/lib/prisma"
import type { RetrieverInput } from "@/lib/ai-retriever"

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { query, parameters, relevantOpuses } = await request.json()

    if (!query || !relevantOpuses || relevantOpuses.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Fetch full opus content
    const opusIds = relevantOpuses.map((o: any) => o.id)
    const opuses = await prisma.opus.findMany({
      where: {
        id: { in: opusIds },
        createdByUserId: session.user.id
      },
      select: {
        id: true,
        name: true,
        content: true,
        opusType: true
      }
    })

    const input: RetrieverInput = {
      query,
      parameters: parameters || {},
      relevantOpuses: opuses.map(opus => ({
        id: opus.id,
        name: opus.name,
        content: opus.content,
        opusType: opus.opusType
      }))
    }

    const result = await callAIRetriever(input, session.user.id)

    if (!result.decision || !result.decisionId) {
      return NextResponse.json(
        { error: "Failed to generate document" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      generatedContent: result.decision.generated_document,
      sourceCitations: result.decision.source_citations,
      confidence: result.decision.confidence,
      reasoning: result.decision.reasoning,
      decisionId: result.decisionId
    })
  } catch (error) {
    console.error("AI Retriever error:", error)
    return NextResponse.json(
      { error: "Failed to generate document", details: String(error) },
      { status: 500 }
    )
  }
}
