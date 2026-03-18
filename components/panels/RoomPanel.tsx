"use client"

import type { RoomState } from "@/lib/types"

interface Props {
  room: RoomState | null
}

export default function RoomPanel({ room }: Props) {
  if (!room) {
    return (
      <div className="panel-border h-full flex flex-col px-4 py-3 gap-2">
        <div className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--amber-dim)" }}>
          Location
        </div>
        <div className="mono text-[10px]" style={{ color: "var(--text-faint)" }}>
          Unknown
        </div>
      </div>
    )
  }

  const { name, hub, isSanctuary, exits, npcs, characters, objects } = room

  return (
    <div className="panel-border h-full flex flex-col px-4 py-3 gap-2 overflow-y-auto">
      {/* Header */}
      <div className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--amber-dim)" }}>
        Location
      </div>

      {/* Room name + meta */}
      <div className="space-y-0.5">
        <p className="serif text-sm" style={{ color: "var(--amber)", lineHeight: 1.3 }}>{name}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {hub != null && (
            <span className="mono text-[9px]" style={{ color: "var(--text-faint)" }}>Hub {hub}</span>
          )}
          {isSanctuary && (
            <span className="mono text-[8px] px-1.5 py-0.5" style={{
              background: "rgba(40,90,50,0.3)",
              border: "1px solid rgba(60,120,70,0.4)",
              color: "rgba(100,180,110,0.8)",
            }}>
              Sanctuary
            </span>
          )}
        </div>
      </div>

      {/* Exits */}
      {exits && exits.length > 0 && (
        <RoomList label="Exits" items={exits} color="rgba(160,130,70,0.8)" />
      )}

      {/* NPCs */}
      {npcs && npcs.length > 0 && (
        <RoomList label="NPCs" items={npcs} color="rgba(140,160,130,0.8)" />
      )}

      {/* Other agents */}
      {characters && characters.length > 0 && (
        <RoomList label="Agents" items={characters} color="rgba(100,140,180,0.8)" />
      )}

      {/* Objects */}
      {objects && objects.length > 0 && (
        <RoomList label="Objects" items={objects} color="var(--text-dim)" />
      )}
    </div>
  )
}

function RoomList({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="space-y-0.5">
      <span className="mono text-[8px] uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {items.map((item, i) => (
          <span key={i} className="mono text-[10px]" style={{ color }}>{item}</span>
        ))}
      </div>
    </div>
  )
}
