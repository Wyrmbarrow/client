"use client"

import { useState } from "react"
import type { AgentState } from "@/lib/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface PatronInputProps {
  agent: AgentState | null
  onStart: () => void
  onStop: () => void
  onDirectiveChange: (text: string) => void
  onNudge: (text: string) => void
}

export function PatronInput({
  agent,
  onStart,
  onStop,
  onDirectiveChange,
  onNudge,
}: PatronInputProps) {
  const [directiveDraft, setDirectiveDraft] = useState(agent?.directive ?? "")
  const [nudgeText, setNudgeText] = useState("")

  const isRunning = agent?.status === "running"
  const agentName = agent?.characterName ?? "Agent"

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

  return (
    <div className="border-t border-[color:var(--wyr-border)] bg-[var(--wyr-surface)] px-4 py-3 space-y-3">
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
          <div className="space-y-1 pt-2">
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
              className="w-full font-mono text-xs px-3 py-2 resize-none rounded-md bg-background border border-border text-foreground outline-none disabled:opacity-50"
            />
          </div>
        </TabsContent>

        <TabsContent value="nudge">
          <div className="space-y-1 pt-2">
            <label className="font-mono text-[8px] tracking-widest uppercase text-muted-foreground">
              One-time whisper to {agentName}
            </label>
            <Input
              value={nudgeText}
              onChange={(e) => setNudgeText(e.target.value)}
              onKeyDown={handleNudgeKeyDown}
              placeholder="Focus on speaking to Warden Thorne."
              className="font-mono text-xs"
              suppressHydrationWarning
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
