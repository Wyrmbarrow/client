"use client"

import type { AgentState, RoomState } from "@/lib/types"
import { AgentCard } from "@/components/session/agent-card"
import { RoomPanel } from "@/components/session/room-panel"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  agents: Map<string, AgentState>
  focusedAgentId: string | null
  roomState: RoomState | null
  onFocusAgent: (agentId: string) => void
  onStartAgent: (agentId: string) => void
  onStopAgent: (agentId: string) => void
  onAddAgent: () => void
}

const MAX_AGENTS = 4

export function Sidebar({
  agents,
  focusedAgentId,
  roomState,
  onFocusAgent,
  onStartAgent,
  onStopAgent,
  onAddAgent,
}: SidebarProps) {
  const agentList = Array.from(agents.values())

  return (
    <aside className="w-60 h-full flex flex-col border-r border-[color:var(--wyr-border)] bg-[var(--wyr-panel)]">
      {/* Agent cards — scrollable */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {agentList.map((agent) => (
          <AgentCard
            key={agent.agentId}
            agent={agent}
            isFocused={agent.agentId === focusedAgentId}
            onClick={() => onFocusAgent(agent.agentId)}
            onStart={() => onStartAgent(agent.agentId)}
            onStop={() => onStopAgent(agent.agentId)}
          />
        ))}

        {/* Add Agent button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onAddAgent}
          disabled={agentList.length >= MAX_AGENTS}
          className="w-full font-mono text-[9px] tracking-[0.2em] uppercase border-dashed border-[color:var(--wyr-border)] text-muted-foreground hover:text-[color:var(--wyr-accent)] hover:border-[color:var(--wyr-accent)]/40"
        >
          + Add Agent
        </Button>
      </div>

      {/* Room panel — pinned to bottom */}
      <RoomPanel room={roomState} />
    </aside>
  )
}
