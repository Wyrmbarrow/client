"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { FeedEntry, RoomState, RoomMessage } from "@/lib/types"
import { TOOL_CATEGORY } from "@/lib/tools"
import ThinkingEvent from "@/components/feed/thinking-event"
import LookEvent from "@/components/feed/look-event"
import MoveEvent from "@/components/feed/move-event"
import SpeakEvent from "@/components/feed/speak-event"
import JournalEvent from "@/components/feed/journal-event"
import CombatEvent from "@/components/feed/combat-event"
import ShopEvent from "@/components/feed/shop-event"
import QuestEvent from "@/components/feed/quest-event"
import CharacterEvent from "@/components/feed/character-event"
import GenericEvent from "@/components/feed/generic-event"

interface InspectData {
  label: string
  data: unknown
}

interface ActivityFeedProps {
  entries: FeedEntry[]
  roomState: RoomState | null
}

/**
 * Returns the set of entry IDs that are plain look results in the same room
 * as the immediately preceding plain look — i.e., repeat looks worth collapsing.
 */
function findRepeatLooks(entries: FeedEntry[]): Set<string> {
  const repeats = new Set<string>()
  let lastRoom: string | null = null
  for (const entry of entries) {
    const { event } = entry
    if (event.type !== "tool_result") continue
    if (event.tool !== "look" && event.tool !== "explore") continue
    const hasTarget = !!(event.input as Record<string, unknown>)?.target
    if (hasTarget) continue
    const r = event.result as Record<string, unknown>
    const room = (r?.room ?? r) as Record<string, unknown>
    const name = (room?.name as string) ?? null
    if (name && name === lastRoom) repeats.add(entry.id)
    if (name) lastRoom = name
  }
  return repeats
}

