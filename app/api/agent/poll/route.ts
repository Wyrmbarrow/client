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
  const { sessionId, tool } = await req.json()

  if (tool !== "look" && tool !== "character") {
    return NextResponse.json({ error: "invalid tool" }, { status: 400 })
  }

  try {
    const tools = await getMCPTools()

    // Call the tool directly — bypasses the LLM entirely.
    // The second argument satisfies the AI SDK tool execute interface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (tools[tool] as any).execute(
      { session_id: sessionId },
      { toolCallId: "poll", messages: [] },
    )

    const output = parseMcpResult(raw)
    const charState = parseCharacterState(tool, output)
    const roomState = parseRoomState(tool, output)

    return NextResponse.json({ charState, roomState })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const is429 = msg.includes("429")
    const is5xx = /\b5\d{2}\b/.test(msg)
    if (is429 || is5xx) invalidateMCPSession()
    return NextResponse.json(
      { error: is429 ? "MCP rate limited" : msg },
      { status: is429 ? 429 : 500 },
    )
  }
}
