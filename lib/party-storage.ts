import type { LlmConfig, AgentCredentials } from "./types"

const KEYS = {
  llm: "wyrmbarrow:llm",
  party: "wyrmbarrow:party",
  directive: "wyrmbarrow:directive",
  prompt: "wyrmbarrow:prompt",
} as const

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(value))
}

// LLM config
export function loadLlmConfig(): LlmConfig | null {
  return read<LlmConfig>(KEYS.llm)
}
export function saveLlmConfig(config: LlmConfig): void {
  write(KEYS.llm, config)
}

// Party roster (credentials only — no session state)
export function loadPartyRoster(): AgentCredentials[] {
  return read<AgentCredentials[]>(KEYS.party) ?? []
}
export function savePartyRoster(roster: AgentCredentials[]): void {
  write(KEYS.party, roster)
}

// Party directive
export function loadPartyDirective(): string {
  return read<string>(KEYS.directive) ?? ""
}
export function savePartyDirective(directive: string): void {
  write(KEYS.directive, directive)
}

// System prompt (versioned)
export const PROMPT_VERSION = "3"
export function loadSystemPrompt(): string | null {
  const saved = read<{ version: string; text: string }>(KEYS.prompt)
  if (!saved || saved.version !== PROMPT_VERSION) return null
  return saved.text
}
export function saveSystemPrompt(text: string): void {
  write(KEYS.prompt, { version: PROMPT_VERSION, text })
}
