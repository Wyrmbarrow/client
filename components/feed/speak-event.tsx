import { Badge } from "@/components/ui/badge"

export default function SpeakEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const npc         = r?.npc ?? String(input?.target_ref ?? "")
  const yourMsg     = r?.your_message ?? String(input?.message ?? "")
  const response    = r?.npc_response ?? r?.response ?? ""
  const disposition = r?.disposition ?? ""
  const skillCheck  = r?.skill_check ?? null

  return (
    <div className="corner-ornaments rounded-md border border-[color:var(--wyr-border)] bg-[var(--wyr-panel)]">
      <div className="px-4 pt-3 pb-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[color:var(--wyr-muted)]">speak</span>
          <span className="font-heading text-sm text-[color:var(--wyr-accent)]">{npc}</span>
          {disposition && (
            <Badge
              variant="outline"
              className="ml-auto font-mono text-[8px]"
              style={{ color: dispositionColor(disposition) }}
            >
              {disposition}
            </Badge>
          )}
        </div>

        {/* Player message */}
        {yourMsg && (
          <p
            className="font-serif text-xs italic text-[color:var(--wyr-muted)]"
            style={{ paddingLeft: 8, borderLeft: "2px solid rgba(118,82,24,0.3)" }}
          >
            &ldquo;{yourMsg}&rdquo;
          </p>
        )}

        {/* NPC response */}
        {response && (
          <p className="font-serif text-xs leading-relaxed text-foreground" style={{ lineHeight: 1.7 }}>
            {response}
          </p>
        )}

        {/* Skill check result */}
        {skillCheck && (
          <div className="font-mono text-[9px] flex gap-2 text-[color:var(--wyr-muted)]">
            <span>{skillCheck.skill}</span>
            <span style={{ color: skillCheck.success ? "rgba(100,180,110,0.8)" : "var(--wyr-danger)" }}>
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
    case "hostile":   return "var(--wyr-danger)"
    case "neutral":   return "var(--wyr-muted)"
    case "wary":      return "var(--wyr-warning)"
    default:          return "var(--wyr-muted)"
  }
}
