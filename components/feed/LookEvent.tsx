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
  const exits: string[] = room?.exits
    ? room.exits.map((e: unknown) => typeof e === "string" ? e : (e as Record<string,string>)?.direction ?? (e as Record<string,string>)?.name)
    : roomState?.exits ?? []
  const npcs: string[]  = extractNames(room?.npcs ?? roomState?.npcs)
  const chars: string[] = extractNames(room?.characters ?? room?.agents ?? roomState?.characters)
  const objs: string[]  = extractNames(room?.objects ?? roomState?.objects)

  return (
    <div className="corner-ornaments" style={{
      border: "1px solid var(--border)",
      background: "var(--bg-card)",
    }}>
      <div className="px-4 pt-3 pb-4 space-y-2">
        {/* Header */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="mono text-[9px] tracking-[0.3em] uppercase" style={{ color: "rgba(100,65,15,0.7)" }}>look</span>
          <span className="serif text-sm font-medium" style={{ color: "var(--amber)" }}>{name}</span>
          {hub && (
            <span className="mono text-[9px]" style={{ color: "var(--text-faint)" }}>Hub {hub}</span>
          )}
          {sanctuary && (
            <span className="mono text-[9px] px-1.5 py-0.5" style={{
              background: "rgba(40,90,50,0.3)",
              border: "1px solid rgba(60,120,70,0.4)",
              color: "rgba(100,180,110,0.8)",
            }}>Sanctuary</span>
          )}
        </div>

        {/* Description */}
        {desc && (
          <p className="serif text-xs leading-relaxed" style={{ color: "var(--text)", lineHeight: 1.7 }}>
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
            <RoomList label="Objects" items={objs} color="var(--text-dim)" />
          )}
        </div>
      </div>
    </div>
  )
}

function RoomList({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="flex gap-1.5 items-baseline">
      <span className="mono text-[8px] uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>{label}</span>
      <span className="mono text-[10px]" style={{ color }}>{items.join(" · ")}</span>
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
