"use client"

import type { AgentState, PulseResources } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AgentCardProps {
  agent: AgentState
  isFocused: boolean
  onClick: () => void
  onStart: () => void
  onStop: () => void
  onRemove?: () => void
}

const PULSE_ITEMS: Array<{ key: keyof PulseResources; label: string; max: number }> = [
  { key: "action", label: "Act", max: 1 },
  { key: "movement", label: "Move", max: 1 },
  { key: "bonus_action", label: "Bonus", max: 1 },
  { key: "reaction", label: "React", max: 1 },
]

function hpColor(pct: number): string {
  if (pct > 0.6) return "var(--wyr-healthy)"
  if (pct > 0.3) return "var(--wyr-warning)"
  return "var(--wyr-danger)"
}

function statusDotColor(status: AgentState["status"]): string {
  switch (status) {
    case "running":
      return "var(--wyr-healthy)"
    case "idle":
    case "resumable":
      return "var(--wyr-warning)"
    case "stopped":
      return "var(--wyr-danger)"
    default:
      return "var(--wyr-muted)"
  }
}

export function AgentCard({
  agent,
  isFocused,
  onClick,
  onStart,
  onStop,
  onRemove,
}: AgentCardProps) {
  const { charState, status, characterName, entries } = agent
  const cls = charState?.class ?? ""
  const level = charState?.level
  const hpCurrent = charState?.hpCurrent ?? 0
  const hpMax = charState?.hpMax ?? 1
  const hpPct = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0
  const resources = charState?.resources

  const lastEntry = entries[entries.length - 1]
  const lastActivity = lastEntry
    ? formatActivity(lastEntry)
    : "No activity yet"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick() }}
      className={cn(
        "w-full text-left rounded-md px-3 py-2.5 space-y-2 transition-colors cursor-pointer",
        "border border-[color:var(--wyr-border)] bg-[var(--wyr-panel)]",
        "shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]",
        isFocused && "border-l-[3px] border-l-[color:var(--wyr-accent)]"
      )}
    >
      {/* Name + class/level + optional remove button */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-sm text-[color:var(--wyr-accent)] truncate">
          {characterName}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {(cls || level) && (
            <span className="font-mono text-[9px] text-muted-foreground">
              {[cls, level ? `Lv${level}` : null].filter(Boolean).join(" ")}
            </span>
          )}
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              aria-label="Remove agent"
              className="font-mono text-[10px] leading-none text-muted-foreground hover:text-[color:var(--wyr-danger)] transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* HP bar */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground">
            HP
          </span>
          <span className="font-mono text-[9px]" style={{ color: hpColor(hpPct) }}>
            {hpCurrent}/{hpMax}
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-muted/30">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.round(hpPct * 100)}%`,
              backgroundColor: hpColor(hpPct),
            }}
          />
        </div>
      </div>

      {/* Pulse resource badges */}
      {resources && (
        <div className="flex gap-1.5">
          {PULSE_ITEMS.map(({ key, label, max }) => {
            const val = resources[key] ?? 0
            const filled = val >= max
            return (
              <span
                key={key}
                className="font-mono text-[7px] tracking-wider uppercase px-1.5 py-0.5 rounded-sm"
                style={{
                  backgroundColor: filled
                    ? "rgba(205,125,28,0.2)"
                    : "rgba(160,135,88,0.1)",
                  color: filled
                    ? "var(--wyr-accent)"
                    : "var(--wyr-muted)",
                  border: `1px solid ${filled ? "rgba(205,125,28,0.3)" : "rgba(160,135,88,0.15)"}`,
                }}
              >
                {label}
              </span>
            )
          })}
        </div>
      )}

      {/* Status + last activity */}
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: statusDotColor(status) }}
        />
        <span className="font-mono text-[8px] text-muted-foreground truncate">
          {lastActivity}
        </span>
      </div>

      {/* Start/Stop (click-stop propagation so card onClick doesn't fire) */}
      <div className="flex justify-end">
        {status === "running" ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStop() }}
            className="font-mono text-[8px] tracking-widest uppercase px-2 py-0.5 rounded-sm"
            style={{
              backgroundColor: "rgba(192,64,64,0.15)",
              border: "1px solid rgba(192,64,64,0.3)",
              color: "var(--wyr-danger)",
            }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onStart() }}
            className="font-mono text-[8px] tracking-widest uppercase px-2 py-0.5 rounded-sm"
            style={{
              backgroundColor: "rgba(205,125,28,0.15)",
              border: "1px solid rgba(205,125,28,0.3)",
              color: "var(--wyr-accent)",
            }}
          >
            Run
          </button>
        )}
      </div>
    </div>
  )
}

function formatActivity(entry: { event: { type: string; tool?: string } }): string {
  const { event } = entry
  if (event.type === "thinking") return "Thinking..."
  if (event.type === "tool_result" && "tool" in event) return `${event.tool}`
  if (event.type === "done") return "Done"
  if (event.type === "error") return "Error"
  return event.type
}
