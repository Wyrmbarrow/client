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
  | { type: "command";     toolName: string; action: string; result: unknown }
  | { type: "follower_tool_result"; agentId: string; tool: string; result: unknown; input?: Record<string, unknown> }
  | { type: "todo_update"; content: string }
  | { type: "notification"; messages: RoomMessage[] }
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
  /** True when the character is dead and in spirit form */
  isDead?: boolean
  /** True when look() returns spirit_vision (dead character perspective) */
  spiritVision?: boolean
  /** Minutes remaining until auto-revival */
  minutesUntilRevival?: number
  /** Wall-clock time string when revival occurs */
  revivalAvailableAt?: string
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

export interface ExitInfo {
  key: string
  aliases: string[]
  destination: string | null
}

export interface RoomMessage {
  type: string
  from: string
  text: string
  timestamp: string
}

export interface RoomState {
  name: string
  hub?: number | string
  isSanctuary: boolean
  description?: string
  exits?: ExitInfo[]
  npcs?: string[]
  characters?: string[]
  /** Character refs for party operations (party_invite, follow). Parallel to characters[]. */
  characterRefs?: { name: string; ref: string }[]
  objects?: string[]
  /** Ephemeral room messages returned by look (NPC arrivals/departures, ambient events). */
  messages?: RoomMessage[]
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
  /** Persistent TODO list — survives 50-step restarts and page reloads */
  todo: string
}

/** Follower info passed to the agent route for Party Mode */
export interface PartyMember {
  name: string
  sessionId: string
  agentId: string
  charState: CharacterState | null
  roomState: RoomState | null
}
