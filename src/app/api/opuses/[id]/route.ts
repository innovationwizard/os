import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const opus = await prisma.opus.findFirst({
    where: {
      id,
      createdByUserId: session.user.id
    },
    select: {
      id: true,
      name: true,
      content: true,
      raisonDetre: true,
      opusType: true,
      isStrategic: true,
      isDynamic: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          items: true
        }
      }
    }
  })

  if (!opus) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(opus)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { name, content, raisonDetre, opusType, isStrategic, isDynamic } = await request.json()

  // Verify ownership
  const existing = await prisma.opus.findFirst({
    where: {
      id,
      createdByUserId: session.user.id
    }
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const data: {
    name?: string
    content?: string
    raisonDetre?: string
    opusType?: string
    isStrategic?: boolean
    isDynamic?: boolean
  } = {}

  if (name !== undefined) {
    const trimmed = typeof name === "string" ? name.trim() : String(name).trim()
    if (!trimmed) {
      return NextResponse.json(
        { error: "Name cannot be empty" },
        { status: 400 }
      )
    }
    data.name = trimmed
  }

  if (content !== undefined) {
    data.content = typeof content === "string" ? content : String(content)
  }

  if (raisonDetre !== undefined) {
    data.raisonDetre = typeof raisonDetre === "string" ? String(raisonDetre) : String(raisonDetre)
  }

  if (opusType !== undefined) {
    // Validate that opusType exists in OpusTypeConfig
    const typeConfig = await prisma.opusTypeConfig.findUnique({
      where: { key: opusType }
    })
    if (!typeConfig) {
      return NextResponse.json(
        { error: "Invalid opus type" },
        { status: 400 }
      )
    }
    data.opusType = opusType
  }

  if (typeof isStrategic === "boolean") {
    data.isStrategic = isStrategic
  }

  if (typeof isDynamic === "boolean") {
    data.isDynamic = isDynamic
  }

  const opus = await prisma.opus.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      content: true,
      raisonDetre: true,
      opusType: true,
      isStrategic: true,
      isDynamic: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          items: true
        }
      }
    }
  })

  return NextResponse.json(opus)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify ownership
  const existing = await prisma.opus.findFirst({
    where: {
      id,
      createdByUserId: session.user.id
    },
    include: {
      _count: {
        select: {
          items: true
        }
      }
    }
  })

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Prevent deletion if opus has items
  if (existing._count.items > 0) {
    return NextResponse.json(
      { error: "Cannot delete opus with associated items" },
      { status: 400 }
    )
  }

  await prisma.opus.delete({
    where: { id }
  })

  return NextResponse.json({ success: true })
}
