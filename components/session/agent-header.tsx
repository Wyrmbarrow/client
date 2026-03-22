"use client"

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
      {ac != null && (
        <span className="font-mono text-[9px] text-muted-foreground">
          AC {ac}
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
