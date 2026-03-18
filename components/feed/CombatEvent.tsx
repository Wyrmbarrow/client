export default function CombatEvent({ input, result }: { input: Record<string, unknown>; result: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const action  = String(input?.action ?? "")
  const isError = !!r?.error
  const isHit   = r?.hit === true
  const isMiss  = r?.hit === false

  return (
    <div className="corner-ornaments" style={{
      border: `1px solid ${isError ? "rgba(180,60,50,0.4)" : "rgba(140,80,30,0.5)"}`,
      background: isError ? "rgba(60,15,10,0.4)" : "rgba(40,20,5,0.5)",
    }}>
      <div className="px-4 pt-2.5 pb-3 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="mono text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(180,90,40,0.8)" }}>
            combat
          </span>
          <span className="mono text-[10px]" style={{ color: "rgba(200,120,60,0.9)" }}>{action}</span>
          {!isError && (isMiss || isHit) && (
            <span className="mono text-[9px] ml-auto px-1.5" style={{
              background: isHit ? "rgba(40,80,40,0.5)" : "rgba(60,40,40,0.5)",
              border: `1px solid ${isHit ? "rgba(80,140,80,0.4)" : "rgba(120,60,60,0.4)"}`,
              color: isHit ? "rgba(120,200,120,0.9)" : "rgba(180,100,100,0.9)",
            }}>
              {isHit ? "HIT" : "MISS"}
            </span>
          )}
        </div>

        {isError ? (
          <p className="mono text-[10px]" style={{ color: "#c0504a" }}>{r.error}</p>
        ) : (
          <div className="space-y-1">
            {r?.damage != null && (
              <div className="mono text-[10px] flex gap-2" style={{ color: "var(--text-dim)" }}>
                <span>Damage</span>
                <span style={{ color: "#e08050", fontWeight: 600 }}>{r.damage}</span>
                {r?.damage_type && <span style={{ color: "var(--text-faint)" }}>{r.damage_type}</span>}
              </div>
            )}
            {r?.target_hp_remaining != null && (
              <div className="mono text-[10px]" style={{ color: "var(--text-faint)" }}>
                Target HP: {r.target_hp_remaining}
              </div>
            )}
            {r?.description && (
              <p className="serif text-xs" style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>
                {r.description}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
