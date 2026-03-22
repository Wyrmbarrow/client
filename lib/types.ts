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

// ---------------------------------------------------------------------------
// Party management types
// ---------------------------------------------------------------------------

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
  noToolChoice?: boolean
}

export interface AgentCredentials {
  name: string
  password: string
  directive?: string
  llmOverride?: Partial<LlmConfig> | null
}

export interface AgentState {
  agentId: string
  sessionId: string
  characterName: string
  credentials: AgentCredentials
  charState: CharacterState | null
  roomState: RoomState | null
  entries: FeedEntry[]
  status: "idle" | "running" | "stopped" | "resumable"
  directive: string
  llmOverride: Partial<LlmConfig> | null
  lastCharPoll: number
  lastLookPoll: number
  /** Bootstrap data from login — used on first run only */
  bootstrap: unknown
}

export type PartyAction =
  | { type: "set_char_state"; agentId: string; state: CharacterState }
  | { type: "set_room_state"; agentId: string; state: RoomState }
  | { type: "add_entry"; agentId: string; entry: FeedEntry }
  | { type: "set_status"; agentId: string; status: AgentState["status"] }
  | { type: "set_resources"; agentId: string; resources: PulseResources }
  | { type: "update_poll_time"; agentId: string; tool: "character" | "look" }
