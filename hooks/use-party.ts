"use client"

import { useState, useCallback, useRef, useLayoutEffect } from "react"
import type {
  AgentState, AgentCredentials, LlmConfig, FeedEntry, CharacterState, RoomState, PartyMember,
} from "@/lib/types"
import { buildSystemPrompt, buildPartyMembersPrompt } from "@/lib/system-prompt"
import { loadPartyDirective, savePartyDirective, loadSystemPrompt, loadTodo, saveTodo } from "@/lib/party-storage"

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
  // Track pending auto-restart timers so we can cancel them if startAgent is called explicitly.
  const restartTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // Track rate limit backoff times per agent (global rate limiter means we coordinate across sessions)
  const rateLimitBackoffRef = useRef<Map<string, number>>(new Map())

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
    } else if (event.type === "todo_update") {
      const agent = agentsRef.current.get(agentId)
      if (agent) {
        updateAgent(agentId, { todo: event.content })
        saveTodo(agent.characterName, event.content)
      }
    } else if (event.type === "follower_tool_result") {
      addEntry(event.agentId, {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        event: { type: "tool_result", tool: event.tool, result: event.result, input: event.input },
      })
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
      todo: loadTodo(characterName),
      lastCharPoll: 0,
      lastLookPoll: 0,
    }

    setAgents(prev => {
      const next = new Map(prev)
      next.set(agentId, newAgent)
      return next
    })

    // Eagerly update the ref so startAgent (called in the same microtask via .then())
    // can find the agent before React has committed the setAgents update.
    agentsRef.current = new Map(agentsRef.current).set(agentId, newAgent)

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

  const startAgent = useCallback((agentId: string, opts?: { nudge?: string; isFollower?: boolean; partyMembers?: { name: string; sessionId: string; agentId: string }[] }) => {
    const agent = agentsRef.current.get(agentId)
    if (!agent) return

    // Check if this agent is in backoff period (global rate limit means all agents coordinate)
    const backoffUntil = rateLimitBackoffRef.current.get(agentId) ?? 0
    if (Date.now() < backoffUntil) {
      // Agent is in backoff, reschedule the start for when backoff expires
      const delay = Math.max(100, backoffUntil - Date.now())
      const timer = setTimeout(() => {
        rateLimitBackoffRef.current.delete(agentId)
        startAgent(agentId, opts)
      }, delay)
      restartTimersRef.current.set(agentId, timer)
      return
    }

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

    const isFollower = opts?.isFollower ?? false
    const partyMembers = opts?.partyMembers

    let partyMembersWithState: PartyMember[] | undefined
    if (partyMembers?.length) {
      partyMembersWithState = partyMembers.map(pm => {
        const follower = agentsRef.current.get(pm.agentId)
        return {
          ...pm,
          charState: follower?.charState ?? null,
          roomState: follower?.roomState ?? null,
        }
      })
    }

    let fullSystemPrompt = systemPrompt
    if (partyMembersWithState?.length) {
      fullSystemPrompt += "\n\n" + buildPartyMembersPrompt(partyMembersWithState)
    }

    // Cancel any pending auto-restart timer for this agent so that an explicit
    // startAgent call (e.g. from deactivate) isn't overwritten by a stale onDone timeout.
    const existingTimer = restartTimersRef.current.get(agentId)
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer)
      restartTimersRef.current.delete(agentId)
    }

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
        systemPrompt: fullSystemPrompt,
        characterName: agent.characterName,
        nudge: opts?.nudge,
        isFollower,
        bootstrap: agent.bootstrap,
        resumeContext: agent.bootstrap ? undefined : {
          charState: agent.charState,
          roomState: agent.roomState,
        },
        todo: agent.todo || "",
        partyMembers: partyMembers,
      },
      {
        onEvent: (entry) => processEvent(agentId, entry),
        onDone: (reason) => {
          updateAgent(agentId, { bootstrap: undefined })
          // Always restart. The model finishing with "stop" just means it ran out of
          // things to say in one context window — not that the session is over.
          // The patron has an explicit Stop button to halt the agent intentionally.
          // Use longer pauses for rate limits and stop so the patron can read output.
          const delay = reason === "rate_limited" ? 30_000 : reason === "stop" ? 2000 : 500

          // If rate limited, set backoff time so the agent waits 30s before retrying
          if (reason === "rate_limited") {
            rateLimitBackoffRef.current.set(agentId, Date.now() + 30_000)
          }

          const timer = setTimeout(() => {
            restartTimersRef.current.delete(agentId)
            startAgent(agentId, { isFollower, partyMembers })
          }, delay)
          restartTimersRef.current.set(agentId, timer)
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

  const executeCommand = useCallback(
    async (agentId: string, toolName: string, action: string, params: Record<string, string>) => {
      const agent = agentsRef.current.get(agentId)
      if (!agent) return

      try {
        const res = await fetch("/api/agent/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: agent.sessionId,
            toolName,
            action,
            params,
          }),
        })

        if (!res.ok) {
          const error = await res.text()
          addEntry(agentId, {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            event: {
              type: "error",
              message: `Command failed: ${error}`,
            },
          })
          return
        }

        const result = await res.json()
        addEntry(agentId, {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          event: {
            type: "command",
            toolName,
            action,
            result,
          },
        })

        // Update state if the result includes state updates
        if (result.charState) {
          updateAgent(agentId, { charState: result.charState })
        }
        if (result.roomState) {
          updateAgent(agentId, { roomState: result.roomState })
        }
      } catch (err) {
        addEntry(agentId, {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          event: {
            type: "error",
            message: `Command error: ${(err as Error).message}`,
          },
        })
      }
    },
    [addEntry, updateAgent]
  )

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
    executeCommand,
    setCharState: (agentId: string, state: CharacterState) => updateAgent(agentId, { charState: state }),
    setRoomState: (agentId: string, state: RoomState) => updateAgent(agentId, { roomState: state }),
    setPollTime: (agentId: string, tool: "character" | "look") => {
      const key = tool === "character" ? "lastCharPoll" : "lastLookPoll"
      updateAgent(agentId, { [key]: Date.now() })
    },
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
    // Login response includes resp.spirit = { is_spirit, minutes_until_revival, ... }
    const spirit = b?.spirit as Record<string, unknown> | undefined
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
      isDead: spirit?.is_spirit ? true : undefined,
      spiritVision: spirit?.is_spirit ? true : undefined,
      minutesUntilRevival: spirit?.minutes_until_revival as number | undefined,
      revivalAvailableAt: spirit?.revival_available_at as string | undefined,
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
  isFollower?: boolean
  bootstrap?: unknown
  resumeContext?: { charState: CharacterState | null; roomState: RoomState | null }
  todo?: string
  partyMembers?: { name: string; sessionId: string; agentId: string }[]
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

      let doneWasCalled = false
      let saw429 = false

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
            isFollower: options.isFollower ?? false,
            bootstrap: options.bootstrap,
            resumeContext: options.resumeContext,
            todo: options.todo,
            partyMembers: options.partyMembers,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          // Special handling for rate limit (429)
          if (res.status === 429) {
            callbacks.onError("Rate limited by LLM provider")
            callbacks.onDone("rate_limited")
            return
          }
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
                doneWasCalled = true
                callbacks.onDone(event.reason)
              } else if (event.type === "error") {
                if (event.message?.includes("rate limit") || event.message?.includes("429")) {
                  saw429 = true
                }
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

      // If the stream ended without an explicit done event (e.g. MCP error closed
      // the stream early), trigger a restart so the agent doesn't silently stall.
      if (!doneWasCalled && controller && !controller.signal.aborted) {
        callbacks.onDone(saw429 ? "rate_limited" : "end")
      }
    },
    stop() {
      controller?.abort()
      controller = null
    },
  }
}
