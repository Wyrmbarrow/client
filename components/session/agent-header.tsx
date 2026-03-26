"use client"

import { Skull } from "lucide-react"
import type { AgentState } from "@/lib/types"

interface AgentHeaderProps {
  agent: AgentState | null
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

export function AgentHeader({ agent }: AgentHeaderProps) {
  if (!agent) {
    return (
      <div className="border-b border-[color:var(--wyr-border)] bg-[var(--wyr-surface)] px-4 py-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          Select an agent to view their feed
        </span>
      </div>
    )
  }

  const { charState, status, characterName } = agent
  const cls = charState?.class ?? ""
  const level = charState?.level
  const ac = charState?.ac
  const isDead = charState?.isDead

  return (
    <div className="border-b border-[color:var(--wyr-border)] bg-[var(--wyr-surface)] px-4 py-2 flex items-center gap-3">
      {/* Name */}
      <span className="font-heading text-sm text-[color:var(--wyr-accent)]">
        {characterName}
      </span>

      {/* Class + Level */}
      {(cls || level) && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {[cls, level ? `Level ${level}` : null].filter(Boolean).join(" ")}
        </span>
      )}

      {/* AC */}
      {ac != null && !isDead && (
        <span className="font-mono text-[9px] text-muted-foreground">
          AC {ac}
        </span>
      )}

      {/* Spirit badge */}
      {isDead && (
        <span className="flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded-sm"
          style={{
            background: "rgba(160,135,88,0.1)",
            border: "1px solid rgba(160,135,88,0.25)",
            color: "var(--wyr-muted)",
          }}>
          <Skull className="w-3 h-3" />
          Spirit
          {charState?.minutesUntilRevival != null && (
            <span className="ml-1 tabular-nums">{charState.minutesUntilRevival}m</span>
          )}
        </span>
      )}

      {/* Status dot */}
      <span
        className="w-2 h-2 rounded-full ml-auto shrink-0"
        style={{ backgroundColor: statusDotColor(status) }}
        title={status}
      />
    </div>
  )
}
