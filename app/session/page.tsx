"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useParty } from "@/hooks/use-party"
import { usePartyMode } from "@/hooks/use-party-mode"
import { usePoller } from "@/hooks/use-poller"
import { loadLlmConfig, saveLlmConfig, loadPartyRoster, savePartyRoster, saveSystemPrompt } from "@/lib/party-storage"
import type { LlmConfig, AgentCredentials } from "@/lib/types"

import { TopBar } from "@/components/session/top-bar"
import { Sidebar } from "@/components/session/sidebar"
import { AgentHeader } from "@/components/session/agent-header"
import { ActivityFeed } from "@/components/session/activity-feed"
import { PatronInput } from "@/components/session/patron-input"
import { AddAgentDialog } from "@/components/session/add-agent-dialog"

// ---------------------------------------------------------------------------
// First-agent handoff shape (written by setup page to sessionStorage)
// ---------------------------------------------------------------------------

interface FirstAgentHandoff {
  sessionId: string
  characterName: string
  bootstrap: unknown
  credentials: { name: string; password: string }
  llmConfig: LlmConfig
  systemPrompt?: string
}

function readFirstAgent(): FirstAgentHandoff | null {
  try {
    const raw = sessionStorage.getItem("wyrmbarrow:firstAgent")
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Session page
// ---------------------------------------------------------------------------

export default function SessionPage() {
  const router = useRouter()
  const [llmConfig, setLlmConfig] = useState<LlmConfig | null>(null)
  const bootstrappedRef = useRef(false)

  // Defer storage reads to after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    const firstAgent = readFirstAgent()
    if (firstAgent?.llmConfig) {
      saveLlmConfig(firstAgent.llmConfig)
      setLlmConfig(firstAgent.llmConfig)
    } else {
      const saved = loadLlmConfig()
      if (!saved) {
        router.replace("/")
      } else {
        setLlmConfig(saved)
      }
    }
  }, [router])

  if (!llmConfig) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <p className="font-mono text-xs text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return <SessionInner llmConfig={llmConfig} bootstrappedRef={bootstrappedRef} />
}

// ---------------------------------------------------------------------------
// Inner component — only mounts once llmConfig is available
// ---------------------------------------------------------------------------

