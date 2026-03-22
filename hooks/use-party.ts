"use client"

import { useState, useCallback, useRef, useLayoutEffect } from "react"
import type {
  AgentState, AgentCredentials, LlmConfig, FeedEntry, CharacterState, RoomState,
} from "@/lib/types"
import { buildSystemPrompt } from "@/lib/system-prompt"
import { loadPartyDirective, savePartyDirective, loadSystemPrompt } from "@/lib/party-storage"
import { usePoller } from "./use-poller"

interface UsePartyOptions {
  llmConfig: LlmConfig
}

export function useParty({ llmConfig }: UsePartyOptions) {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map())
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null)
  const [partyDirective, setPartyDirectiveState] = useState(loadPartyDirective)

  const agentsRef = useRef(agents)
  useLayoutEffect(() => { agentsRef.current = agents })

  const streamsRef = useRef<Map<string, ReturnType<typeof createStreamManager>>>(new Map())

  const updateAgent = useCallback((agentId: string, updates: Partial<AgentState>) => {
    setAgents(prev => {
      const next = new Map(prev)
      const existing = next.get(agentId)
      if (!existing) return prev
      next.set(agentId, { ...existing, ...updates })
      return next
    })
  }, [])

  const addEntry = useCallback((agentId: string, entry: FeedEntry) => {
    setAgents(prev => {
      const next = new Map(prev)
      const existing = next.get(agentId)
      if (!existing) return prev
      next.set(agentId, { ...existing, entries: [...existing.entries, entry] })
      return next
    })
  }, [])

  const processEvent = useCallback((agentId: string, entry: FeedEntry) => {
    addEntry(agentId, entry)

    const { event } = entry
    if (event.type === "state") {
      updateAgent(agentId, { charState: event.state })
    } else if (event.type === "resources") {
      setAgents(prev => {
        const next = new Map(prev)
        const agent = next.get(agentId)
        if (!agent?.charState) return prev
        next.set(agentId, {
          ...agent,
          charState: { ...agent.charState, resources: event.resources },
        })
        return next
      })
    } else if (event.type === "room") {
      updateAgent(agentId, { roomState: event.room, lastLookPoll: Date.now() })
    }
  }, [addEntry, updateAgent])

  // Note: takes pre-resolved login data (sessionId, characterName, bootstrap)
  // because login happens in the setup page / add-agent dialog, not in the hook.
  const addAgent = useCallback(async (
    credentials: AgentCredentials,
    sessionId: string,
    characterName: string,
    bootstrap: unknown,
  ) => {
    const agentId = characterName.toLowerCase().replace(/\s+/g, "-")

    const newAgent: AgentState = {
      agentId,
      sessionId,
      characterName,
      credentials,
      charState: charStateFromBootstrap(bootstrap),
      roomState: roomStateFromBootstrap(bootstrap),
      entries: [],
      status: "idle",
      directive: credentials.directive ?? "",
      llmOverride: credentials.llmOverride ?? null,
      bootstrap,
      lastCharPoll: 0,
      lastLookPoll: 0,
    }

    setAgents(prev => {
      const next = new Map(prev)
      next.set(agentId, newAgent)
      return next
    })

    setFocusedAgentId(prev => prev ?? agentId)

    return agentId
  }, [])

  const removeAgent = useCallback((agentId: string) => {
    const stream = streamsRef.current.get(agentId)
    if (stream) {
      stream.stop()
      streamsRef.current.delete(agentId)
    }
    setAgents(prev => {
      const next = new Map(prev)
      next.delete(agentId)
      return next
    })
    setFocusedAgentId(prev => {
      if (prev !== agentId) return prev
      const remaining = [...agentsRef.current.keys()].filter(id => id !== agentId)
      return remaining[0] ?? null
    })
  }, [])

  const startAgent = useCallback((agentId: string, opts?: { nudge?: string }) => {
    const agent = agentsRef.current.get(agentId)
    if (!agent) return

    const effectiveLlm: LlmConfig = {
      ...llmConfig,
      ...(agent.llmOverride ?? {}),
    }

    const customPrompt = loadSystemPrompt()
    const systemPrompt = buildSystemPrompt({
      characterName: agent.characterName,
      partyDirective: partyDirective || undefined,
      agentDirective: agent.directive || undefined,
      characterBrief: customPrompt ?? undefined,
    })

    let stream = streamsRef.current.get(agentId)
    if (!stream) {
      stream = createStreamManager()
      streamsRef.current.set(agentId, stream)
    }

    updateAgent(agentId, { status: "running" })

    stream.start(
      {
        sessionId: agent.sessionId,
        llmConfig: effectiveLlm,
        systemPrompt,
        characterName: agent.characterName,
        nudge: opts?.nudge,
        bootstrap: agent.bootstrap,
      },
      {
        onEvent: (entry) => processEvent(agentId, entry),
        onDone: (reason) => {
          updateAgent(agentId, {
            status: reason === "stop" ? "stopped" : "resumable",
            bootstrap: undefined,
          })
        },
        onError: (message) => {
          addEntry(agentId, {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            event: { type: "error", message },
          })
        },
      },
    )
  }, [llmConfig, partyDirective, processEvent, updateAgent, addEntry])

  const stopAgent = useCallback((agentId: string) => {
    const stream = streamsRef.current.get(agentId)
    if (stream) stream.stop()
    updateAgent(agentId, { status: "stopped" })
  }, [updateAgent])

  const setDirective = useCallback((agentId: string, text: string) => {
    updateAgent(agentId, { directive: text })
  }, [updateAgent])

  const setPartyDirective = useCallback((text: string) => {
    setPartyDirectiveState(text)
    savePartyDirective(text)
  }, [])

  const nudge = useCallback((agentId: string, text: string) => {
    stopAgent(agentId)
    setTimeout(() => startAgent(agentId, { nudge: text }), 100)
  }, [stopAgent, startAgent])

  usePoller({
    agents,
    focusedAgentId,
    onCharState: (agentId, state) => updateAgent(agentId, { charState: state }),
    onRoomState: (agentId, state) => updateAgent(agentId, { roomState: state }),
    onPollTime: (agentId, tool) => {
      const key = tool === "character" ? "lastCharPoll" : "lastLookPoll"
      updateAgent(agentId, { [key]: Date.now() })
    },
  })

  return {
    agents,
    focusedAgentId,
    partyDirective,
    llmConfig,
    addAgent,
    removeAgent,
    setFocus: setFocusedAgentId,
    startAgent,
    stopAgent,
    setDirective,
    setPartyDirective,
    nudge,
  }
}

