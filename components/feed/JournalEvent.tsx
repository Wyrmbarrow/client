export default function JournalEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const action    = String(input?.action ?? "write")
  const entryType = String(input?.entry_type ?? r?.entry_type ?? "")
  const wordCount = r?.word_count ?? r?.wordCount ?? null
  const isError   = !!r?.error

  if (action !== "write") {
    // read / search / context — just a quiet log line
    return (
      <div className="px-3 py-1.5 flex gap-2">
        <span className="mono text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(100,65,15,0.7)" }}>journal</span>
        <span className="mono text-[10px]" style={{ color: "var(--text-faint)" }}>{action}</span>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 flex gap-3 items-center">
      <span className="mono text-[9px] tracking-[0.2em] uppercase shrink-0" style={{ color: "rgba(100,65,15,0.7)" }}>
        journal
      </span>
      {isError ? (
        <span className="mono text-[10px]" style={{ color: "#c0504a" }}>{r.error}</span>
      ) : (
        <span className="mono text-[10px]" style={{ color: "var(--text-dim)" }}>
          <span style={{ color: entryTypeColor(entryType) }}>{entryType || "note"}</span>
          {wordCount && <> · {wordCount} words</>}
          <span style={{ color: "rgba(100,180,110,0.6)", marginLeft: 8 }}>✓ saved</span>
        </span>
      )}
    </div>
  )
}

function entryTypeColor(t: string): string {
  switch (t) {
    case "long_rest":     return "rgba(100,140,200,0.8)"
    case "status_update": return "rgba(180,140,60,0.8)"
    case "ooc":           return "var(--text-faint)"
    default:              return "var(--text-dim)"
  }
}
