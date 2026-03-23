/**
 * POST /api/agent
 *
 * Starts the agent loop. Streams custom SSE events to the client:
 *   { type: "thinking",    text }
 *   { type: "tool_call",   tool, input }
 *   { type: "tool_result", tool, result }
 *   { type: "state",       state: CharacterState }
 *   { type: "room",        room: RoomState }
 *   { type: "done",        reason }
 *   { type: "error",       message }
 *
 * The stream ends when:
 *   - 50 steps are exhausted (patron sees "Resume" button)
 *   - The browser tab closes (AbortSignal fires)
 *   - An unrecoverable error occurs
 */

import { NextRequest } from "next/server"
import { streamText, stepCountIs } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createMCPClient } from "@ai-sdk/mcp"
import { parseCharacterState, parseRoomState } from "@/lib/parse-state"
import { parseMcpResult } from "@/lib/parse-mcp-result"
import type { AgentEvent } from "@/lib/types"

const MCP_URL = process.env.WYRMBARROW_MCP_URL ?? "https://mcp.wyrmbarrow.com/mcp"
const MAX_STEPS = 50

export async function POST(req: NextRequest) {
  const signal = req.signal
  const {
    sessionId,
    llmBase,
    llmKey,
    model: modelName,
    systemPrompt,
    characterName,
    directive,
    nudge,
    bootstrap,
    resumeContext,
    noToolChoice,
  } = await req.json()

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      function send(event: AgentEvent) {
        if (signal.aborted) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | undefined

      try {
        // Connect to Wyrmbarrow MCP
        mcpClient = await createMCPClient({
          transport: { type: "http", url: MCP_URL },
        })
        const tools = await mcpClient.tools()

        // LLM provider — any OpenAI-compat endpoint
        // Some servers (vLLM without --enable-auto-tool-choice) reject tool_choice: "auto".
        // When noToolChoice is set, we strip the field so the model decides based on training.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = createOpenAI({ baseURL: llmBase.trim(), apiKey: llmKey.trim(), compatibility: "compatible", ...(noToolChoice && {
          fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
            if (options?.body) {
              try {
                const body = JSON.parse(options.body as string)
                delete body.tool_choice
                return fetch(url, { ...options, body: JSON.stringify(body) })
              } catch { /* fall through */ }
            }
            return fetch(url, options)
          },
        }) } as Parameters<typeof createOpenAI>[0])
        // .chat() forces /v1/chat/completions — provider(model) now defaults to /v1/responses in v3

        // Build system prompt, injecting active directive if present
        let system = systemPrompt ?? ""
        if (directive) {
          system += `\n\n## Current Patron Directive\n${directive}`
        }

        // Seed messages: session context + optional nudge
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = []

        // Always inject session_id — the agent needs it for every tool call.
        // On the first run we include the full bootstrap; on resume a brief reminder.
        if (bootstrap) {
          const ctx = formatBootstrap(bootstrap, sessionId)
          if (ctx) messages.push({ role: "user", content: ctx })
        } else {
          messages.push({
            role: "user",
            content: formatResumeContext(resumeContext, sessionId),
          })
        }

        if (nudge) {
          messages.push({
            role: "user",
            content: `(Your patron whispers: ${nudge})`,
          })
        }

        // Run the agent loop
        const result = streamText({
          model: provider.chat(modelName),
          system,
          messages,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
          abortSignal: signal,
          onStepFinish({ toolResults }) {
            for (const tr of toolResults ?? []) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = (tr as any).result ?? (tr as any).output
              const output = parseMcpResult(raw)
              const charState = parseCharacterState(tr.toolName, output)
              if (charState) send({ type: "state", state: charState })

              // move results have pulse_resources at top level but no character sheet
              if (!charState && output.pulse_resources) {
                const pr = output.pulse_resources as Record<string, number>
                send({ type: "resources", resources: {
                  action:       pr.action       ?? 0,
                  movement:     pr.movement      ?? 0,
                  bonus_action: pr.bonus_action  ?? 0,
                  reaction:     pr.reaction      ?? 0,
                  chat:         pr.chat          ?? 0,
                }})
              }

              const roomState = parseRoomState(tr.toolName, output)
              if (roomState) send({ type: "room", room: roomState })
            }
          },
        })

        // Consume the stream and emit events
        let thinkingBuffer = ""

        for await (const chunk of result.fullStream) {
          if (signal.aborted) break

          switch (chunk.type) {
            case "text-delta":
              thinkingBuffer += chunk.text
              // Emit in small chunks so the UI feels live
              if (thinkingBuffer.includes("\n") || thinkingBuffer.length > 80) {
                send({ type: "thinking", text: thinkingBuffer })
                thinkingBuffer = ""
              }
              break

            case "reasoning-start":
            case "reasoning-delta":
            case "reasoning-end":
              // Extended thinking from models that support it
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              send({ type: "thinking", text: (chunk as any).textDelta ?? (chunk as any).reasoning ?? "" })
              break

            case "tool-call":
              // Flush any pending thinking text first
              if (thinkingBuffer.trim()) {
                send({ type: "thinking", text: thinkingBuffer })
                thinkingBuffer = ""
              }
              send({ type: "tool_call", tool: chunk.toolName, input: chunk.input as Record<string, unknown> })
              break

            case "tool-result": {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = (chunk as any).result ?? (chunk as any).output
              send({ type: "tool_result", tool: chunk.toolName, result: parseMcpResult(raw) })
            }
              break

            case "error": {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const e = (chunk as any).error
              const msg = e?.message ?? String(e ?? "Unknown error")
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const status = (e as any)?.statusCode ?? (e as any)?.status
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const body = (e as any)?.responseBody ?? (e as any)?.data
              send({ type: "error", message: [
                status ? `HTTP ${status}` : null,
                msg,
                body ? `— ${typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}` : null,
              ].filter(Boolean).join(" ") })
              break
            }
          }
        }

        // Flush remaining thinking text
        if (thinkingBuffer.trim() && !signal.aborted) {
          send({ type: "thinking", text: thinkingBuffer })
        }

        const finishReason = (await result.finishReason) ?? "stop"
        if (!signal.aborted) {
          send({ type: "done", reason: finishReason === "stop" ? "stop" : finishReason })
        }
      } catch (err) {
        if (!signal.aborted) {
          send({ type: "error", message: err instanceof Error ? err.message : String(err) })
        }
      } finally {
        await mcpClient?.close()
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

// ---------------------------------------------------------------------------
// Format polled state as a resume context message (used on every restart)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatResumeContext(ctx: { charState: any; roomState: any } | undefined, sessionId: string): string {
  const parts: string[] = [`Your session ID is: ${sessionId}`, ""]

  if (ctx?.charState) {
    const c = ctx.charState
    parts.push(`You are ${c.name}${c.class ? ` (${c.class} ${c.level ?? 1})` : ""}.`)
    parts.push(`HP: ${c.hpCurrent}/${c.hpMax}${c.ac != null ? `  AC: ${c.ac}` : ""}`)
    if (c.conditions?.length) parts.push(`Conditions: ${c.conditions.join(", ")}`)
    if (c.isDying) parts.push("⚠ YOU ARE DYING — make Death Saves each Pulse.")
    const zones = c.engagementZones ? Object.entries(c.engagementZones) : []
    if (zones.length) parts.push(`⚠ COMBAT: ${zones.map(([k, v]) => `${k} (${v})`).join(", ")}`)
    if (c.resources) {
      const r = c.resources
      parts.push(`Resources: action=${r.action} movement=${r.movement} bonus=${r.bonus_action} reaction=${r.reaction} chat=${r.chat}`)
    }
    parts.push("")
  }

  if (ctx?.roomState) {
    const r = ctx.roomState
    parts.push(`Location: ${r.name}${r.hub != null ? ` (Hub ${r.hub})` : ""}${r.isSanctuary ? " — Sanctuary" : ""}`)
    if (r.exits?.length) parts.push(`Exits: ${r.exits.map((e: { key: string }) => e.key).join(", ")}`)
    if (r.npcs?.length) parts.push(`NPCs here: ${r.npcs.join(", ")}`)
    if (r.characters?.length) parts.push(`Party/players here: ${r.characters.join(", ")}`)
    parts.push("")
  }

  parts.push("Continue your session. This context is current — no need to call look() or character() unless you want more detail.")
  return parts.join("\n")
}

