import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const includeInactive = searchParams.get("includeInactive") === "true"

  const where: {
    isActive?: boolean
    OR?: Array<{ isBuiltIn: boolean } | { createdByUserId: string }>
  } = {
    OR: [
      { isBuiltIn: true },
      { createdByUserId: session.user.id }
    ]
  }

  if (!includeInactive) {
    where.isActive = true
  }

  const types = await prisma.opusTypeConfig.findMany({
    where,
    orderBy: [
      { isBuiltIn: "desc" },
      { label: "asc" }
    ]
  })

  // Get opus counts for each type
  const typesWithCounts = await Promise.all(
    types.map(async (type) => {
      const opusCount = await prisma.opus.count({
        where: {
          opusType: type.key,
          createdByUserId: session.user.id
        }
      })
      return {
        ...type,
        _count: {
          opuses: opusCount
        }
      }
    })
  )

  return NextResponse.json(typesWithCounts)
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key, label, icon, color, textColor, description } = await request.json()

  if (!key || typeof key !== "string") {
    return NextResponse.json(
      { error: "Key is required" },
      { status: 400 }
    )
  }

  if (!label || typeof label !== "string") {
    return NextResponse.json(
      { error: "Label is required" },
      { status: 400 }
    )
  }

  // Validate key format (uppercase, alphanumeric and underscores)
  const keyRegex = /^[A-Z][A-Z0-9_]*$/
  if (!keyRegex.test(key)) {
    return NextResponse.json(
      { error: "Key must be uppercase, start with a letter, and contain only letters, numbers, and underscores" },
      { status: 400 }
    )
  }

  // Check if key already exists
  const existing = await prisma.opusTypeConfig.findUnique({
    where: { key }
  })

  if (existing) {
    return NextResponse.json(
      { error: "A type with this key already exists" },
      { status: 400 }
    )
  }

  const typeConfig = await prisma.opusTypeConfig.create({
    data: {
      key: key.trim().toUpperCase(),
      label: label.trim(),
      icon: icon || "FolderKanban",
      color: color || "bg-blue-100",
      textColor: textColor || "text-blue-700",
      description: description?.trim() || null,
      isBuiltIn: false,
      isActive: true,
      createdByUserId: session.user.id
    },
    select: {
      id: true,
      key: true,
      label: true,
      icon: true,
      color: true,
      textColor: true,
      description: true,
      isBuiltIn: true,
      isActive: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true
    }
  })

  return NextResponse.json(typeConfig)
}
