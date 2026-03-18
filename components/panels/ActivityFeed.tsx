"use client"

import { useEffect, useRef } from "react"
import type { FeedEntry } from "@/lib/types"
import { TOOL_CATEGORY } from "@/lib/tools"
import ThinkingEvent from "@/components/feed/ThinkingEvent"
import LookEvent    from "@/components/feed/LookEvent"
import MoveEvent    from "@/components/feed/MoveEvent"
import SpeakEvent   from "@/components/feed/SpeakEvent"
import JournalEvent from "@/components/feed/JournalEvent"
import CombatEvent  from "@/components/feed/CombatEvent"
import GenericEvent from "@/components/feed/GenericEvent"

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
      <div className="sticky top-0 px-4 py-2 flex items-center gap-2" style={{
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        zIndex: 10,
      }}>
        <span className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--amber-dim)" }}>
          Activity
        </span>
      </div>

      {/* Feed */}
      <div className="flex-1 flex flex-col py-2 gap-1">
        {entries.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="mono text-[10px]" style={{ color: "var(--text-faint)" }}>
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
        <span className="mono text-[10px]" style={{ color: "#c0504a" }}>⚠ {event.message}</span>
      </div>
    )
  }

  if (event.type === "done") {
    return (
      <div className="px-4 py-1.5">
        <span className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
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
    default:
      void category
      return <GenericEvent tool={tool} input={input} result={result} />
  }
}