// ---------------------------------------------------------------------------
// Format the login bootstrap as an initial context message
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatBootstrap(bootstrap: any, sessionId: string): string {
  if (!bootstrap) return ""

  const parts: string[] = [`Your session ID is: ${sessionId}`, ""]

  const char = bootstrap.character
  if (char) {
    // bootstrap.character has: name, charsheet (with hp/ac/class/level), conditions, pulse_resources
    const charName: string = char.name ?? sessionId
    const sub = char.charsheet ?? {}
    const hp: number | undefined = sub.hp_current
    const hpMax: number | undefined = sub.hp_max
    const ac: number | undefined = sub.ac
    const cls: string | undefined = sub.class
    const lvl: number | undefined = sub.level

    const classStr = cls ? ` (${cls}${lvl != null ? ` ${lvl}` : ""})` : ""
    parts.push(`You are ${charName}${classStr}.`)
    if (hp != null) parts.push(`HP: ${hp}/${hpMax ?? "?"}${ac != null ? `  AC: ${ac}` : ""}`)

    const conditions: string[] = char.conditions ?? []
    if (conditions.length) parts.push(`Conditions: ${conditions.join(", ")}`)

    // Warn about active combat engagements
    const zones: Record<string, string> = char.engagement_zones ?? {}
    const engaged = Object.entries(zones)
    if (engaged.length) {
      parts.push(`⚠ COMBAT: ${engaged.map(([k, v]) => `${k} (${v})`).join(", ")}`)
    }
    if (char.is_dying) parts.push("⚠ YOU ARE DYING — make Death Saves each Pulse.")

    parts.push("")
  }

  const loc = bootstrap.location
  if (loc) {
    parts.push(`Location: ${loc.name}${loc.hub ? ` (Hub: ${loc.hub})` : ""}${loc.is_sanctuary ? " — Sanctuary" : ""}`)
    parts.push("")
  }

  const quests = bootstrap.active_quests
  if (quests?.length) {
    parts.push(`Active quests: ${quests.map((q: { quest_id?: string }) => q.quest_id ?? q).join(", ")}`)
    parts.push("")
  }

  const journal = bootstrap.recent_journal
  if (journal?.length) {
    parts.push("Recent journal entries:")
    for (const e of journal.slice(0, 2)) {
      parts.push(`— [${e.type ?? e.entry_type}] ${(e.content ?? "").slice(0, 120)}...`)
    }
    parts.push("")
  }

  parts.push("Begin your session. Call look() to orient yourself.")

  return parts.join("\n")
}
