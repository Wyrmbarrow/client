"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import type { AgentState, CharacterState, RoomState } from "@/lib/types"

interface PollerConfig {
  agents: Map<string, AgentState>
  focusedAgentId: string | null
  onCharState: (agentId: string, state: CharacterState) => void
  onRoomState: (agentId: string, state: RoomState) => void
  onPollTime: (agentId: string, tool: "character" | "look") => void
  partyModeStatus?: "off" | "forming" | "active" | "leaving"
  leaderId?: string | null
}

const CHAR_POLL_INTERVAL = 3000   // half a Pulse (Pulse = 6s)
const LOOK_POLL_INTERVAL = 6000   // once per Pulse
const FRESHNESS_THRESHOLD = 3000
const BACKOFF_MS = 30_000

export function usePoller(config: PollerConfig) {
  const configRef = useRef(config)
  useLayoutEffect(() => { configRef.current = config })

  const backoffUntil = useRef(0)

  const { partyModeStatus, leaderId } = config

  useEffect(() => {
    // Character stat poll — rotates through the stalest agent across all
    // agents (party mode: all members; solo: all agents).  Skips agents in
    // a sanctuary without active combat since their stats don't change there.
    // Polls regardless of running/stopped status.
    const charTimer = setInterval(() => {
      if (Date.now() < backoffUntil.current) return

      const { agents, onCharState, onPollTime, partyModeStatus } = configRef.current
      if (partyModeStatus === "forming" || partyModeStatus === "leaving") return

      let stalestId: string | null = null
      let stalestTime = Infinity

      for (const [id, agent] of agents) {
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

    // Look poll — in party mode, rotates through all party members (stalest
    // lastLookPoll first) so each member's room state stays fresh.  Outside
    // party mode, always polls the focused agent.  Polls regardless of status.
    const lookInterval = partyModeStatus === "active" ? 3000 : LOOK_POLL_INTERVAL

    const lookTimer = setInterval(() => {
      if (Date.now() < backoffUntil.current) return

      const { agents, focusedAgentId, onRoomState, onPollTime, partyModeStatus, leaderId } = configRef.current
      if (partyModeStatus === "forming" || partyModeStatus === "leaving") return
      const isPartyActive = partyModeStatus === "active"

      let targetId: string | null = null

      if (isPartyActive && leaderId) {
        // Pick the party member with the oldest look poll
        let stalestLook = Infinity
        for (const [id, agent] of agents) {
          if (agent.lastLookPoll < stalestLook) {
            stalestLook = agent.lastLookPoll
            targetId = id
          }
        }
      } else {
        targetId = focusedAgentId
      }

      if (!targetId) return
      const agent = agents.get(targetId)
      if (!agent) return

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
          if (data.roomState) onRoomState(targetId!, data.roomState)
          onPollTime(targetId!, "look")
        })
        .catch(() => {})
    }, lookInterval)

    return () => {
      clearInterval(charTimer)
      clearInterval(lookTimer)
    }
  }, [partyModeStatus, leaderId])
}
