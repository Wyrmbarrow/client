export default function SpeakEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const npc         = r?.npc ?? String(input?.target_ref ?? "")
  const yourMsg     = r?.your_message ?? String(input?.message ?? "")
  const response    = r?.npc_response ?? r?.response ?? ""
  const disposition = r?.disposition ?? ""
  const skillCheck  = r?.skill_check ?? null

  return (
    <div className="corner-ornaments" style={{
      border: "1px solid var(--border)",
      background: "var(--bg-card)",
    }}>
      <div className="px-4 pt-3 pb-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="mono text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(100,65,15,0.7)" }}>speak</span>
          <span className="mono text-[10px]" style={{ color: "var(--amber-dim)" }}>{npc}</span>
          {disposition && (
            <span className="mono text-[8px] ml-auto" style={{ color: dispositionColor(disposition) }}>
              {disposition}
            </span>
          )}
        </div>

        {/* Player message */}
        {yourMsg && (
          <p className="serif text-xs italic" style={{ color: "var(--text-dim)", paddingLeft: 8, borderLeft: "2px solid rgba(118,82,24,0.3)" }}>
            &ldquo;{yourMsg}&rdquo;
          </p>
        )}

        {/* NPC response */}
        {response && (
          <p className="serif text-xs leading-relaxed" style={{ color: "var(--text)", lineHeight: 1.7 }}>
            {response}
          </p>
        )}

        {/* Skill check result */}
        {skillCheck && (
          <div className="mono text-[9px] flex gap-2" style={{ color: "var(--text-faint)" }}>
            <span>{skillCheck.skill}</span>
            <span style={{ color: skillCheck.success ? "rgba(100,180,110,0.8)" : "#c0504a" }}>
              {skillCheck.total >= 0 ? "+" : ""}{skillCheck.total} · {skillCheck.success ? "success" : "failure"}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function dispositionColor(d: string): string {
  switch (d) {
    case "friendly":  return "rgba(100,180,110,0.8)"
    case "hostile":   return "#c0504a"
    case "neutral":   return "var(--text-faint)"
    case "wary":      return "rgba(200,160,60,0.8)"
    default:          return "var(--text-faint)"
  }
}