// ---------------------------------------------------------------------------
// Bootstrap parsers — extract initial charState/roomState from login payload
// ---------------------------------------------------------------------------

function charStateFromBootstrap(bootstrap: unknown): CharacterState | null {
  try {
    const b = bootstrap as Record<string, unknown>
    const char = b?.character as Record<string, unknown>
    if (!char) return null
    const cs = char.charsheet as Record<string, unknown>
    const pr = char.pulse_resources as Record<string, number> | undefined
    return {
      name: char.name as string,
      class: cs?.class as string | undefined,
      level: cs?.level as number | undefined,
      hpCurrent: (cs?.hp_current as number) ?? 0,
      hpMax: (cs?.hp_max as number) ?? 0,
      conditions: char.conditions as string[] | undefined,
      isDying: char.is_dying as boolean | undefined,
      engagementZones: char.engagement_zones as Record<string, string> | undefined,
      resources: pr ? {
        action: pr.action ?? 0,
        movement: pr.movement ?? 0,
        bonus_action: pr.bonus_action ?? 0,
        reaction: pr.reaction ?? 0,
        chat: pr.chat ?? 0,
      } : undefined,
    }
  } catch {
    return null
  }
}

function roomStateFromBootstrap(bootstrap: unknown): RoomState | null {
  try {
    const b = bootstrap as Record<string, unknown>
    const loc = b?.location as Record<string, unknown>
    if (!loc || loc.is_limbo) return null
    return {
      name: loc.name as string,
      hub: loc.hub as number | string | undefined,
      isSanctuary: !!(loc.is_sanctuary),
      exits: loc.exits as RoomState["exits"],
      npcs: loc.npcs as string[] | undefined,
      objects: loc.objects as string[] | undefined,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Stream manager — wraps fetch + AbortController (not a hook)
// ---------------------------------------------------------------------------

interface StreamStartOptions {
  sessionId: string
  llmConfig: LlmConfig
  systemPrompt: string
  characterName: string
  nudge?: string
  bootstrap?: unknown
}

interface StreamCallbacks {
  onEvent: (entry: FeedEntry) => void
  onDone: (reason: string) => void
  onError: (message: string) => void
}

function createStreamManager() {
  let controller: AbortController | null = null

  return {
    async start(options: StreamStartOptions, callbacks: StreamCallbacks) {
      controller?.abort()
      controller = new AbortController()

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: options.sessionId,
            llmBase: options.llmConfig.baseUrl,
            llmKey: options.llmConfig.apiKey,
            model: options.llmConfig.model,
            noToolChoice: options.llmConfig.noToolChoice,
            systemPrompt: options.systemPrompt,
            characterName: options.characterName,
            nudge: options.nudge,
            bootstrap: options.bootstrap,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          callbacks.onError(`Agent API returned ${res.status}`)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === "done") {
                callbacks.onDone(event.reason)
              } else if (event.type === "error") {
                callbacks.onError(event.message)
                callbacks.onEvent({
                  id: crypto.randomUUID(),
                  timestamp: Date.now(),
                  event,
                })
              } else {
                callbacks.onEvent({
                  id: crypto.randomUUID(),
                  timestamp: Date.now(),
                  event,
                })
              }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          callbacks.onError((err as Error).message ?? String(err))
        }
      }
    },
    stop() {
      controller?.abort()
      controller = null
    },
  }
}
