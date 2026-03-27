/**
 * POST /api/agent/poll
 *
 * Calls `look` or `character` directly via MCP — no LLM involved.
 * Used by the background poller in the session page to keep the
 * Character and Room panels fresh between LLM turns.
 *
 * Body: { sessionId: string, tool: "look" | "character" }
 * Response: { charState?: CharacterState, roomState?: RoomState }
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPTools, invalidateMCPSession } from "@/lib/mcp-session-manager"
import { parseCharacterState, parseRoomState } from "@/lib/parse-state"
import { parseMcpResult } from "@/lib/parse-mcp-result"

export async function POST(req: NextRequest) {
  let sessionId: string, tool: string
  try {
    ;({ sessionId, tool } = await req.json())
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 })
  }

  if (tool !== "look" && tool !== "character") {
    return NextResponse.json({ error: "invalid tool" }, { status: 400 })
  }

  try {
    // Poll calls are low-priority: single attempt only, no retry.
    // On 429, return immediately so the client-side 30s backoff engages,
    // preserving MCP quota for agent calls.
    const tools = await getMCPTools()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (tools[tool] as any).execute({ session_id: sessionId }, { toolCallId: "mcp", messages: [] })

    const output = parseMcpResult(raw)
    const charState = parseCharacterState(tool, output)
    const roomState = parseRoomState(tool, output)

    return NextResponse.json({ charState, roomState })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const is429 = msg.includes("429") || msg.includes("Too Many Requests")
    const is5xx = /\b5\d{2}\b/.test(msg)
    // On 5xx: drop the cached session so the next caller gets a fresh client.
    // On 429: keep the session alive — tearing it down creates more requests.
    if (is5xx) invalidateMCPSession()
    return NextResponse.json(
      { error: is429 ? "MCP rate limited" : msg },
      { status: is429 ? 429 : 500 },
    )
  }
}
