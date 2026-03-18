"use client"

import type { CharacterState, PulseResources } from "@/lib/types"

interface Props {
  state: CharacterState | null
}

export default function CharacterPanel({ state }: Props) {
  if (!state) {
    return (
      <div className="panel-border h-full flex flex-col px-4 py-3 gap-3">
        <div className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--amber-dim)" }}>
          Character
        </div>
        <div className="mono text-[10px]" style={{ color: "var(--text-faint)" }}>
          Awaiting session…
        </div>
      </div>
    )
  }

  const { name, class: cls, level, hpCurrent, hpMax, hpTemp, ac, conditions, resources } = state
  const hpPct = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0
  const hpColor = hpPct > 0.6 ? "rgba(80,160,90,0.8)" : hpPct > 0.3 ? "rgba(200,160,60,0.8)" : "#c0504a"

  return (
    <div className="panel-border h-full flex flex-col px-4 py-3 gap-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <span className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--amber-dim)" }}>
          Character
        </span>
        {ac != null && (
          <span className="mono text-[9px]" style={{ color: "var(--text-faint)" }}>AC {ac}</span>
        )}
      </div>

      {/* Name / class / level */}
      <div>
        <p className="serif text-sm" style={{ color: "var(--amber)", lineHeight: 1.2 }}>{name}</p>
        {(cls || level) && (
          <p className="mono text-[9px]" style={{ color: "var(--text-faint)" }}>
            {[cls, level ? `Level ${level}` : null].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* HP bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>HP</span>
          <span className="mono text-[10px]" style={{ color: hpColor }}>
            {hpCurrent}/{hpMax}
            {hpTemp != null && hpTemp > 0 && (
              <span style={{ color: "rgba(100,160,200,0.8)" }}> +{hpTemp}</span>
            )}
          </span>
        </div>
        <div className="h-1.5 w-full" style={{ background: "rgba(118,82,24,0.18)" }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${Math.round(hpPct * 100)}%`, background: hpColor }}
          />
        </div>
      </div>

      {/* Pulse resources */}
      {resources && <PulseBar resources={resources} />}

      {/* Conditions */}
      {conditions && conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {conditions.map(c => (
            <span key={c} className="mono text-[8px] px-1.5 py-0.5 uppercase tracking-wide" style={{
              background: "rgba(180,60,50,0.15)",
              border: "1px solid rgba(180,60,50,0.3)",
              color: "#c0504a",
            }}>
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function PulseBar({ resources }: { resources: PulseResources }) {
  const items: Array<{ key: keyof PulseResources; label: string; max: number }> = [
    { key: "action",       label: "ACT",  max: 1 },
    { key: "movement",     label: "MOV",  max: 1 },
    { key: "bonus_action", label: "BON",  max: 1 },
    { key: "reaction",     label: "REA",  max: 1 },
    { key: "chat",         label: "CHT",  max: 2 },
  ]

  return (
    <div className="space-y-0.5">
      <span className="mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>Pulse</span>
      <div className="flex gap-2 flex-wrap">
        {items.map(({ key, label, max }) => {
          const val = resources[key] ?? 0
          return (
            <div key={key} className="flex items-center gap-1">
              <span className="mono text-[8px] tracking-widest" style={{ color: "var(--text-faint)" }}>{label}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: max }).map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-sm" style={{
                    background: i < val ? "rgba(192,128,42,0.7)" : "rgba(118,82,24,0.2)",
                  }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
