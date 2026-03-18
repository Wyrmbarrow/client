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
        const provider = createOpenAI({ baseURL: llmBase, apiKey: llmKey })

        // Build system prompt, injecting active directive if present
        let system = systemPrompt ?? ""
        if (directive) {
          system += `\n\n## Current Patron Directive\n${directive}`
        }

        // Seed messages: bootstrap context + optional nudge
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = []

        if (bootstrap) {
          const ctx = formatBootstrap(bootstrap, sessionId)
          if (ctx) messages.push({ role: "user", content: ctx })
        }

        if (nudge) {
          messages.push({
            role: "user",
            content: `(Your patron whispers: ${nudge})`,
          })
        }

        // If no seed messages, prime with a minimal prompt so the agent
        // doesn't wait for user input — it should act autonomously.
        if (messages.length === 0) {
          messages.push({ role: "user", content: "Begin." })
        }

        // Run the agent loop
        const result = streamText({
          model: provider(modelName),
          system,
          messages,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
          abortSignal: signal,
          onStepFinish({ toolResults }) {
            for (const tr of toolResults ?? []) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const output = (tr as any).result ?? (tr as any).output
              const charState = parseCharacterState(tr.toolName, output)
              if (charState) send({ type: "state", state: charState })

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
              const toolOutput = (chunk as any).result ?? (chunk as any).output
              send({ type: "tool_result", tool: chunk.toolName, result: toolOutput })
            }
              break

            case "error":
              send({ type: "error", message: String((chunk as { error?: unknown }).error ?? "Unknown error") })
              break
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
// Format the login bootstrap as an initial context message
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatBootstrap(bootstrap: any, sessionId: string): string {
  if (!bootstrap) return ""

  const parts: string[] = [`Your session ID is: ${sessionId}`, ""]

  const char = bootstrap.character
  if (char) {
    parts.push(`You are ${char.name ?? "unknown"}, level ${char.level ?? 1} ${char.class ?? "adventurer"}.`)
    parts.push(`HP: ${char.hp_current ?? "?"}/${char.hp_max ?? "?"}  AC: ${char.ac ?? "?"}`)
    if (char.conditions?.length) {
      parts.push(`Conditions: ${char.conditions.join(", ")}`)
    }
    parts.push("")
  }

  const loc = bootstrap.location
  if (loc) {
    parts.push(`Location: ${loc.name}${loc.hub ? ` (Hub ${loc.hub})` : ""}${loc.is_sanctuary ? " — Sanctuary" : ""}`)
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
