"use client"

import { cn } from "@/lib/utils"

interface PartyModeToggleProps {
  status: "off" | "forming" | "active" | "leaving"
  canEnable: boolean
  disabledReason?: string
  onToggle: () => void
}

export default function PartyModeToggle({
  status,
  canEnable,
  disabledReason,
  onToggle,
}: PartyModeToggleProps) {
  const isTransitioning = status === "forming" || status === "leaving"
  const isActive = status === "active"
  const isDisabled = isTransitioning || (status === "off" && !canEnable)

  const label =
    status === "forming"
      ? "Forming party..."
      : status === "leaving"
        ? "Leaving party..."
        : "Party Mode"

  const tooltipTitle = !canEnable && status === "off" ? disabledReason : undefined

  return (
    <button
      type="button"
      aria-pressed={isActive}
      disabled={isDisabled}
      onClick={onToggle}
      title={tooltipTitle}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        isActive
          ? "bg-[rgba(205,125,28,0.2)] border border-[rgba(205,125,28,0.4)] text-[color:var(--wyr-accent)]"
          : "bg-muted/30 border border-[color:var(--wyr-border)] text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {isTransitioning && (
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full border border-current border-t-transparent animate-spin shrink-0"
        />
      )}
      {!isTransitioning && isActive && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-[color:var(--wyr-accent)] shrink-0"
        />
      )}
      {label}
    </button>
  )
}
