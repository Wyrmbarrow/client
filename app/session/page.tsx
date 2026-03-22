"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useParty } from "@/hooks/use-party"
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
      // Reload: re-login each agent from saved roster
      const roster = loadPartyRoster()
      for (const credentials of roster) {
        ;(async () => {
          try {
            const res = await fetch("/api/agent/init", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "login", charName: credentials.name, password: credentials.password }),
            })
            if (!res.ok) return
            const data = await res.json()
            if (!data.sessionId) return
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
        })()
      }
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
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          agents={party.agents}
          focusedAgentId={party.focusedAgentId}
          roomState={focusedAgent?.roomState ?? null}
          onFocusAgent={party.setFocus}
          onStartAgent={party.startAgent}
          onStopAgent={party.stopAgent}
          onAddAgent={handleAddAgent}
          onRemoveAgent={handleRemoveAgent}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AgentHeader agent={focusedAgent} />
          <ActivityFeed
            entries={focusedAgent?.entries ?? []}
            roomState={focusedAgent?.roomState ?? null}
          />
          <PatronInput
            key={focusedAgent?.agentId ?? "none"}
            agent={focusedAgent}
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
          />
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
