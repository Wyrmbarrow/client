import { NextRequest, NextResponse } from "next/server"

// This app runs locally, so localhost/LAN addresses are legitimate (e.g. Ollama).
// Block only link-local ranges used by cloud metadata services (SSRF targets).
const BLOCKED_PATTERNS = [
  /^169\.254\./,  // IPv4 link-local — AWS/GCP/Azure instance metadata
  /^fe80:/i,      // IPv6 link-local
]

function isSafeUrl(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
  const host = parsed.hostname
  return !BLOCKED_PATTERNS.some((re) => re.test(host))
}

export async function GET(req: NextRequest) {
  const base = req.nextUrl.searchParams.get("base") || ""
  const key = req.nextUrl.searchParams.get("key") || ""

  if (!base) return NextResponse.json({ models: [] })

  if (!isSafeUrl(base)) {
    return NextResponse.json({ models: [], error: "Invalid or disallowed base URL" }, { status: 400 })
  }

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
