/**
 * Command utilities for manual patron command execution
 */

import { TOOLS } from "./tools"

// Gameplay-only tools (exclude auth, character creation)
export const GAMEPLAY_TOOLS = [
  "look",
  "move",
  "explore",
  "character",
  "combat",
  "journal",
  "quest",
  "rest",
  "speak",
  "social",
  "shop",
] as const

export type GameplayTool = typeof GAMEPLAY_TOOLS[number]

export interface CommandAction {
  toolName: GameplayTool
  actionName: string
  description: string
  parameters?: Record<string, { required: boolean; description: string }>
}

export interface CommandMetadata {
  toolName: GameplayTool
  actions: CommandAction[]
}

/**
 * Get all available commands for patron manual execution
 */
export function getAvailableCommands(): CommandMetadata[] {
  return GAMEPLAY_TOOLS.map((toolName) => {
    const toolDef = (TOOLS as Record<string, any>)[toolName]
    if (!toolDef) {
      return {
        toolName,
        actions: [],
      }
    }

    const actions: CommandAction[] = []

    // Handle tools with actions (e.g., explore, combat, social)
    if (toolDef.actions && typeof toolDef.actions === "object") {
      for (const [actionName, actionDef] of Object.entries(toolDef.actions)) {
        const action = actionDef as any
        actions.push({
          toolName,
          actionName,
          description: action.description || "",
        })
      }
    } else {
      // Handle simple tools without actions (e.g., look, move)
      actions.push({
        toolName,
        actionName: "default",
        description: toolDef.description || "",
      })
    }

    return {
      toolName,
      actions,
    }
  })
}

/**
 * Get all actions for a specific tool
 */
export function getToolActions(toolName: GameplayTool): CommandAction[] {
  const metadata = getAvailableCommands().find((m) => m.toolName === toolName)
  return metadata?.actions || []
}

/**
 * Map of tools to their expected parameters when not explicitly listed
 */
const TOOL_PARAM_MAP: Record<string, string[]> = {
  move: ["direction"],
  speak: ["target_ref", "message"],
  social: ["target_ref", "message"],
  shop: ["vendor_ref", "action"],
  combat: ["action"],
  character: ["action"],
  explore: ["action"],
  journal: ["action"],
  quest: ["action"],
  rest: ["action"],
  look: ["target"],
}

/**
 * Infer parameter names from action description
 */
export function inferParametersFromDescription(
  toolName: string,
  description: string
): string[] {
  const params = new Set<string>()

  // First, try explicit patterns in description
  const patterns = [
    /Required:\s*([^.]+)/g,
    /Optional:\s*([^.]+)/g,
    /\(([a-z_]+)\)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(description)) !== null) {
      const text = match[1]
      // Split on commas and extract parameter names
      const items = text.split(",").map((s) => s.trim())
      for (const item of items) {
        const paramMatch = item.match(/(\b[a-z_][a-z_0-9]*\b)/i)
        if (paramMatch) {
          params.add(paramMatch[1])
        }
      }
    }
  }

  // If no params found, check the tool parameter map
  if (params.size === 0 && toolName in TOOL_PARAM_MAP) {
    return TOOL_PARAM_MAP[toolName as keyof typeof TOOL_PARAM_MAP]
  }

  return Array.from(params)
}
