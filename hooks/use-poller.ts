"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import type { AgentState, CharacterState, RoomState } from "@/lib/types"

interface PollerConfig {
  agents: Map<string, AgentState>
  focusedAgentId: string | null
  onCharState: (agentId: string, state: CharacterState) => void
  onRoomState: (agentId: string, state: RoomState) => void
  onPollTime: (agentId: string, tool: "character" | "look") => void
}

const CHAR_POLL_INTERVAL = 3000   // half a Pulse (Pulse = 6s)
const LOOK_POLL_INTERVAL = 6000   // once per Pulse
const FRESHNESS_THRESHOLD = 3000
const BACKOFF_MS = 30_000

export function usePoller(config: PollerConfig) {
  const configRef = useRef(config)
  useLayoutEffect(() => { configRef.current = config })

  const backoffUntil = useRef(0)

  useEffect(() => {
    const charTimer = setInterval(() => {
      if (Date.now() < backoffUntil.current) return

      const { agents, onCharState, onPollTime } = configRef.current

      let stalestId: string | null = null
      let stalestTime = Infinity

      for (const [id, agent] of agents) {
        if (agent.status === "stopped") continue
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
        .then(r => {
          if (r.status === 429) { backoffUntil.current = Date.now() + BACKOFF_MS; return null }
          return r.json()
        })
        .then(data => {
          if (!data) return
          if (data.charState) onCharState(stalestId!, data.charState)
          onPollTime(stalestId!, "character")
        })
        .catch(() => {})
    }, CHAR_POLL_INTERVAL)

    const lookTimer = setInterval(() => {
      if (Date.now() < backoffUntil.current) return

      const { agents, focusedAgentId, onRoomState, onPollTime } = configRef.current
      if (!focusedAgentId) return
      const agent = agents.get(focusedAgentId)
      if (!agent) return
      if (agent.status === "stopped") return

      fetch("/api/agent/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: agent.sessionId, tool: "look" }),
      })
        .then(r => {
          if (r.status === 429) { backoffUntil.current = Date.now() + BACKOFF_MS; return null }
          return r.json()
        })
        .then(data => {
          if (!data) return
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
