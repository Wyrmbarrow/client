"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { FeedEntry, RoomState } from "@/lib/types"
import { TOOL_CATEGORY } from "@/lib/tools"
import ThinkingEvent from "@/components/feed/thinking-event"
import LookEvent from "@/components/feed/look-event"
import MoveEvent from "@/components/feed/move-event"
import SpeakEvent from "@/components/feed/speak-event"
import JournalEvent from "@/components/feed/journal-event"
import CombatEvent from "@/components/feed/combat-event"
import ShopEvent from "@/components/feed/shop-event"
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
          <DialogHeader>
            <DialogTitle className="font-mono text-xs tracking-widest uppercase text-[color:var(--wyr-accent)]">
              {inspect?.label}
            </DialogTitle>
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

  if (event.type !== "tool_result") return null

  const { tool, result } = event
  const input = event.input ?? {}
  const inspectResult = () => onInspect({ label: `${tool} response`, data: result })

  // Suppress the full look panel for repeat same-room looks — show a single compact line.
  if (isRepeatLook) {
    const r = result as Record<string, unknown>
    const room = (r?.room ?? r) as Record<string, unknown>
    const desc = String(room?.description ?? room?.desc ?? "")
    return (
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
    case "explore":
      return resultWrapper(
        <div className="px-3 py-1">
          <LookEvent result={result} roomState={roomState} />
        </div>
      )
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
