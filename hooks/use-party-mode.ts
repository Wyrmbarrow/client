"use client"

import { useState, useRef, useLayoutEffect, useCallback } from "react"
import type { AgentState } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartyModeState {
  status: "off" | "forming" | "active" | "leaving"
  leaderId: string | null
  followerIds: Set<string>
}

// ---------------------------------------------------------------------------
// Module-level helper
// ---------------------------------------------------------------------------

async function callAction(sessionId: string, tool: string, params: object = {}): Promise<unknown> {
  const res = await fetch("/api/agent/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, tool, params }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${tool} failed`)
  return (data as { result?: unknown }).result
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePartyMode(
  agents: Map<string, AgentState>,
  focusedAgentId: string | null,
  startAgent: (agentId: string, opts?: { nudge?: string; isFollower?: boolean }) => void,
): {
  partyMode: PartyModeState
  togglePartyMode: () => void
  canEnablePartyMode: boolean
  partyModeError: string | null
} {
  const [partyMode, setPartyMode] = useState<PartyModeState>({
    status: "off",
    leaderId: null,
    followerIds: new Set(),
  })
  const [partyModeError, setPartyModeError] = useState<string | null>(null)

  // Keep a ref to agents so async closures always see latest state
  const agentsRef = useRef(agents)
  useLayoutEffect(() => { agentsRef.current = agents })

  // ---------------------------------------------------------------------------
  // canEnablePartyMode
  // ---------------------------------------------------------------------------

  const canEnablePartyMode = (() => {
    if (partyMode.status !== "off") return false
    if (agents.size < 2) return false
    if (!focusedAgentId) return false

    const leader = agents.get(focusedAgentId)
    if (!leader) return false

    const leaderRoomName = leader.roomState?.name
    if (!leaderRoomName) return false

    for (const [id, agent] of agents) {
      if (id === focusedAgentId) continue
      if (agent.status === "stopped") continue
      if (agent.roomState?.name !== leaderRoomName) return false
    }

    return true
  })()

  // ---------------------------------------------------------------------------
  // activate
  // ---------------------------------------------------------------------------

  const activate = useCallback(async () => {
    setPartyModeError(null)

    // Re-check using the ref for freshness
    const currentAgents = agentsRef.current

    // Re-validate inline (canEnablePartyMode uses closed-over `agents` which may be stale)
    const leaderId = focusedAgentId
    if (!leaderId) {
      setPartyModeError("No focused agent to use as party leader.")
      return
    }

    const leader = currentAgents.get(leaderId)
    if (!leader) {
      setPartyModeError("Leader agent not found.")
      return
    }

    const leaderRoomName = leader.roomState?.name
    if (!leaderRoomName) {
      setPartyModeError("Leader has no room state.")
      return
    }

    if (currentAgents.size < 2) {
      setPartyModeError("Need at least 2 agents to enable Party Mode.")
      return
    }

    const followerIds = new Set<string>()
    for (const [id, agent] of currentAgents) {
      if (id === leaderId) continue
      if (agent.status === "stopped") continue
      if (agent.roomState?.name !== leaderRoomName) {
        setPartyModeError(`Agent ${agent.characterName} is not in the same room as the leader.`)
        return
      }
      followerIds.add(id)
    }

    if (followerIds.size === 0) {
      setPartyModeError("No eligible followers found.")
      return
    }

    setPartyMode({ status: "forming", leaderId, followerIds })

    try {
      const leaderSessionId = leader.sessionId
      const leaderRef = leader.roomState?.characterRefs?.find(
        (r) => r.name === leader.characterName,
      )?.ref

      for (const followerId of followerIds) {
        const follower = agentsRef.current.get(followerId)
        if (!follower) continue

        const followerRef = agentsRef.current
          .get(leaderId)
          ?.roomState?.characterRefs?.find((r) => r.name === follower.characterName)?.ref

        const followerSessionId = follower.sessionId

        // a. Leader invites follower
        await callAction(leaderSessionId, "party_invite", {
          target_ref: followerRef,
        })

        // b. Follower accepts
        await callAction(followerSessionId, "party_accept", {})

        // c. Follower follows leader
        await callAction(followerSessionId, "social", {
          action: "follow",
          target_ref: leaderRef,
        })
      }

      setPartyMode({ status: "active", leaderId, followerIds })

      // Start all followers with isFollower: true
      for (const followerId of followerIds) {
        startAgent(followerId, { isFollower: true })
      }
    } catch (err) {
      setPartyModeError((err as Error).message)
      setPartyMode({ status: "off", leaderId: null, followerIds: new Set() })
    }
  }, [focusedAgentId, startAgent])

  // ---------------------------------------------------------------------------
  // deactivate
  // ---------------------------------------------------------------------------

  const deactivate = useCallback(async () => {
    // Snapshot current follower ids before transitioning
    const snapshotFollowerIds = new Set(partyMode.followerIds)

    setPartyMode((prev) => ({ ...prev, status: "leaving" }))

    // Teardown all followers in parallel, tolerating individual failures
    await Promise.all(
      [...snapshotFollowerIds].map(async (followerId) => {
        const follower = agentsRef.current.get(followerId)
        if (!follower) return
        const sessionId = follower.sessionId
        await Promise.all([
          callAction(sessionId, "social", { action: "follow" }).catch(() => {}),
          callAction(sessionId, "social", { action: "party_leave" }).catch(() => {}),
        ])
      }),
    )

    setPartyMode({ status: "off", leaderId: null, followerIds: new Set() })

    // Restart followers without isFollower flag
    for (const followerId of snapshotFollowerIds) {
      startAgent(followerId, { isFollower: false })
    }
  }, [partyMode.followerIds, startAgent])

  // ---------------------------------------------------------------------------
  // togglePartyMode
  // ---------------------------------------------------------------------------

  const togglePartyMode = useCallback(() => {
    if (partyMode.status === "off") {
      void activate()
    } else if (partyMode.status === "active") {
      void deactivate()
    }
    // forming or leaving: do nothing
  }, [partyMode.status, activate, deactivate])

  return {
    partyMode,
    togglePartyMode,
    canEnablePartyMode,
    partyModeError,
  }
}
