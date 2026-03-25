/**
 * POST /api/agent/action
 *
 * Calls an MCP tool directly on behalf of a specific agent session — no LLM involved.
 * Used by the usePartyMode orchestrator hook to issue commands (party_invite, party_accept,
 * social, etc.) programmatically without going through the agent loop.
 *
 * Body:   { sessionId: string, tool: string, params?: Record<string, unknown> }
 * Returns { result: unknown }  on success
 * Returns { error: string }    on failure (4xx/5xx)
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPTools, invalidateMCPSession } from "@/lib/mcp-session-manager"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sessionId, tool, params } = body

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }
  if (typeof tool !== "string" || !tool) {
    return NextResponse.json({ error: "tool is required" }, { status: 400 })
  }

  // All party operations go through the "social" tool with different action params.
  const PARTY_ACTION_TOOLS = new Set(["social"])
  if (!PARTY_ACTION_TOOLS.has(tool)) {
    return NextResponse.json({ error: `Tool not allowed: ${tool}` }, { status: 403 })
  }

  const rawParams: Record<string, unknown> =
    params && typeof params === "object" && !Array.isArray(params) ? params : {}
  const { session_id: _dropped, ...toolParams } = rawParams

  try {
    const tools = await getMCPTools()

    if (!(tool in tools)) {
      return NextResponse.json({ error: `Tool not found: ${tool}` }, { status: 404 })
    }

    // Call the tool directly — bypasses the LLM entirely.
    // The second argument satisfies the AI SDK tool execute interface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools[tool] as any).execute(
      { session_id: sessionId, ...toolParams },
      { toolCallId: "action", messages: [] },
    )

    return NextResponse.json({ result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const is429 = msg.includes("429")
    const is5xx = /\b5\d{2}\b/.test(msg)
    if (is429 || is5xx) invalidateMCPSession()
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
