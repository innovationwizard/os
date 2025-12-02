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

  const typeConfig = await prisma.opusTypeConfig.findFirst({
    where: {
      id,
      OR: [
        { isBuiltIn: true },
        { createdByUserId: session.user.id }
      ]
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

  if (!typeConfig) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(typeConfig)
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
  const { label, icon, color, textColor, description, isActive } = await request.json()

  // Verify ownership (can't edit built-in types, only user-created ones)
  const existing = await prisma.opusTypeConfig.findFirst({
    where: {
      id,
      createdByUserId: session.user.id,
      isBuiltIn: false
    }
  })

  if (!existing) {
    return NextResponse.json(
      { error: "Not found or cannot edit built-in types" },
      { status: 404 }
    )
  }

  const data: {
    label?: string
    icon?: string
    color?: string
    textColor?: string
    description?: string | null
    isActive?: boolean
  } = {}

  if (label !== undefined) {
    const trimmed = typeof label === "string" ? label.trim() : String(label).trim()
    if (!trimmed) {
      return NextResponse.json(
        { error: "Label cannot be empty" },
        { status: 400 }
      )
    }
    data.label = trimmed
  }

  if (icon !== undefined) {
    data.icon = typeof icon === "string" ? icon : String(icon)
  }

  if (color !== undefined) {
    data.color = typeof color === "string" ? color : String(color)
  }

  if (textColor !== undefined) {
    data.textColor = typeof textColor === "string" ? textColor : String(textColor)
  }

  if (description !== undefined) {
    data.description = description === null || description === "" ? null : String(description).trim()
  }

  if (typeof isActive === "boolean") {
    data.isActive = isActive
  }

  const typeConfig = await prisma.opusTypeConfig.update({
    where: { id },
    data,
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
  const existing = await prisma.opusTypeConfig.findFirst({
    where: {
      id,
      createdByUserId: session.user.id,
      isBuiltIn: false
    }
  })

  if (!existing) {
    return NextResponse.json(
      { error: "Not found or cannot delete built-in types" },
      { status: 404 }
    )
  }

  // Check if any opuses are using this type
  const opusCount = await prisma.opus.count({
    where: {
      opusType: existing.key,
      createdByUserId: session.user.id
    }
  })

  if (opusCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete type: ${opusCount} opus(es) are using this type` },
      { status: 400 }
    )
  }

  await prisma.opusTypeConfig.delete({
    where: { id }
  })

  return NextResponse.json({ success: true })
}
