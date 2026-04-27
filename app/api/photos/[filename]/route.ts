import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { readFile } from "fs/promises"
import { join } from "path"

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/data/uploads"

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const { filename: rawFilename } = await params
  const filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, "")
  if (!filename) return new NextResponse("Not found", { status: 404 })

  try {
    const file = await readFile(join(UPLOAD_DIR, filename))
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg"
    const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg"
    return new NextResponse(file, { headers: { "Content-Type": contentType, "Cache-Control": "max-age=31536000" } })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
