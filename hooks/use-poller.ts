"use client"

import { useEffect, useRef } from "react"
import type { AgentState, CharacterState, RoomState } from "@/lib/types"

interface PollerConfig {
  agents: Map<string, AgentState>
  focusedAgentId: string | null
  onCharState: (agentId: string, state: CharacterState) => void
  onRoomState: (agentId: string, state: RoomState) => void
  onPollTime: (agentId: string, tool: "character" | "look") => void
}

const CHAR_POLL_INTERVAL = 1000
const LOOK_POLL_INTERVAL = 5000
const FRESHNESS_THRESHOLD = 1000

export function usePoller(config: PollerConfig) {
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    const charTimer = setInterval(() => {
      const { agents, onCharState, onPollTime } = configRef.current

      let stalestId: string | null = null
      let stalestTime = Infinity

      for (const [id, agent] of agents) {
        if (agent.status !== "running" && agent.status !== "resumable") continue
        const inSanctuary = agent.roomState?.isSanctuary ?? false
        const inCombat = agent.charState?.engagementZones
          && Object.keys(agent.charState.engagementZones).length > 0
        if (inSanctuary && !inCombat) continue
        if (Date.now() - agent.lastCharPoll < FRESHNESS_THRESHOLD) continue
        if (agent.lastCharPoll < stalestTime) {
          stalestTime = agent.lastCharPoll
          stalestId = id
        }
      }

      if (!stalestId) return
      const agent = agents.get(stalestId)!

      fetch("/api/agent/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: agent.sessionId, tool: "character" }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.charState) onCharState(stalestId!, data.charState)
          onPollTime(stalestId!, "character")
        })
        .catch(() => {})
    }, CHAR_POLL_INTERVAL)

    const lookTimer = setInterval(() => {
      const { agents, focusedAgentId, onRoomState, onPollTime } = configRef.current
      if (!focusedAgentId) return
      const agent = agents.get(focusedAgentId)
      if (!agent) return
      if (agent.status !== "running" && agent.status !== "resumable" && agent.status !== "idle") return
      if (Date.now() - agent.lastLookPoll < 3000) return

      fetch("/api/agent/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: agent.sessionId, tool: "look" }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.roomState) onRoomState(focusedAgentId!, data.roomState)
          onPollTime(focusedAgentId!, "look")
        })
        .catch(() => {})
    }, LOOK_POLL_INTERVAL)

    return () => {
      clearInterval(charTimer)
      clearInterval(lookTimer)
    }
  }, [])
}