export function ActivityFeed({ entries, roomState }: ActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const [inspect, setInspect] = useState<InspectData | null>(null)
  const [copied, setCopied] = useState(false)

  // Track whether the user has scrolled away from the bottom via IntersectionObserver.
  // New entries only auto-scroll when the bottom sentinel is already visible.
  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { isAtBottomRef.current = entry.isIntersecting },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [entries.length])

  const repeatLooks = findRepeatLooks(entries)
  const onInspect = useCallback((data: InspectData) => setInspect(data), [])

  const handleCopy = useCallback(async () => {
    if (!inspect) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(inspect.data, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [inspect])

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="flex flex-col py-2 gap-1">
          {entries.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="font-mono text-[10px] text-[color:var(--wyr-muted)]">
                Agent will begin once started...
              </p>
            </div>
          )}

          {entries.map((entry) => (
            <FeedRow
              key={entry.id}
              entry={entry}
              roomState={roomState}
              isRepeatLook={repeatLooks.has(entry.id)}
              onInspect={onInspect}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <Dialog open={inspect !== null} onOpenChange={(open) => { if (!open) setInspect(null) }}>
        <DialogContent className="bg-[var(--wyr-panel)] border-[color:var(--wyr-border)] sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex items-center justify-between">
            <DialogTitle className="font-mono text-xs tracking-widest uppercase text-[color:var(--wyr-accent)]">
              {inspect?.label}
            </DialogTitle>
            <button
              onClick={handleCopy}
              className="ml-auto font-mono text-[9px] px-2 py-1 rounded border border-[color:var(--wyr-border)] text-[color:var(--wyr-text)] hover:bg-[color:var(--wyr-muted)]/10 transition-colors"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded border border-[color:var(--wyr-border)] bg-black/20 p-3">
            <pre className="font-mono text-[10px] leading-relaxed text-[color:var(--wyr-text)] whitespace-pre-wrap break-words">
              {inspect ? JSON.stringify(inspect.data, null, 2) : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FeedRow({
  entry,
  roomState,
  isRepeatLook,
  onInspect,
}: {
  entry: FeedEntry
  roomState: RoomState | null
  isRepeatLook: boolean
  onInspect: (data: InspectData) => void
}) {
  const { event } = entry

  if (event.type === "thinking") {
    return <ThinkingEvent text={event.text} />
  }

  if (event.type === "error") {
    return (
      <div className="px-4 py-1.5">
        <span className="font-mono text-[10px] text-[color:var(--wyr-danger)]">
          {event.message}
        </span>
      </div>
    )
  }

  if (event.type === "done") {
    return (
      <div className="px-4 py-1.5">
        <span className="font-mono text-[9px] tracking-widest uppercase text-[color:var(--wyr-muted)]">
          -- {event.reason === "stop" ? "session paused" : event.reason} --
        </span>
      </div>
    )
  }

  if (event.type === "tool_call") {
    return <ToolCallRow tool={event.tool} input={event.input} onInspect={onInspect} />
  }

  if (event.type === "command") {
    // event.result is the full API response: { result: MCP_RESULT, charState?: ..., roomState?: ... }
    // Extract the actual MCP result
    const apiResponse = event.result as Record<string, unknown>
    const mcpResult = apiResponse.result ?? apiResponse

    const inspectResult = () => onInspect({ label: `${event.toolName} ${event.action}`, data: mcpResult })
    const resultWrapper = (children: React.ReactNode) => (
      <div
        className="cursor-pointer hover:bg-[var(--wyr-muted)]/5 transition-colors rounded"
        onClick={inspectResult}
      >
        {children}
      </div>
    )

    // Special formatting for quest results
    if (event.toolName === "quest") {
      return resultWrapper(
        <div className="px-3 py-1">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-mono text-[8px] text-[color:var(--wyr-accent)]/60 tracking-widest">PATRON</span>
            <span className="font-mono text-[9px] text-[color:var(--wyr-accent)]">quest</span>
            {event.action !== "default" && (
              <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">{event.action}</span>
            )}
          </div>
          <QuestEvent result={mcpResult} />
        </div>
      )
    }

    // Special formatting for move results — show direction header + full room card
    if (event.toolName === "move") {
      // Unwrap nested MCP result — try multiple levels since execute() wraps the response
      let moveData: Record<string, unknown> = mcpResult as Record<string, unknown>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryParse = (obj: any): Record<string, unknown> | null => {
        try {
          const text = obj?.result?.content?.[0]?.text ?? obj?.content?.[0]?.text
          if (typeof text === "string") return JSON.parse(text)
        } catch { /* noop */ }
        return null
      }
      moveData = tryParse(moveData) ?? tryParse(moveData?.result) ?? moveData
      const direction = String(moveData.direction ?? "")
      const from = String(moveData.from ?? "")

      return resultWrapper(
        <div className="px-3 py-1 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[8px] text-[color:var(--wyr-accent)]/60 tracking-widest">PATRON</span>
            <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">
              <span className="text-[color:var(--wyr-accent)]">{direction}</span>
              {from && <> from {from}</>}
            </span>
          </div>
          <LookEvent result={moveData} roomState={roomState} />
        </div>
      )
    }

    // Special formatting for character status — full character sheet
    if (event.toolName === "character") {
      // Unwrap nested MCP result
      let charData: Record<string, unknown> = mcpResult as Record<string, unknown>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryParse = (obj: any): Record<string, unknown> | null => {
        try {
          const text = obj?.result?.content?.[0]?.text ?? obj?.content?.[0]?.text
          if (typeof text === "string") return JSON.parse(text)
        } catch { /* noop */ }
        return null
      }
      charData = tryParse(charData) ?? tryParse(charData?.result) ?? charData

      return resultWrapper(
        <div className="px-3 py-1 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[8px] text-[color:var(--wyr-accent)]/60 tracking-widest">PATRON</span>
            <span className="font-mono text-[9px] text-[color:var(--wyr-accent)]">character</span>
            {event.action !== "default" && event.action !== "status" && (
              <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">{event.action}</span>
            )}
          </div>
          <CharacterEvent result={charData} />
        </div>
      )
    }

    // Special formatting for shop results — reuse ShopEvent with unwrapped data
    if (event.toolName === "shop") {
      let shopData: Record<string, unknown> = mcpResult as Record<string, unknown>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryParse = (obj: any): Record<string, unknown> | null => {
        try {
          const text = obj?.result?.content?.[0]?.text ?? obj?.content?.[0]?.text
          if (typeof text === "string") return JSON.parse(text)
        } catch { /* noop */ }
        return null
      }
      shopData = tryParse(shopData) ?? tryParse(shopData?.result) ?? shopData

      return resultWrapper(
        <div className="px-3 py-1">
          <ShopEvent input={{ action: event.action }} result={shopData} />
        </div>
      )
    }

    // Generic command display
    return resultWrapper(
      <div className="px-4 py-1.5 flex items-baseline gap-2">
        <span className="font-mono text-[8px] text-[color:var(--wyr-accent)]/60 tracking-widest">PATRON</span>
        <span className="font-mono text-[9px] text-[color:var(--wyr-accent)]">{event.toolName}</span>
        {event.action !== "default" && (
          <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">{event.action}</span>
        )}
      </div>
    )
  }

  if (event.type !== "tool_result") return null

  const { tool, result } = event
  const input = event.input ?? {}
  const inspectResult = () => onInspect({ label: `${tool} response`, data: result })

  // Suppress the full look panel for repeat same-room looks — show a single compact line.
  // Messages are always rendered separately below, even for collapsed looks.
  if (isRepeatLook) {
    const r = result as Record<string, unknown>
    const room = (r?.room ?? r) as Record<string, unknown>
    const desc = String(room?.description ?? room?.desc ?? "")
    const repeatMessages: RoomMessage[] = Array.isArray(r?.messages) ? r.messages as RoomMessage[] : []
    return (
      <>
        <div
          className="px-4 py-0.5 flex items-baseline gap-2 cursor-pointer hover:bg-[var(--wyr-muted)]/5 transition-colors"
          onClick={inspectResult}
        >
          <span className="font-mono text-[8px] uppercase tracking-widest text-[color:var(--wyr-muted)] shrink-0">look</span>
          {desc && (
            <span className="font-serif text-[11px] text-[color:var(--wyr-muted)] truncate">
              {desc.slice(0, 90)}{desc.length > 90 ? "…" : ""}
            </span>
          )}
        </div>
        {repeatMessages.map((msg, i) => (
          <RoomMessageRow key={i} message={msg} />
        ))}
      </>
    )
  }

  void TOOL_CATEGORY[tool as keyof typeof TOOL_CATEGORY]

  const resultWrapper = (children: React.ReactNode) => (
    <div
      className="cursor-pointer hover:bg-[var(--wyr-muted)]/5 transition-colors rounded"
      onClick={inspectResult}
    >
      {children}
    </div>
  )

  switch (tool) {
    case "look":
    case "explore": {
      const lookMessages: RoomMessage[] = Array.isArray((result as Record<string, unknown>)?.messages)
        ? (result as Record<string, unknown>).messages as RoomMessage[]
        : []
      return (
        <>
          {resultWrapper(
            <div className="px-3 py-1">
              <LookEvent result={result} roomState={roomState} />
            </div>
          )}
          {lookMessages.map((msg, i) => (
            <RoomMessageRow key={i} message={msg} />
          ))}
        </>
      )
    }
    case "move":
      return resultWrapper(<MoveEvent input={input} result={result} />)
    case "speak":
      return resultWrapper(
        <div className="px-3 py-1">
          <SpeakEvent input={input} result={result} />
        </div>
      )
    case "journal":
      return resultWrapper(<JournalEvent input={input} result={result} />)
    case "combat":
      return resultWrapper(
        <div className="px-3 py-1">
          <CombatEvent input={input} result={result} />
        </div>
      )
    case "shop":
      return resultWrapper(
        <div className="px-3 py-1">
          <ShopEvent input={input} result={result} />
        </div>
      )
    default:
      return resultWrapper(<GenericEvent tool={tool} input={input} result={result} />)
  }
}

/** Ambient room event — NPC arrival/departure, performance, etc. */
function RoomMessageRow({ message }: { message: RoomMessage }) {
  return (
    <div className="px-4 py-0.5">
      <p className="font-serif text-xs leading-relaxed italic"
        style={{ color: "rgba(180,150,80,0.85)" }}>
        {message.text}
      </p>
    </div>
  )
}

/** Compact row shown when the agent initiates a tool call, before the result arrives. */
function ToolCallRow({
  tool,
  input,
  onInspect,
}: {
  tool: string
  input: Record<string, unknown>
  onInspect: (data: InspectData) => void
}) {
  const params = Object.entries(input)
    .filter(([k]) => k !== "session_id")
    .map(([k, v]) => {
      const val = typeof v === "string"
        ? (v.length > 50 ? v.slice(0, 50) + "…" : v)
        : String(v)
      return `${k}="${val}"`
    })
    .join("  ")

  return (
    <div
      className="px-4 py-0.5 flex items-baseline gap-1.5 cursor-pointer hover:bg-[var(--wyr-muted)]/5 transition-colors"
      onClick={() => onInspect({ label: `→ ${tool}`, data: input })}
    >
      <span className="font-mono text-[8px] text-[color:var(--wyr-muted)]">→</span>
      <span className="font-mono text-[9px] text-[color:var(--wyr-accent)]/70">{tool}</span>
      {params && (
        <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">{params}</span>
      )}
    </div>
  )
}
