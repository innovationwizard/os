import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type SessionWithRole = Session & {
  user: {
    id: string
    role?: string | null
  }
}

function isCreator(session: SessionWithRole | null): session is SessionWithRole {
  return Boolean(session?.user?.id && session.user.role === "CREATOR")
}

export async function GET() {
  const session = (await auth()) as SessionWithRole | null
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  // Store user info before type guard check
  const userId = session.user.id
  const userRole = session.user.role
  
  if (!isCreator(session)) {
    console.error("[Projects API] User is not CREATOR:", {
      userId: userId || "unknown",
      role: userRole || "unknown"
    })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const projects = await prisma.opus.findMany({
      where: {
        createdByUserId: session.user.id,
        opusType: "PROJECT"
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    })

    // Transform to match expected format (name -> title, add status field)
    const transformedProjects = projects.map(opus => ({
      id: opus.id,
      title: opus.name,
      status: "ACTIVE", // Opus doesn't have status, defaulting to ACTIVE
      createdAt: opus.createdAt
    }))

    console.log(`[Projects API] Found ${transformedProjects.length} projects for user ${session.user.id}`)
    return NextResponse.json(transformedProjects)
  } catch (error) {
    console.error("[Projects API] Error fetching projects:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = (await auth()) as SessionWithRole | null
  if (!isCreator(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { title } = await request.json()

  if (!title || typeof title !== "string") {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    )
  }

  const trimmed = title.trim()
  if (!trimmed) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    )
  }

  const project = await prisma.opus.create({
    data: {
      name: trimmed,
      content: "",
      opusType: "PROJECT",
      createdByUserId: session.user.id
    },
    select: {
      id: true,
      name: true,
      createdAt: true
    }
  })

  // Transform to match expected format
  return NextResponse.json({
    id: project.id,
    title: project.name,
    status: "ACTIVE",
    createdAt: project.createdAt
  })
}