function SessionInner({
  llmConfig,
  bootstrappedRef,
}: {
  llmConfig: LlmConfig
  bootstrappedRef: React.RefObject<boolean>
}) {
  const router = useRouter()
  const party = useParty({ llmConfig })
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const { partyMode, togglePartyMode, canEnablePartyMode, partyModeError } = usePartyMode(
    party.agents,
    party.focusedAgentId,
    party.startAgent,
  )

  usePoller({
    agents: party.agents,
    focusedAgentId: party.focusedAgentId,
    onCharState: party.setCharState,
    onRoomState: party.setRoomState,
    onPollTime: party.setPollTime,
    partyModeStatus: partyMode.status,
    leaderId: partyMode.leaderId,
  })

  // Compute a human-readable disabled reason for Party Mode
  const partyModeDisabledReason = (() => {
    if (canEnablePartyMode) return undefined
    if (party.agents.size < 2) return undefined // toggle hidden anyway
    const leader = party.focusedAgentId ? party.agents.get(party.focusedAgentId) : null
    const leaderRoom = leader?.roomState?.name
    if (!leaderRoom) return "Leader has no room data yet."
    const mismatched: string[] = []
    for (const [id, agent] of party.agents) {
      if (id === party.focusedAgentId) continue
      if (agent.status === "stopped") continue
      if (agent.roomState?.name !== leaderRoom) {
        mismatched.push(agent.characterName)
      }
    }
    if (mismatched.length > 0) {
      return `${mismatched.join(", ")} must be in the same room to enable Party Mode.`
    }
    return "All characters must be in the same room to enable Party Mode."
  })()

  const focusedAgent = party.focusedAgentId
    ? party.agents.get(party.focusedAgentId) ?? null
    : null

  // Bootstrap agents on mount — either from sessionStorage handoff (fresh login)
  // or from saved roster (page reload)
  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true

    const handoff = readFirstAgent()

    if (handoff) {
      // Fresh login: use handoff data directly (no MCP call needed)
      sessionStorage.removeItem("wyrmbarrow:firstAgent")

      if (handoff.systemPrompt) {
        saveSystemPrompt(handoff.systemPrompt)
      }

      const credentials: AgentCredentials = {
        name: handoff.credentials.name,
        password: handoff.credentials.password,
      }

      const roster = loadPartyRoster()
      if (!roster.some((c) => c.name === credentials.name && c.password === credentials.password)) {
        savePartyRoster([...roster, credentials])
      }

      party
        .addAgent(credentials, handoff.sessionId, handoff.characterName, handoff.bootstrap)
        .then((agentId) => party.startAgent(agentId))
    } else {
      // Reload: re-login each agent from saved roster (sequential to avoid MCP rate limit)
      const roster = loadPartyRoster()
      ;(async () => {
        for (const credentials of roster) {
          try {
            const res = await fetch("/api/agent/init", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "login", charName: credentials.name, password: credentials.password }),
            })
            if (!res.ok) continue
            const data = await res.json()
            if (!data.sessionId) continue
            const agentId = await party.addAgent(
              credentials,
              data.sessionId,
              data.characterName,
              data.bootstrap ?? null,
            )
            party.startAgent(agentId)
          } catch {
            // silently skip — agent will show as missing
          }
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Handlers ---

  function handleExit() {
    // Stop all agents
    for (const agentId of party.agents.keys()) {
      party.stopAgent(agentId)
    }
    router.push("/")
  }

  function handleAddAgent() {
    setAddDialogOpen(true)
  }

  async function handleAddAgentSuccess(data: {
    sessionId: string
    characterName: string
    bootstrap: unknown
    credentials: { name: string; password: string }
  }) {
    const credentials: AgentCredentials = {
      name: data.credentials.name,
      password: data.credentials.password,
    }

    // Persist to roster
    const roster = loadPartyRoster()
    const alreadyInRoster = roster.some(
      (c) => c.name === credentials.name && c.password === credentials.password
    )
    if (!alreadyInRoster) {
      savePartyRoster([...roster, credentials])
    }

    // Add agent and auto-start
    const agentId = await party.addAgent(
      credentials,
      data.sessionId,
      data.characterName,
      data.bootstrap
    )
    party.startAgent(agentId)
    setAddDialogOpen(false)
  }

  function handleRemoveAgent(agentId: string) {
    // Remove credentials from persisted roster before removing from party state
    const agent = party.agents.get(agentId)
    if (agent) {
      const roster = loadPartyRoster()
      const updated = roster.filter(
        (c) => !(c.name === agent.credentials.name && c.password === agent.credentials.password)
      )
      savePartyRoster(updated)
    }

    // removeAgent stops the stream and removes from state; also shifts focus
    party.removeAgent(agentId)
  }

  return (
    <>
    <div className="flex flex-col h-dvh">
      <TopBar
        partyDirective={party.partyDirective}
        onDirectiveChange={party.setPartyDirective}
        modelName={llmConfig.model}
        onExit={handleExit}
        agentCount={party.agents.size}
        partyMode={partyMode}
        onTogglePartyMode={togglePartyMode}
        canEnablePartyMode={canEnablePartyMode}
        partyModeDisabledReason={partyModeDisabledReason}
      />
      {partyModeError && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30 font-mono text-xs text-destructive">
          {partyModeError}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          agents={party.agents}
          focusedAgentId={party.focusedAgentId}
          roomState={focusedAgent?.roomState ?? null}
          charState={focusedAgent?.charState ?? null}
          onFocusAgent={party.setFocus}
          onStartAgent={party.startAgent}
          onStopAgent={party.stopAgent}
          onAddAgent={handleAddAgent}
          onRemoveAgent={handleRemoveAgent}
          partyMode={partyMode}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <AgentHeader agent={focusedAgent} />
          <ActivityFeed
            entries={focusedAgent?.entries ?? []}
            roomState={focusedAgent?.roomState ?? null}
          />
          <div className="shrink-0 border-t border-[color:var(--wyr-border)]">
            <PatronInput
              key={focusedAgent?.agentId ?? "none"}
              agent={focusedAgent}
              roomState={focusedAgent?.roomState ?? null}
              onStart={() => {
                if (party.focusedAgentId) party.startAgent(party.focusedAgentId)
              }}
              onStop={() => {
                if (party.focusedAgentId) party.stopAgent(party.focusedAgentId)
              }}
              onDirectiveChange={(text) => {
                if (party.focusedAgentId) party.setDirective(party.focusedAgentId, text)
              }}
              onNudge={(text) => {
                if (party.focusedAgentId) party.nudge(party.focusedAgentId, text)
              }}
              onCommand={(toolName, action, params) => {
                if (party.focusedAgentId) {
                  party.executeCommand(party.focusedAgentId, toolName, action, params)
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
    <AddAgentDialog
      open={addDialogOpen}
      onOpenChange={setAddDialogOpen}
      onSuccess={handleAddAgentSuccess}
    />
    </>
  )
}
