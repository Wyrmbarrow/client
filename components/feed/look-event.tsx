import type { RoomState } from "@/lib/types"

interface Props {
  result: unknown
  roomState?: RoomState | null
}

export default function LookEvent({ result, roomState }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  const room = r?.room ?? r

  const name        = room?.name ?? room?.key ?? roomState?.name ?? "Unknown"
  const hub         = room?.hub ?? roomState?.hub
  const sanctuary   = room?.is_sanctuary ?? roomState?.isSanctuary ?? false
  const desc        = room?.description ?? room?.desc ?? roomState?.description ?? ""
  const spiritVision = r?.spirit_vision === true
  const minutesUntilRevival: number | undefined = r?.minutes_until_revival
  const exits: string[] = room?.exits
    ? room.exits.map((e: unknown) => typeof e === "string" ? e : (e as Record<string, string>)?.key ?? (e as Record<string, string>)?.direction ?? (e as Record<string, string>)?.name ?? String(e))
    : roomState?.exits?.map(e => e.key) ?? []
  const npcs: string[]  = extractNames(room?.contents?.npcs ?? room?.npcs)
  const chars: string[] = extractNames(room?.contents?.characters ?? room?.contents?.agents ?? room?.characters ?? room?.agents)
  const objs: string[]  = extractNames(room?.contents?.objects ?? room?.objects)

  return (
    <div className="corner-ornaments rounded-md border border-[color:var(--wyr-border)] bg-[var(--wyr-panel)]">
      <div className="px-4 pt-3 pb-4 space-y-2">
        {/* Header */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-[color:var(--wyr-muted)]">look</span>
          <span className="font-heading text-sm font-medium text-[color:var(--wyr-accent)]">{name}</span>
          {hub && (
            <span className="font-mono text-[9px] text-[color:var(--wyr-muted)]">Hub {hub}</span>
          )}
          {sanctuary && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm"
              style={{
                background: "rgba(40,90,50,0.3)",
                border: "1px solid rgba(60,120,70,0.4)",
                color: "rgba(100,180,110,0.8)",
              }}>
              Sanctuary
            </span>
          )}
          {spiritVision && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm"
              style={{
                background: "rgba(160,135,88,0.15)",
                border: "1px solid rgba(160,135,88,0.3)",
                color: "rgba(160,135,88,0.8)",
              }}>
              Spirit Vision
              {minutesUntilRevival != null && ` — ${minutesUntilRevival}m to revival`}
            </span>
          )}
        </div>

        {/* Description */}
        {desc && (
          <p className="font-serif text-xs leading-relaxed text-foreground" style={{ lineHeight: 1.7 }}>
            {desc}
          </p>
        )}

        {/* Exits / NPCs / Characters / Objects */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {exits.length > 0 && (
            <RoomList label="Exits" items={exits} color="rgba(160,130,70,0.8)" />
          )}
          {npcs.length > 0 && (
            <RoomList label="NPCs" items={npcs} color="rgba(140,160,130,0.8)" />
          )}
          {chars.length > 0 && (
            <RoomList label="Agents" items={chars} color="rgba(100,140,180,0.8)" />
          )}
          {objs.length > 0 && (
            <RoomList label="Objects" items={objs} color="var(--wyr-muted)" />
          )}
        </div>

      </div>
    </div>
  )
}

function RoomList({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="flex gap-1.5 items-baseline">
      <span className="font-mono text-[8px] uppercase tracking-widest text-[color:var(--wyr-muted)]">{label}</span>
      <span className="font-mono text-[10px]" style={{ color }}>{items.join(" · ")}</span>
    </div>
  )
}

function extractNames(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map((item) => {
    if (typeof item === "string") return item
    if (item && typeof item === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const o = item as any
      return o.name ?? o.key ?? o.npc ?? String(item)
    }
    return String(item)
  })
}
