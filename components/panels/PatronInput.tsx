"use client"

import { useState } from "react"

interface Props {
  /** Whether the agent is currently running */
  running: boolean
  /** Call to start the agent with an optional directive/nudge */
  onStart: (opts: { directive: string; nudge: string }) => void
  /** Call to stop the agent (aborts the stream) */
  onStop: () => void
}

export default function PatronInput({ running, onStart, onStop }: Props) {
  const [mode, setMode] = useState<"directive" | "nudge">("directive")
  const [directive, setDirective] = useState("")
  const [nudge, setNudge] = useState("")

  function handleStart() {
    onStart({ directive, nudge })
  }

  return (
    <div className="panel-border flex flex-col gap-3 px-4 py-3">
      {/* Mode selector */}
      <div className="flex items-center gap-3">
        <span className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--amber-dim)" }}>
          Patron
        </span>
        <div className="flex gap-0 ml-auto" style={{ border: "1px solid var(--border)" }}>
          {(["directive", "nudge"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="mono text-[8px] tracking-widest uppercase px-2.5 py-1"
              style={{
                background: mode === m ? "rgba(118,82,24,0.25)" : "transparent",
                color: mode === m ? "var(--amber)" : "var(--text-faint)",
                borderRight: m === "directive" ? "1px solid var(--border)" : "none",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="flex gap-2 items-end">
        {mode === "directive" ? (
          <div className="flex-1 space-y-1">
            <p className="mono text-[8px]" style={{ color: "var(--text-faint)" }}>
              Persistent goal appended to system prompt. Agent acts on it until changed.
            </p>
            <textarea
              value={directive}
              onChange={e => setDirective(e.target.value)}
              placeholder="Explore Oakhaven. Write a journal entry before resting."
              rows={2}
              disabled={running}
              className="w-full mono text-[11px] px-3 py-2 resize-none"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: running ? "var(--text-faint)" : "var(--text)",
                outline: "none",
                lineHeight: 1.5,
              }}
            />
          </div>
        ) : (
          <div className="flex-1 space-y-1">
            <p className="mono text-[8px]" style={{ color: "var(--text-faint)" }}>
              One-time whisper injected as user message when agent resumes.
            </p>
            <input
              value={nudge}
              onChange={e => setNudge(e.target.value)}
              placeholder="Focus on speaking to Warden Thorne."
              disabled={running}
              onKeyDown={e => { if (e.key === "Enter" && !running) handleStart() }}
              className="w-full mono text-[11px] px-3 py-2"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: running ? "var(--text-faint)" : "var(--text)",
                outline: "none",
              }}
            />
          </div>
        )}

        {/* Start / Stop button */}
        {running ? (
          <button
            onClick={onStop}
            className="mono text-[9px] tracking-widest uppercase px-4 py-2.5 shrink-0"
            style={{
              background: "rgba(180,60,50,0.15)",
              border: "1px solid rgba(180,60,50,0.35)",
              color: "#c0504a",
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="mono text-[9px] tracking-widest uppercase px-4 py-2.5 shrink-0"
            style={{
              background: "rgba(118,82,24,0.3)",
              border: "1px solid var(--border-hi)",
              color: "var(--amber)",
              cursor: "pointer",
            }}
          >
            Run
          </button>
        )}
      </div>
    </div>
  )
}
