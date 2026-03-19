/**
 * MCP tool execute() and streamText tool results can arrive in several shapes:
 *   1. A plain JS object (already parsed)
 *   2. A JSON string
 *   3. MCP CallToolResult: { content: [{ type: "text", text: "...json..." }] }
 *
 * This helper normalises all three forms into a plain object.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMcpResult(result: unknown): Record<string, any> {
  if (typeof result === "string") {
    try { return JSON.parse(result) } catch { return { error: result } }
  }

  // MCP CallToolResult: { content: [{ type: "text", text: "..." }] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = result as any
  if (r?.content?.[0]?.text) {
    const text = r.content[0].text
    if (typeof text === "string") {
      try { return JSON.parse(text) } catch { return { error: text } }
    }
    if (typeof text === "object" && text !== null) return text
  }

  if (result && typeof result === "object") return result as Record<string, unknown>
  return {}
}
