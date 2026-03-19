/**
 * Shared types for SSE events, character state, and room state.
 */

// ---------------------------------------------------------------------------
// SSE events emitted by /api/agent
// ---------------------------------------------------------------------------

export type AgentEvent =
  | { type: "thinking";    text: string }
  | { type: "tool_call";   tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: unknown; input?: Record<string, unknown> }
  | { type: "state";       state: CharacterState }
  | { type: "resources";   resources: PulseResources }
  | { type: "room";        room: RoomState }
  | { type: "done";        reason: string }
  | { type: "error";       message: string }

// ---------------------------------------------------------------------------
// Character state (extracted from look/move/character results)
// ---------------------------------------------------------------------------

export interface CharacterState {
  name: string
  class?: string
  level?: number
  hpCurrent: number
  hpMax: number
  hpTemp?: number
  ac?: number
  conditions?: string[]
  resources?: PulseResources
  isDying?: boolean
  /** e.g. { "wolf-l6vt": "near" } */
  engagementZones?: Record<string, string>
}

export interface PulseResources {
  action: number
  movement: number
  bonus_action: number
  reaction: number
  chat: number
}

// ---------------------------------------------------------------------------
// Room state (extracted from look/move results)
// ---------------------------------------------------------------------------

export interface RoomState {
  name: string
  hub?: number | string
  isSanctuary: boolean
  description?: string
  exits?: string[]
  npcs?: string[]
  characters?: string[]
  objects?: string[]
}

// ---------------------------------------------------------------------------
// Activity feed entry (rendered in the feed)
// ---------------------------------------------------------------------------

export interface FeedEntry {
  id: string
  timestamp: number
  event: AgentEvent
}
