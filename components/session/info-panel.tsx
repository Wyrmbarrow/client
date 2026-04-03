"use client"

import { useState } from "react"
import type { AgentState } from "@/lib/types"

interface InfoPanelProps {
  agent: AgentState | null
}

export function InfoPanel({ agent }: InfoPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <aside className="w-8 h-full flex flex-col items-center border-l border-[color:var(--wyr-border)] bg-[var(--wyr-panel)]">
        <button
          onClick={() => setCollapsed(false)}
          className="mt-2 font-mono text-[9px] text-muted-foreground hover:text-[color:var(--wyr-accent)] transition-colors"
          title="Expand info panel"
        >
          ◂
        </button>
      </aside>
    )
  }

  const todo = agent?.todo || ""

  return (
    <aside className="w-64 h-full flex flex-col border-l border-[color:var(--wyr-border)] bg-[var(--wyr-panel)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[color:var(--wyr-border)]">
        <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
          Agent TODO
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="font-mono text-[9px] text-muted-foreground hover:text-[color:var(--wyr-accent)] transition-colors"
          title="Collapse info panel"
        >
          ▸
        </button>
      </div>

      {/* TODO content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {todo ? (
          <pre className="font-mono text-[10px] leading-relaxed text-[#e8e0d0] whitespace-pre-wrap break-words">
            {todo}
          </pre>
        ) : (
          <p className="font-mono text-[10px] text-muted-foreground italic">
            {agent ? "No TODO yet — the agent will create one as it plays." : "No agent selected."}
          </p>
        )}
      </div>
    </aside>
  )
}
