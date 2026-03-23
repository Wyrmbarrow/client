/**
 * MCP session manager — module-level singleton for the Next.js server process.
 *
 * The Wyrmbarrow MCP server is stateless at the HTTP level: session state lives
 * in the game server and is threaded via the session_id parameter on each tool call.
 * This means every poll for every agent can share one MCP client and one tool list.
 *
 * Without this, each poll opens a new connection and re-fetches the full tool list,
 * producing two HTTP round-trips per poll per agent — easily triggering nginx rate limits
 * with four agents polling at 1-second intervals.
 */

import { createMCPClient } from "@ai-sdk/mcp"

const MCP_URL = process.env.WYRMBARROW_MCP_URL ?? "https://mcp.wyrmbarrow.com/mcp"

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>
type MCPTools = Awaited<ReturnType<MCPClient["tools"]>>

let _client: MCPClient | null = null
let _tools: MCPTools | null = null
let _initPromise: Promise<MCPTools> | null = null

async function _init(): Promise<MCPTools> {
  const client = await createMCPClient({ transport: { type: "http", url: MCP_URL } })
  const tools = await client.tools()
  _client = client
  _tools = tools
  return tools
}

/**
 * Returns the cached MCP tool map, initialising the client on first call.
 * Concurrent callers during initialisation share a single in-flight promise.
 */
export async function getMCPTools(): Promise<MCPTools> {
  if (_tools) return _tools
  if (!_initPromise) {
    _initPromise = _init().catch(err => {
      // Reset so the next caller retries from scratch.
      _initPromise = null
      _client = null
      _tools = null
      throw err
    })
  }
  return _initPromise
}

/**
 * Tear down the shared client and clear the cache.
 * Call this when the MCP server returns 429 or 5xx so the next poll
 * gets a fresh connection rather than retrying on a broken one.
 */
export function invalidateMCPSession(): void {
  _client?.close().catch(() => {})
  _client = null
  _tools = null
  _initPromise = null
}
