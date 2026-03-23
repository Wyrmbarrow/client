"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
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

  return (
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
          />
        ))}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}

function FeedRow({
  entry,
  roomState,
  isRepeatLook,
}: {
  entry: FeedEntry
  roomState: RoomState | null
  isRepeatLook: boolean
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
    return <ToolCallRow tool={event.tool} input={event.input} />
  }

  if (event.type !== "tool_result") return null

  const { tool, result } = event
  const input = event.input ?? {}

  // Suppress the full look panel for repeat same-room looks — show a single compact line.
  if (isRepeatLook) {
    const r = result as Record<string, unknown>
    const room = (r?.room ?? r) as Record<string, unknown>
    const desc = String(room?.description ?? room?.desc ?? "")
    return (
      <div className="px-4 py-0.5 flex items-baseline gap-2">
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

  switch (tool) {
    case "look":
    case "explore":
      return (
        <div className="px-3 py-1">
          <LookEvent result={result} roomState={roomState} />
        </div>
      )
    case "move":
      return <MoveEvent input={input} result={result} />
    case "speak":
      return (
        <div className="px-3 py-1">
          <SpeakEvent input={input} result={result} />
        </div>
      )
    case "journal":
      return <JournalEvent input={input} result={result} />
    case "combat":
      return (
        <div className="px-3 py-1">
          <CombatEvent input={input} result={result} />
        </div>
      )
    case "shop":
      return (
        <div className="px-3 py-1">
          <ShopEvent input={input} result={result} />
        </div>
      )
    default:
      return <GenericEvent tool={tool} input={input} result={result} />
  }
}

/** Compact row shown when the agent initiates a tool call, before the result arrives. */
function ToolCallRow({ tool, input }: { tool: string; input: Record<string, unknown> }) {
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
    <div className="px-4 py-0.5 flex items-baseline gap-1.5">
      <span className="font-mono text-[8px] text-[color:var(--wyr-muted)]">→</span>
      <span className="font-mono text-[9px] text-[color:var(--wyr-accent)]/70">{tool}</span>
      {params && (
        <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">{params}</span>
      )}
    </div>
  )
}
