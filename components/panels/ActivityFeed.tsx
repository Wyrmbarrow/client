"use client"

import { useEffect, useRef } from "react"
import type { FeedEntry } from "@/lib/types"
import { TOOL_CATEGORY } from "@/lib/tools"
import ThinkingEvent from "@/components/feed/thinking-event"
import LookEvent    from "@/components/feed/look-event"
import MoveEvent    from "@/components/feed/move-event"
import SpeakEvent   from "@/components/feed/speak-event"
import JournalEvent from "@/components/feed/journal-event"
import CombatEvent  from "@/components/feed/combat-event"
import GenericEvent from "@/components/feed/generic-event"
import ShopEvent   from "@/components/feed/shop-event"

interface Props {
  entries: FeedEntry[]
  /** Current room state for enriching LookEvent when result lacks full detail */
  roomState?: import("@/lib/types").RoomState | null
}

export default function ActivityFeed({ entries, roomState }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries])

  return (
    <div className="panel-border h-full overflow-y-auto flex flex-col">
      {/* Label */}
      <div className="sticky top-0 px-4 py-2 flex items-center gap-2 border-b border-[color:var(--wyr-border)] bg-[var(--wyr-panel)] z-10">
        <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-[color:var(--wyr-muted)]">
          Activity
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 flex flex-col py-2 gap-1">
        {entries.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="font-mono text-[10px] text-[color:var(--wyr-muted)]">
              Agent will begin once connected…
            </p>
          </div>
        )}

        {entries.map(entry => (
          <FeedRow key={entry.id} entry={entry} roomState={roomState} />
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function FeedRow({
  entry,
  roomState,
}: {
  entry: FeedEntry
  roomState?: import("@/lib/types").RoomState | null
}) {
  const { event } = entry

  if (event.type === "thinking") {
    return <ThinkingEvent text={event.text} />
  }

  if (event.type === "error") {
    return (
      <div className="px-4 py-1.5">
        <span className="font-mono text-[10px] text-[color:var(--wyr-danger)]">⚠ {event.message}</span>
      </div>
    )
  }

  if (event.type === "done") {
    return (
      <div className="px-4 py-1.5">
        <span className="font-mono text-[9px] tracking-widest uppercase text-[color:var(--wyr-muted)]">
          — {event.reason === "stop" ? "session paused" : event.reason} —
        </span>
      </div>
    )
  }

  // tool_call events: just a quiet label (the result will follow)
  if (event.type === "tool_call") {
    return null
  }

  if (event.type !== "tool_result") return null

  const { tool, result } = event

  const input = event.input ?? {}

  const category = TOOL_CATEGORY[tool as keyof typeof TOOL_CATEGORY] ?? "system"

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
      void category
      return <GenericEvent tool={tool} input={input} result={result} />
  }
}
