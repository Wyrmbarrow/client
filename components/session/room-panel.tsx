"use client"

import type { RoomState, ExitInfo } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

interface RoomPanelProps {
  room: RoomState | null
}

export function RoomPanel({ room }: RoomPanelProps) {
  if (!room) {
    return (
      <div className="border-t border-[color:var(--wyr-border)] px-3 py-3">
        <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
          Location
        </p>
        <p className="font-mono text-[10px] text-muted-foreground mt-1">
          Unknown
        </p>
      </div>
    )
  }

  const { name, hub, isSanctuary, exits, npcs, characters, objects } = room

  return (
    <div className="border-t border-[color:var(--wyr-border)] px-3 py-3 space-y-2 overflow-y-auto">
      {/* Room name */}
      <div className="space-y-1">
        <h3 className="font-heading text-sm text-[color:var(--wyr-accent)] leading-tight">
          {name}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {hub != null && (
            <span className="font-mono text-[9px] text-muted-foreground">
              Hub {hub}
            </span>
          )}
          {isSanctuary && (
            <Badge
              variant="outline"
              className="font-mono text-[7px] tracking-widest uppercase h-4 border-green-800/40 text-green-500/80 bg-green-900/20"
            >
              Sanctuary
            </Badge>
          )}
        </div>
      </div>

      {/* Exits */}
      {exits && exits.length > 0 && (
        <ExitList exits={exits} />
      )}

      {/* NPCs */}
      {npcs && npcs.length > 0 && (
        <RoomList label="NPCs" items={npcs} colorClass="text-green-400/70" />
      )}

      {/* Party members */}
      {characters && characters.length > 0 && (
        <RoomList label="Party" items={characters} colorClass="text-blue-400/70" />
      )}

      {/* Objects */}
      {objects && objects.length > 0 && (
        <RoomList label="Objects" items={objects} colorClass="text-muted-foreground" />
      )}
    </div>
  )
}

function ExitList({ exits }: { exits: ExitInfo[] }) {
  return (
    <div className="space-y-0.5">
      <span className="font-mono text-[7px] uppercase tracking-widest text-muted-foreground">
        Exits
      </span>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {exits.map((exit) => (
          <span key={exit.key} className="font-mono text-[9px] text-[color:var(--wyr-accent)]/80">
            {exit.key}{exit.destination ? ` → ${exit.destination}` : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

function RoomList({
  label,
  items,
  colorClass,
}: {
  label: string
  items: string[]
  colorClass: string
}) {
  return (
    <div className="space-y-0.5">
      <span className="font-mono text-[7px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {items.map((item, i) => (
          <span key={i} className={`font-mono text-[9px] ${colorClass}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
