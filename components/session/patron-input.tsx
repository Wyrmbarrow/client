"use client"

import { useState } from "react"
import type { AgentState, RoomState } from "@/lib/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getAvailableCommands, getToolActions, inferParametersFromDescription } from "@/lib/command-utils"
import type { GameplayTool } from "@/lib/command-utils"

interface PatronInputProps {
  agent: AgentState | null
  roomState: RoomState | null
  onStart: () => void
  onStop: () => void
  onDirectiveChange: (text: string) => void
  onNudge: (text: string) => void
  onCommand?: (toolName: GameplayTool, action: string, params: Record<string, string>) => void
}

export function PatronInput({
  agent,
  roomState,
  onStart,
  onStop,
  onDirectiveChange,
  onNudge,
  onCommand,
}: PatronInputProps) {
  const [directiveDraft, setDirectiveDraft] = useState(agent?.directive ?? "")
  const [nudgeText, setNudgeText] = useState("")
  const [selectedTool, setSelectedTool] = useState<GameplayTool | "">("")
  const [selectedAction, setSelectedAction] = useState("")
  const [commandParams, setCommandParams] = useState<Record<string, string>>({})
  const [commandSubmitting, setCommandSubmitting] = useState(false)

  const isRunning = agent?.status === "running"
  const agentName = agent?.characterName ?? "Agent"
  const availableCommands = getAvailableCommands()

  function handleDirectiveBlur() {
    const trimmed = directiveDraft.trim()
    if (trimmed !== (agent?.directive ?? "")) {
      onDirectiveChange(trimmed)
    }
  }

  function handleNudgeSend() {
    const trimmed = nudgeText.trim()
    if (trimmed) {
      onNudge(trimmed)
      setNudgeText("")
    }
  }

  function handleNudgeKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleNudgeSend()
    }
  }

  function handleToolChange(value: string) {
    const tool = value as GameplayTool
    setSelectedTool(tool)

    // Auto-select "default" action for simple tools
    const actions = getToolActions(tool)
    if (actions.length === 1 && actions[0].actionName === "default") {
      setSelectedAction("default")
      // Pre-infer parameters if available
      const inferred = inferParametersFromDescription(tool, actions[0].description)
      const newParams: Record<string, string> = {}
      for (const param of inferred) {
        newParams[param] = ""
      }
      setCommandParams(newParams)
    } else {
      setSelectedAction("")
      setCommandParams({})
    }
  }

  function handleActionChange(value: string) {
    setSelectedAction(value)
    // Reset params when action changes
    setCommandParams({})

    // Pre-infer parameter names from action description
    if (selectedTool) {
      const actions = getToolActions(selectedTool)
      const action = actions.find((a) => a.actionName === value)
      if (action?.description) {
        const inferred = inferParametersFromDescription(selectedTool, action.description)
        const newParams: Record<string, string> = {}
        for (const param of inferred) {
          newParams[param] = ""
        }
        setCommandParams(newParams)
      }
    }
  }

  async function handleCommandSubmit() {
    if (!selectedTool || !selectedAction) return
    if (!onCommand) return

    setCommandSubmitting(true)
    try {
      onCommand(selectedTool, selectedAction, commandParams)
      // Reset form
      setSelectedTool("")
      setSelectedAction("")
      setCommandParams({})
    } finally {
      setCommandSubmitting(false)
    }
  }

  function handleParamChange(key: string, value: string) {
    setCommandParams((prev) => ({ ...prev, [key]: value }))
  }

  // Build dropdown options for smart parameters
  function getParamOptions(paramName: string): { value: string; label: string }[] | null {
    if (paramName === "direction" && roomState?.exits) {
      return roomState.exits.map((exit) => ({ value: exit.key, label: exit.key }))
    }

    if (paramName === "target_ref" && roomState) {
      const options: { value: string; label: string }[] = []

      // Add NPCs
      if (roomState.npcs) {
        roomState.npcs.forEach((npc) => options.push({ value: npc, label: `${npc} (NPC)` }))
      }

      // Add characters with their refs if available
      if (roomState.characterRefs) {
        roomState.characterRefs.forEach(({ name, ref }) => {
          options.push({ value: ref, label: `${name} (character)` })
        })
      } else if (roomState.characters) {
        roomState.characters.forEach((char) => options.push({ value: char, label: `${char} (character)` }))
      }

      return options.length > 0 ? options : null
    }

    if (paramName === "vendor_ref" && roomState?.npcs) {
      return roomState.npcs.map((npc) => ({ value: npc, label: npc }))
    }

    return null
  }

  return (
    <div className="bg-[var(--wyr-surface)] px-4 py-3 space-y-3">
      <Tabs defaultValue="directive">
        <div className="flex items-center justify-between gap-3">
          <TabsList className="h-7">
            <TabsTrigger
              value="directive"
              className="font-mono text-[8px] tracking-[0.2em] uppercase px-2 py-0.5"
            >
              Directive
            </TabsTrigger>
            <TabsTrigger
              value="nudge"
              className="font-mono text-[8px] tracking-[0.2em] uppercase px-2 py-0.5"
            >
              Nudge
            </TabsTrigger>
            <TabsTrigger
              value="command"
              className="font-mono text-[8px] tracking-[0.2em] uppercase px-2 py-0.5"
            >
              Command
            </TabsTrigger>
          </TabsList>

          {/* Run / Stop buttons */}
          <div className="flex gap-2">
            {isRunning ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={onStop}
                className="font-mono text-[9px] tracking-widest uppercase"
              >
                Stop
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onStart}
                disabled={!agent}
                className="font-mono text-[9px] tracking-widest uppercase border-[color:var(--wyr-accent)]/40 text-[color:var(--wyr-accent)] hover:bg-[color:var(--wyr-accent)]/10"
              >
                Run
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="directive">
          <div className="space-y-2 pt-2">
            <label className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground">
              {agentName} directive
            </label>
            <textarea
              value={directiveDraft}
              onChange={(e) => setDirectiveDraft(e.target.value)}
              onBlur={handleDirectiveBlur}
              placeholder="Explore Oakhaven. Write a journal entry before resting."
              rows={2}
              disabled={isRunning}
              className="w-full font-mono text-xs px-3 py-2 resize-none rounded-md bg-[#2a1f14] border border-[color:var(--wyr-border)] text-[#e8e0d0] outline-none placeholder:text-[rgba(160,135,88,0.5)]"
            />
          </div>
        </TabsContent>

        <TabsContent value="nudge">
          <div className="space-y-2 pt-2">
            <label className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground">
              One-time whisper to {agentName}
            </label>
            <Input
              value={nudgeText}
              onChange={(e) => setNudgeText(e.target.value)}
              onKeyDown={handleNudgeKeyDown}
              placeholder="Focus on speaking to Warden Thorne."
              className="font-mono text-xs px-3 py-2 rounded-md bg-[#2a1f14] border border-[color:var(--wyr-border)] text-[#e8e0d0] outline-none placeholder:text-[rgba(160,135,88,0.5)]"
              suppressHydrationWarning
            />
          </div>
        </TabsContent>

        <TabsContent value="command">
          <div className="space-y-2 pt-2">
            <label className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground">
              Direct command
            </label>

            <div className="flex gap-2">
              {/* Tool select */}
              <select
                value={selectedTool}
                onChange={(e) => handleToolChange(e.target.value)}
                className="flex-1 font-mono text-xs px-3 py-2 rounded-md bg-[#2a1f14] border border-[color:var(--wyr-border)] text-[#e8e0d0] outline-none [&>option]:bg-[#2a1f14] [&>option]:text-[#e8e0d0]"
              >
                <option value="">Select command...</option>
                {availableCommands.map((tool) => (
                  <option key={tool.toolName} value={tool.toolName}>
                    {tool.toolName}
                  </option>
                ))}
              </select>

              {/* Action select — only show if tool has multiple actions */}
              {selectedTool && (() => {
                const actions = getToolActions(selectedTool)
                const hasMultipleActions = actions.length > 1 || (actions.length === 1 && actions[0].actionName !== "default")
                return hasMultipleActions ? (
                  <select
                    value={selectedAction}
                    onChange={(e) => handleActionChange(e.target.value)}
                    className="flex-1 font-mono text-xs px-3 py-2 rounded-md bg-[#2a1f14] border border-[color:var(--wyr-border)] text-[#e8e0d0] outline-none [&>option]:bg-[#2a1f14] [&>option]:text-[#e8e0d0]"
                  >
                    <option value="">Select action...</option>
                    {actions.map((action) => (
                      <option key={action.actionName} value={action.actionName}>
                        {action.actionName === "default" ? selectedTool : action.actionName}
                      </option>
                    ))}
                  </select>
                ) : null
              })()}
            </div>

            {/* Parameters */}
            {selectedAction && Object.keys(commandParams).length > 0 && (
              <div className="space-y-2">
                {Object.entries(commandParams).map(([key, value]) => {
                  const options = getParamOptions(key)
                  const inputClass = "w-full font-mono text-xs px-3 py-2 rounded-md bg-[#2a1f14] border border-[color:var(--wyr-border)] text-[#e8e0d0] outline-none placeholder:text-[rgba(160,135,88,0.5)]"
                  return options ? (
                    <select
                      key={key}
                      value={value}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      className={`${inputClass} [&>option]:bg-[#2a1f14] [&>option]:text-[#e8e0d0]`}
                    >
                      <option value="">Select {key}...</option>
                      {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={key}
                      type="text"
                      value={value}
                      onChange={(e) => handleParamChange(key, e.target.value)}
                      placeholder={key}
                      className={inputClass}
                    />
                  )
                })}
              </div>
            )}

            {/* Submit button */}
            {selectedAction && (
              <Button
                onClick={handleCommandSubmit}
                disabled={commandSubmitting || !agent}
                size="sm"
                className="w-full font-mono text-[9px] tracking-widest uppercase"
              >
                {commandSubmitting ? "Executing..." : "Execute"}
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
