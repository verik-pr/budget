import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/data/uploads"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const allowed = ["jpg", "jpeg", "png", "webp", "heic"]
  if (!allowed.includes(ext)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 })

  const filename = `${uuidv4()}.${ext}`
  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(join(UPLOAD_DIR, filename), buffer)

  return NextResponse.json({ filename })
}
