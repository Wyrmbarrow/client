"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

interface TopBarProps {
  partyDirective: string
  onDirectiveChange: (text: string) => void
  modelName: string
  onExit: () => void
}

export function TopBar({
  partyDirective,
  onDirectiveChange,
  modelName,
  onExit,
}: TopBarProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(partyDirective)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEditing() {
    setDraft(partyDirective)
    setEditing(true)
    // Focus on next tick after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitEdit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== partyDirective) {
      onDirectiveChange(trimmed)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      commitEdit()
    } else if (e.key === "Escape") {
      setEditing(false)
      setDraft(partyDirective)
    }
  }

  return (
    <header className="flex items-center gap-4 border-b border-[color:var(--wyr-border)] bg-[var(--wyr-panel)] px-4 py-2">
      {/* Left: title */}
      <h1 className="font-heading text-sm tracking-[0.2em] text-[color:var(--wyr-accent)] shrink-0">
        WYRMBARROW
      </h1>

      {/* Center: editable party directive */}
      <div className="flex-1 min-w-0 flex items-center justify-center">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="w-full max-w-md bg-transparent border-b border-[color:var(--wyr-accent)]/40 text-center font-mono text-xs text-foreground outline-none px-2 py-0.5"
            placeholder="Set party directive..."
          />
        ) : (
          <button
            onClick={startEditing}
            className="max-w-md truncate font-mono text-xs text-muted-foreground hover:text-foreground transition-colors cursor-text px-2 py-0.5"
            title="Click to edit party directive"
          >
            {partyDirective || "Click to set party directive..."}
          </button>
        )}
      </div>

      {/* Right: model badge + exit */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground bg-muted/50 px-2 py-1 rounded">
          {modelName}
        </span>
        <Button variant="destructive" size="sm" onClick={onExit}>
          Exit
        </Button>
      </div>
    </header>
  )
}
