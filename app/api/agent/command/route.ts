/**
 * POST /api/agent/command
 *
 * Calls an MCP tool directly with specific action and parameters — patron manual command execution.
 * Similar to /api/agent/action but designed for direct patron-issued commands.
 *
 * Body:   { sessionId: string, toolName: string, action: string, params: Record<string, string> }
 * Returns { charState?: unknown, roomState?: unknown, result: unknown } on success
 * Returns { error: string } on failure (4xx/5xx)
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPTools, invalidateMCPSession } from "@/lib/mcp-session-manager"

// Allowed gameplay tools for patron command execution
const ALLOWED_TOOLS = new Set([
  "look",
  "move",
  "explore",
  "character",
  "combat",
  "journal",
  "quest",
  "rest",
  "speak",
  "social",
  "shop",
])

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sessionId, toolName, action, params } = body

  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }
  if (typeof toolName !== "string" || !toolName) {
    return NextResponse.json({ error: "toolName is required" }, { status: 400 })
  }
  if (typeof action !== "string" || !action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 })
  }

  // Check if tool is allowed
  if (!ALLOWED_TOOLS.has(toolName)) {
    return NextResponse.json(
      { error: `Tool not allowed: ${toolName}` },
      { status: 403 }
    )
  }

  const rawParams: Record<string, unknown> =
    params && typeof params === "object" && !Array.isArray(params) ? params : {}

  // Remove empty string values (from unfilled optional params)
  const toolParams: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(rawParams)) {
    if (value !== "" && value !== undefined && value !== null) {
      toolParams[key] = value
    }
  }

  try {
    const tools = await getMCPTools()

    if (!(toolName in tools)) {
      return NextResponse.json(
        { error: `Tool not found: ${toolName}` },
        { status: 404 }
      )
    }

    // Build the parameters for the tool call
    // For tools with actions, pass action; otherwise use default
    const callParams: Record<string, unknown> = {
      session_id: sessionId,
      action: action !== "default" ? action : undefined,
      ...toolParams,
    }

    // Remove undefined values
    Object.keys(callParams).forEach(
      (key) => callParams[key] === undefined && delete callParams[key]
    )

    // Call the tool directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools[toolName] as any).execute(callParams, {
      toolCallId: "command",
      messages: [],
    })

    // Unwrap MCP result format if present
    let unwrappedResult = result
    let parsedData: Record<string, unknown> | null = null
    if (result?.result?.content?.[0]?.text && typeof result.result.content[0].text === "string") {
      try {
        parsedData = JSON.parse(result.result.content[0].text)
      } catch {
        // Not JSON, use result as-is
      }
    }

    // Extract state from the unwrapped/parsed result
    const charState = result?.charState || parsedData?.charState
    const roomState = result?.roomState || parsedData?.room

    return NextResponse.json({
      result,
      // Include updated state if present in result
      ...(charState && { charState }),
      ...(roomState && { roomState }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const is429 = msg.includes("429")
    const is5xx = /\b5\d{2}\b/.test(msg)
    if (is429 || is5xx) invalidateMCPSession()
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
