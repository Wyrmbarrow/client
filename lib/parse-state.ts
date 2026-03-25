/**
 * Extracts CharacterState and RoomState from raw MCP tool results.
 * Called after every tool_result event to keep panels up to date.
 */

import type { CharacterState, RoomState, ExitInfo, PulseResources } from "./types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>

// ---------------------------------------------------------------------------
// Character state
// ---------------------------------------------------------------------------

export function parseCharacterState(toolName: string, result: unknown): CharacterState | null {
  const r = result as AnyObj
  if (!r || typeof r !== "object") return null

  // look / move return { character: { ... } } at top level
  // char.to_json() returns { name, charsheet: { hp_current, hp_max, class, level, ac, ... }, pulse_resources, conditions, ... }
  const cs = r.character ?? r.bootstrap?.character ?? null

  // character(action="status") or direct charsheet access
  const sheet: AnyObj = cs ?? (r.hp_current !== undefined || r.charsheet !== undefined ? r : null)
  if (!sheet) return null

  // HP/class/level/AC may be in a nested charsheet or directly on the sheet
  const sub: AnyObj = sheet.charsheet ?? sheet

  return {
    name:            sheet.name ?? sub.name ?? "",
    class:           sub.class ?? undefined,
    level:           sub.level ?? undefined,
    hpCurrent:       sub.hp_current ?? 0,
    hpMax:           sub.hp_max ?? 0,
    hpTemp:          sub.hp_temp ?? 0,
    ac:              sub.ac ?? undefined,
    conditions:      sheet.conditions ?? sub.conditions ?? [],
    resources:       parsePulseResources(sheet.pulse_resources ?? r.pulse_resources),
    isDying:         sheet.is_dying ?? false,
    engagementZones: sheet.engagement_zones ?? undefined,
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

  const exits: ExitInfo[] = []
  if (Array.isArray(roomData.exits)) {
    for (const e of roomData.exits) {
      if (typeof e === "string") {
        exits.push({ key: e, aliases: [], destination: null })
      } else if (e && typeof e === "object") {
        exits.push({
          key: e.key ?? e.direction ?? e.name ?? String(e),
          aliases: Array.isArray(e.aliases) ? e.aliases : [],
          destination: e.destination ?? null,
        })
      }
    }
  }

  // Contents may be flat on roomData or nested under roomData.contents
  const contents: AnyObj = roomData.contents ?? roomData
  const npcs: string[] = extractNames(contents.npcs ?? roomData.npcs)
  const characters: string[] = extractNames(contents.characters ?? contents.agents ?? roomData.characters ?? roomData.agents)
  const characterRefs = extractRefs(contents.characters ?? contents.agents ?? roomData.characters ?? roomData.agents)
  const objects: string[] = extractNames(contents.objects ?? roomData.objects)

  return {
    name:        roomData.name ?? roomData.key ?? "Unknown",
    hub:         roomData.hub ?? undefined,
    isSanctuary: Boolean(roomData.is_sanctuary),
    description: roomData.description ?? roomData.desc ?? undefined,
    exits,
    npcs,
    characters,
    characterRefs,
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

function extractRefs(arr: unknown): { name: string; ref: string }[] {
  if (!Array.isArray(arr)) return []
  return arr.map((item) => {
    if (typeof item === "string") return { name: item, ref: item }
    if (typeof item === "object" && item !== null) {
      const o = item as AnyObj
      const name = o.name ?? o.key ?? o.npc ?? String(item)
      const ref = o.ref ?? o.key ?? o.id ?? name
      return { name, ref }
    }
    return { name: String(item), ref: String(item) }
  })
}
