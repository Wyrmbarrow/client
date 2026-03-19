import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const base = req.nextUrl.searchParams.get("base") || ""
  const key = req.nextUrl.searchParams.get("key") || ""

  if (!base) return NextResponse.json({ models: [] })

  try {
    const url = base.replace(/\/$/, "") + "/models"
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json({ models: [], error: `HTTP ${res.status}` })

    const data = await res.json()
    // OpenAI-compat: { data: [ { id: "..." }, ... ] }
    const models: string[] = [...new Set<string>(
      (data.data ?? data.models ?? [])
        .map((m: { id?: string; name?: string }) => m.id ?? m.name ?? "")
        .filter(Boolean)
    )].sort()

    return NextResponse.json({ models })
  } catch (e) {
    return NextResponse.json({ models: [], error: String(e) })
  }
}
