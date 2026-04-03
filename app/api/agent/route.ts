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

import { NextRequest, NextResponse } from "next/server"
import { streamText, stepCountIs } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { getMCPTools, invalidateMCPSession } from "@/lib/mcp-session-manager"
import { parseCharacterState, parseRoomState } from "@/lib/parse-state"
import { parseMcpResult } from "@/lib/parse-mcp-result"
import { checkLLMRateLimit } from "@/lib/rate-limit"
import type { AgentEvent } from "@/lib/types"

const MAX_STEPS = 50

/**
 * TransformStream that rewrites `reasoning_content` → `content` in SSE chunks.
 * Some OpenAI-compatible models (e.g. glm4) stream all output as
 * `reasoning_content` which @ai-sdk/openai ignores.
 */
function createReasoningTransform(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  return new TransformStream({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true })
      if (!text.includes("reasoning_content")) {
        controller.enqueue(chunk)
        return
      }
      const patched = text.replace(
        /^data: (.+)$/gm,
        (_line, json) => {
          try {
            const parsed = JSON.parse(json)
            for (const choice of parsed.choices ?? []) {
              const d = choice.delta
              if (d && d.reasoning_content && !d.content) {
                d.content = d.reasoning_content
                d.reasoning_content = null
              }
            }
            return `data: ${JSON.stringify(parsed)}`
          } catch {
            return _line
          }
        },
      )
      controller.enqueue(encoder.encode(patched))
    },
  })
}

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
    isFollower,
  } = await req.json()

  // Pre-flight rate limit check: reject if global LLM quota exhausted
  const { allowed, resetAt } = checkLLMRateLimit()
  if (!allowed) {
    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "LLM rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Reset": new Date(resetAt).toISOString(),
        },
      },
    )
  }

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      function send(event: AgentEvent) {
        if (signal.aborted) return
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        // Only shallow-copy when we need to wrap the move tool for followers.
        // Spreading the MCP tool map can lose non-enumerable properties that
        // streamText depends on for schema generation.
        const sharedTools = await getMCPTools()
        const tools = isFollower && "move" in sharedTools
          ? { ...sharedTools }
          : sharedTools

        // Suppress room-exit moves for follower agents — zone moves (closer/farther) are still allowed
        if (isFollower && "move" in tools) {
          const originalMove = tools["move"]
          tools["move"] = {
            ...originalMove,
            execute: async (params: unknown, ctx: unknown) => {
              const dir = (params as Record<string, unknown>)?.direction
              if (dir !== "closer" && dir !== "farther") {
                return {
                  success: false,
                  message: "Movement suppressed: party follower cannot leave this room while following the leader.",
                }
              }
              return (originalMove as { execute: (p: unknown, c: unknown) => unknown }).execute(params, ctx)
            },
          } as typeof originalMove
        }

        // LLM provider — any OpenAI-compat endpoint.
        // Custom fetch handles two quirks:
        //  1. noToolChoice: strip tool_choice for servers that reject "auto"
        //  2. reasoning_content → content: some models (e.g. glm4) stream all output
        //     as reasoning_content which @ai-sdk/openai doesn't parse — remap it so
        //     the SDK sees it as normal text-delta content.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = createOpenAI({ baseURL: llmBase.trim(), apiKey: llmKey.trim(), compatibility: "compatible",
          fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
            if (options?.body) {
              try {
                const body = JSON.parse(options.body as string)
                if (noToolChoice) delete body.tool_choice
                const resp = await fetch(url, { ...options, body: JSON.stringify(body) })
                if (!resp.body) return resp
                // Pipe through the reasoning transform — pipeThrough preserves
                // the stream chain so the AI SDK reads from the transformed body.
                const transformed = resp.body.pipeThrough(createReasoningTransform())
                return new Response(transformed, {
                  status: resp.status,
                  statusText: resp.statusText,
                  headers: resp.headers,
                })
              } catch { /* fall through */ }
            }
            return fetch(url, options)
          },
        } as Parameters<typeof createOpenAI>[0])
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
          maxRetries: 0,
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
              send({ type: "error", message: sanitizeMcpError([
                status ? `HTTP ${status}` : null,
                msg,
                body ? `— ${typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}` : null,
              ].filter(Boolean).join(" ")) })
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
          const msg = err instanceof Error ? err.message : String(err)
          const is429 = msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("Rate limit") || msg.includes("Too many requests")
          const isMcpError = msg.includes("MCP")

          // On non-429, non-MCP errors the shared client may be in a bad state — drop it.
          // On 429: keep the session alive — tearing it down creates more requests.
          if (!is429 && !isMcpError) {
            invalidateMCPSession()
          }

          const cleanMsg = is429
            ? "LLM provider rate limited — client will retry with exponential backoff"
            : sanitizeMcpError(msg)
          send({ type: "error", message: cleanMsg })
        }
      } finally {
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
// Sanitize MCP transport error messages before sending to the client.
// The AI SDK MCP transport builds errors like:
//   "MCP HTTP Transport Error: POSTing to endpoint (HTTP 429): <html>..."
// Strip the raw nginx HTML body and replace with a clean status line.
// ---------------------------------------------------------------------------

function sanitizeMcpError(msg: string): string {
  const httpMatch = msg.match(/MCP HTTP Transport Error[^(]*\(HTTP (\d+)\)/)
  if (httpMatch) {
    const status = httpMatch[1]
    if (status === "429") return "MCP server rate limited (HTTP 429)"
    return `MCP transport error (HTTP ${status})`
  }
  // Strip any stray HTML that leaked through from other sources
  if (/<[a-z]/i.test(msg)) {
    return msg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)
  }
  return msg
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
