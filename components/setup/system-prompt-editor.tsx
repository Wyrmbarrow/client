"use client"

import { useEffect, useState } from "react"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { loadSystemPrompt, saveSystemPrompt } from "@/lib/party-storage"
import { DEFAULT_CHARACTER_BRIEF } from "@/lib/system-prompt"

interface SystemPromptEditorProps {
  value?: string
  onChange?: (text: string) => void
}

export function SystemPromptEditor({ value, onChange }: SystemPromptEditorProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(DEFAULT_CHARACTER_BRIEF)

  // Load saved prompt on mount
  useEffect(() => {
    const saved = loadSystemPrompt()
    if (saved) {
      setPrompt(saved)
      onChange?.(saved)
    } else {
      onChange?.(DEFAULT_CHARACTER_BRIEF)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync with controlled value if provided
  useEffect(() => {
    if (value !== undefined && value !== prompt) {
      setPrompt(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleChange(text: string) {
    setPrompt(text)
    saveSystemPrompt(text)
    onChange?.(text)
  }

  function handleReset() {
    setPrompt(DEFAULT_CHARACTER_BRIEF)
    saveSystemPrompt(DEFAULT_CHARACTER_BRIEF)
    onChange?.(DEFAULT_CHARACTER_BRIEF)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer">
            <p className="font-mono text-[9px] tracking-[0.4em] uppercase text-muted-foreground">
              Character Brief
            </p>
            <span className="font-mono text-[9px] text-muted-foreground/60">
              {open ? "^ hide" : "v edit"}
            </span>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleReset}
            className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground"
          >
            Reset
          </Button>
        </div>

        <CollapsibleContent>
          <textarea
            value={prompt}
            onChange={(e) => handleChange(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-[11px] text-foreground leading-relaxed resize-y outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
