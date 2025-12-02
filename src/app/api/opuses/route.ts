import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const opusType = searchParams.get("opusType")

  const where: {
    createdByUserId: string
    opusType?: string
  } = {
    createdByUserId: session.user.id
  }

  if (opusType) {
    where.opusType = opusType
  }

  const opuses = await prisma.opus.findMany({
    where,
    orderBy: { createdAt: "desc" },
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

  return NextResponse.json(opuses)
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, content, raisonDetre, opusType, isStrategic, isDynamic } = await request.json()

  if (!name || typeof name !== "string") {
    return NextResponse.json(
      { error: "Name is required" },
      { status: 400 }
    )
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    return NextResponse.json(
      { error: "Name cannot be empty" },
      { status: 400 }
    )
  }

  if (opusType && !Object.values(OpusType).includes(opusType)) {
    return NextResponse.json(
      { error: "Invalid opus type" },
      { status: 400 }
    )
  }

  const opus = await prisma.opus.create({
    data: {
      name: trimmedName,
      content: content?.trim() || "",
      raisonDetre: raisonDetre?.trim() || "",
      opusType: opusType || "PROJECT",
      isStrategic: Boolean(isStrategic),
      isDynamic: Boolean(isDynamic),
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

  return NextResponse.json(opus)
}
