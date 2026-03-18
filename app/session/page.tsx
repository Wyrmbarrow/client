"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import ActivityFeed  from "@/components/panels/ActivityFeed"
import CharacterPanel from "@/components/panels/CharacterPanel"
import RoomPanel     from "@/components/panels/RoomPanel"
import PatronInput   from "@/components/panels/PatronInput"
import type { AgentEvent, CharacterState, FeedEntry, RoomState } from "@/lib/types"

// ---------------------------------------------------------------------------
// Session config (read from sessionStorage — set on setup page)
// ---------------------------------------------------------------------------

interface SessionConfig {
  sessionId:     string
  characterName: string
  llmBase:       string
  llmKey:        string
  model:         string
  systemPrompt:  string
  bootstrap?:    unknown
}

function readConfig(): SessionConfig | null {
  try {
    const raw = sessionStorage.getItem("wyrmbarrow_session")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Unique ID helper
// ---------------------------------------------------------------------------

let _seq = 0
function nextId() { return `e${++_seq}` }

// ---------------------------------------------------------------------------
// Session page
// ---------------------------------------------------------------------------

export default function SessionPage() {
  const router = useRouter()
  const [config, setConfig] = useState<SessionConfig | null>(null)

  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [charState, setCharState] = useState<CharacterState | null>(null)
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [running, setRunning] = useState(false)
  const [resumable, setResumable] = useState(false)

  // Active directive (persists across runs within the tab)
  const [activeDirective, setActiveDirective] = useState("")

  // AbortController for the current stream
  const abortRef = useRef<AbortController | null>(null)

  // Pending input for the next tool_result so we can pair input with result
  const pendingInputRef = useRef<Record<string, Record<string, unknown>>>({})

  // Load session config on mount
  useEffect(() => {
    const cfg = readConfig()
    if (!cfg) {
      router.replace("/")
      return
    }
    setConfig(cfg)
  }, [router])

  // ---------------------------------------------------------------------------
  // Append to feed
  // ---------------------------------------------------------------------------

  function appendEntry(event: AgentEvent) {
    setEntries(prev => [...prev, { id: nextId(), timestamp: Date.now(), event }])
  }

  // ---------------------------------------------------------------------------
  // Start the agent loop
  // ---------------------------------------------------------------------------

  const startAgent = useCallback(async ({
    directive,
    nudge,
    isResume,
  }: {
    directive: string
    nudge: string
    isResume?: boolean
  }) => {
    if (!config) return

    // Store active directive for display
    if (directive !== activeDirective) setActiveDirective(directive)

    const abort = new AbortController()
    abortRef.current = abort
    setRunning(true)
    setResumable(false)

    const body = {
      sessionId:    config.sessionId,
      llmBase:      config.llmBase,
      llmKey:       config.llmKey,
      model:        config.model,
      systemPrompt: config.systemPrompt,
      characterName: config.characterName,
      directive:    directive || undefined,
      nudge:        nudge    || undefined,
      // Only send bootstrap on first run
      bootstrap:    isResume ? undefined : config.bootstrap,
    }

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      })

      if (!res.ok) {
        appendEntry({ type: "error", message: `Agent request failed: ${res.status}` })
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse complete SSE messages (delimited by \n\n)
        const messages = buffer.split("\n\n")
        buffer = messages.pop() ?? ""

        for (const msg of messages) {
          const line = msg.trim()
          if (!line.startsWith("data: ")) continue

          let event: AgentEvent
          try {
            event = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          // Side effects before appending
          if (event.type === "state") {
            setCharState(event.state)
            continue // don't add state/room to visual feed
          }
          if (event.type === "room") {
            setRoomState(event.room)
            continue
          }

          if (event.type === "tool_call") {
            // Store input keyed by tool name for pairing with result
            pendingInputRef.current[event.tool] = event.input
            // Don't add tool_call to feed — we render via tool_result
            continue
          }

          if (event.type === "tool_result") {
            // Pair input from the preceding tool_call
            const input = pendingInputRef.current[event.tool] ?? {}
            delete pendingInputRef.current[event.tool]
            // Augment the event with input so ActivityFeed can render it
            appendEntry({ ...event, input })
            continue
          }

          if (event.type === "done") {
            if (event.reason !== "stop") setResumable(true)
            appendEntry(event)
            break
          }

          appendEntry(event)
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        appendEntry({ type: "error", message: err instanceof Error ? err.message : String(err) })
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }, [config, activeDirective])

  // Auto-start on first load
  const startedRef = useRef(false)
  useEffect(() => {
    if (config && !startedRef.current) {
      startedRef.current = true
      startAgent({ directive: "", nudge: "" })
    }
  }, [config, startAgent])

  // ---------------------------------------------------------------------------
  // Stop
  // ---------------------------------------------------------------------------

  function stopAgent() {
    abortRef.current?.abort()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!config) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="mono text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* Top bar */}
      <header className="shrink-0 flex items-center gap-4 px-4 py-2" style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-panel)",
      }}>
        <span className="mono text-[9px] tracking-[0.5em] uppercase" style={{ color: "var(--amber-faint)" }}>
          Wyrmbarrow
        </span>
        <span className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--text-faint)" }}>
          {config.characterName}
        </span>
        <span className="mono text-[9px]" style={{ color: "var(--text-faint)" }}>
          {config.model}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {running && (
            <span className="mono text-[8px] tracking-widest uppercase" style={{ color: "var(--amber-dim)" }}>
              ● Running
            </span>
          )}
          {resumable && !running && (
            <button
              onClick={() => startAgent({ directive: activeDirective, nudge: "", isResume: true })}
              className="mono text-[8px] tracking-widest uppercase px-2 py-1"
              style={{
                border: "1px solid var(--border-hi)",
                color: "var(--amber)",
              }}
            >
              Resume
            </button>
          )}
          <button
            onClick={() => { stopAgent(); router.push("/") }}
            className="mono text-[8px] tracking-widest uppercase px-2 py-1"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-faint)",
            }}
          >
            Exit
          </button>
        </div>
      </header>

      {/* Main layout: sidebar + feed */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar */}
        <aside className="w-56 shrink-0 flex flex-col gap-0 overflow-hidden" style={{
          borderRight: "1px solid var(--border)",
        }}>
          {/* Character panel — takes most space */}
          <div className="flex-1 overflow-hidden">
            <CharacterPanel state={charState} />
          </div>
          {/* Room panel */}
          <div className="h-52 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <RoomPanel room={roomState} />
          </div>
        </aside>

        {/* Feed + patron input */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Activity feed */}
          <div className="flex-1 overflow-hidden">
            <ActivityFeed entries={entries} roomState={roomState} />
          </div>

          {/* Patron input strip */}
          <div className="shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <PatronInput
              running={running}
              onStart={({ directive, nudge }) =>
                startAgent({ directive, nudge, isResume: true })
              }
              onStop={stopAgent}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
