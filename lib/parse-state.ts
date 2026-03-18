/**
 * Extracts CharacterState and RoomState from raw MCP tool results.
 * Called after every tool_result event to keep panels up to date.
 */

import type { CharacterState, RoomState, PulseResources } from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

// ---------------------------------------------------------------------------
// Character state
// ---------------------------------------------------------------------------

export function parseCharacterState(toolName: string, result: unknown): CharacterState | null {
  const r = result as AnyObj
  if (!r || typeof r !== "object") return null

  // look / move return { character: { ... } } at top level
  const cs = r.character ?? r.bootstrap?.character ?? r.charsheet ?? null

  // character(action="status") returns the charsheet directly
  const sheet: AnyObj = cs ?? (r.hp_current !== undefined ? r : null)
  if (!sheet) return null

  return {
    name:       sheet.name ?? "",
    class:      sheet.class ?? undefined,
    level:      sheet.level ?? undefined,
    hpCurrent:  sheet.hp_current ?? 0,
    hpMax:      sheet.hp_max ?? 0,
    hpTemp:     sheet.hp_temp ?? 0,
    ac:         sheet.ac ?? undefined,
    conditions: sheet.conditions ?? [],
    resources:  parsePulseResources(r.pulse_resources ?? sheet.pulse_resources),
  }
}

function parsePulseResources(raw: unknown): PulseResources | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const r = raw as AnyObj
  return {
    action:       r.action        ?? 0,
    movement:     r.movement      ?? 0,
    bonus_action: r.bonus_action  ?? 0,
    reaction:     r.reaction      ?? 0,
    chat:         r.chat          ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------

export function parseRoomState(toolName: string, result: unknown): RoomState | null {
  const r = result as AnyObj
  if (!r || typeof r !== "object") return null

  // look / move have { room: { ... } }
  const roomData: AnyObj = r.room ?? (r.name && r.hub !== undefined ? r : null)
  if (!roomData) return null

  const exits: string[] = []
  if (Array.isArray(roomData.exits)) {
    for (const e of roomData.exits) {
      exits.push(typeof e === "string" ? e : e.direction ?? e.name ?? String(e))
    }
  }

  const npcs: string[] = extractNames(roomData.npcs)
  const characters: string[] = extractNames(roomData.characters ?? roomData.agents)
  const objects: string[] = extractNames(roomData.objects)

  return {
    name:        roomData.name ?? roomData.key ?? "Unknown",
    hub:         roomData.hub ?? undefined,
    isSanctuary: Boolean(roomData.is_sanctuary),
    description: roomData.description ?? roomData.desc ?? undefined,
    exits,
    npcs,
    characters,
    objects,
  }
}

function extractNames(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map((item) => {
    if (typeof item === "string") return item
    if (typeof item === "object" && item !== null) {
      const o = item as AnyObj
      return o.name ?? o.key ?? o.npc ?? String(item)
    }
    return String(item)
  })
}
