export default function CombatEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const action  = String(input?.action ?? "")
  const isError = !!r?.error
  const isHit   = r?.hit === true
  const isMiss  = r?.hit === false

  return (
    <div
      className="corner-ornaments rounded-md"
      style={{
        borderLeft: "3px solid var(--wyr-crimson)",
        border: `1px solid ${isError ? "rgba(180,60,50,0.4)" : "rgba(140,80,30,0.5)"}`,
        borderLeftWidth: 3,
        borderLeftColor: "var(--wyr-crimson)",
        background: isError ? "rgba(60,15,10,0.4)" : "var(--wyr-panel)",
      }}
    >
      <div className="px-4 pt-2.5 pb-3 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[color:var(--wyr-muted)]">
            combat
          </span>
          <span className="font-mono text-[10px] text-[color:var(--wyr-accent)]">{action}</span>
          {!isError && (isMiss || isHit) && (
            <span
              className="font-mono text-[9px] ml-auto px-1.5 rounded-sm"
              style={{
                background: isHit ? "rgba(40,80,40,0.5)" : "rgba(60,40,40,0.5)",
                border: `1px solid ${isHit ? "rgba(80,140,80,0.4)" : "rgba(120,60,60,0.4)"}`,
                color: isHit ? "rgba(120,200,120,0.9)" : "rgba(180,100,100,0.9)",
              }}
            >
              {isHit ? "HIT" : "MISS"}
            </span>
          )}
        </div>

        {isError ? (
          <p className="font-mono text-[10px] text-[color:var(--wyr-danger)]">{r.error}</p>
        ) : (
          <div className="space-y-1">
            {r?.damage != null && (
              <div className="font-mono text-[10px] flex gap-2 text-[color:var(--wyr-muted)]">
                <span>Damage</span>
                <span className="font-semibold" style={{ color: "rgba(224,128,80,0.9)" }}>
                  {typeof r.damage === "object" && r.damage?.total != null ? r.damage.total : r.damage}
                </span>
                {r?.damage_type && <span className="text-[color:var(--wyr-muted)]">{r.damage_type}</span>}
              </div>
            )}
            {r?.target_hp_remaining != null && (
              <div className="font-mono text-[10px] text-[color:var(--wyr-muted)]">
                Target HP: {r.target_hp_remaining}
              </div>
            )}
            {r?.description && (
              <p className="font-serif text-xs text-[color:var(--wyr-muted)]" style={{ lineHeight: 1.6 }}>
                {r.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
