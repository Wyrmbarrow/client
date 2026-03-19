/**
 * POST /api/agent/init
 *
 * Handles login (existing character) or register (new character).
 * Returns { sessionId, characterName } on success.
 * The caller stores this in sessionStorage; the tab-close clears it.
 */

import { NextRequest, NextResponse } from "next/server"
import { createWyrmbarrowMCPClient } from "@/lib/mcp"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { mode, llmBase, llmKey, model, systemPrompt } = body

  if (!llmBase || !model) {
    return NextResponse.json({ error: "LLM base URL and model are required." }, { status: 400 })
  }

  let client
  try {
    client = await createWyrmbarrowMCPClient()
    const tools = await client.tools()

    if (mode === "login") {
      const { charName, password } = body
      if (!charName || !password) {
        return NextResponse.json({ error: "Character name and password are required." }, { status: 400 })
      }

      const loginTool = tools["auth"]
      if (!loginTool) {
        return NextResponse.json({ error: "MCP auth tool not available." }, { status: 502 })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (loginTool.execute as any)({
        action: "login",
        character_name: charName,
        password,
      })

      const data = typeof result === "string" ? JSON.parse(result) : result
      if (data.error) {
        return NextResponse.json({ error: data.error, detail: data.detail }, { status: 401 })
      }

      const sessionId = data.session_id
      const characterName = data.bootstrap?.character?.name ?? charName

      return NextResponse.json({ sessionId, characterName, bootstrap: data.bootstrap ?? null })
    }

    if (mode === "register") {
      const { regCode, newCharName } = body
      if (!regCode || !newCharName) {
        return NextResponse.json({ error: "Registration code and character name are required." }, { status: 400 })
      }

      const authTool = tools["auth"]
      if (!authTool) {
        return NextResponse.json({ error: "MCP auth tool not available." }, { status: 502 })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (authTool.execute as any)({
        action: "register",
        hash: regCode,
        character_name: newCharName,
      })

      const data = typeof result === "string" ? JSON.parse(result) : result
      if (data.error) {
        return NextResponse.json({ error: data.error }, { status: 400 })
      }

      // Registration returns a permanent_password — surface it to the patron
      return NextResponse.json({
        sessionId: data.session_id,
        characterName: newCharName,
        permanentPassword: data.permanent_password,
        message: data.message,
      })
    }

    return NextResponse.json({ error: "Unknown mode." }, { status: 400 })
  } catch (e) {
    console.error("[agent/init]", e)
    const msg = e instanceof Error ? e.message : String(e)
    const is429 = msg.includes("429")
    return NextResponse.json(
      { error: is429 ? "MCP server is rate-limiting — wait a moment and try again." : `MCP connection failed: ${msg}` },
      { status: 502 }
    )
  } finally {
    client?.close()
  }
}
