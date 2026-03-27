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

// If createMCPClient or tools() hangs (e.g. server unresponsive), bail out so
// _initPromise is cleared and the next caller can retry from scratch.
const INIT_TIMEOUT_MS = 30_000

// On 429: wait 2s, then 5s, then give up (3 attempts total).
const RETRY_DELAYS_MS = [2000, 5000]

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>
type MCPTools = Awaited<ReturnType<MCPClient["tools"]>>

let _client: MCPClient | null = null
let _tools: MCPTools | null = null
let _initPromise: Promise<MCPTools> | null = null
// After a failed init, block all callers for this long so the mcp_init rate-limit
// bucket can refill (30r/m = 0.5 tokens/sec → 15 token burst refills in ~30s).
let _cooldownUntil = 0
const INIT_COOLDOWN_MS = 30_000

async function _init(): Promise<MCPTools> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeoutP = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("MCP session init timed out")),
      INIT_TIMEOUT_MS,
    )
  })

  return Promise.race([
    (async () => {
      try {
        const client = await createMCPClient({ transport: { type: "http", url: MCP_URL } })
        const tools = await client.tools()
        _client = client
        _tools = tools
        return tools
      } finally {
        clearTimeout(timeoutId!)
      }
    })(),
    timeoutP,
  ])
}

/**
 * Returns the cached MCP tool map, initialising the client on first call.
 * Concurrent callers during initialisation share a single in-flight promise.
 */
export async function getMCPTools(): Promise<MCPTools> {
  if (_tools) return _tools
  if (Date.now() < _cooldownUntil) {
    throw new Error("MCP session init in cooldown — waiting for rate-limit bucket to refill")
  }
  if (!_initPromise) {
    _initPromise = _init().catch(err => {
      // Reset so the next caller can retry, but impose a cooldown so rapid
      // poll calls don't hammer the mcp_init rate-limit bucket while it refills.
      _initPromise = null
      _client = null
      _tools = null
      _cooldownUntil = Date.now() + INIT_COOLDOWN_MS
      throw err
    })
  }
  return _initPromise
}

/**
 * Tear down the shared client and clear the cache.
 * Called internally after 429/5xx so the next attempt gets a fresh connection.
 */
export function invalidateMCPSession(): void {
  _client?.close().catch(() => {})
  _client = null
  _tools = null
  _initPromise = null
  _cooldownUntil = 0
}

/**
 * Execute an MCP tool by name, retrying on 429 with exponential backoff.
 *
 * On each 429 the session is invalidated so the next attempt re-establishes
 * the connection, preventing retries against a cached broken client.
 */
export async function executeMcpTool(
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const attempts = RETRY_DELAYS_MS.length + 1

  for (let i = 0; i < attempts; i++) {
    try {
      const tools = await getMCPTools()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (tools[toolName] as any).execute(input, { toolCallId: "mcp", messages: [] })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const is429 = msg.includes("429") || msg.includes("Too Many Requests")

      if (!is429) {
        // Connection-level failure — drop the cached session so the next caller
        // gets a fresh client rather than retrying on a broken one.
        invalidateMCPSession()
        throw err
      }

      // Rate-limited: keep the existing session, just wait before retrying.
      if (i === attempts - 1) throw err
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[i]))
    }
  }

  // Unreachable — the loop always throws or returns before here.
  throw new Error("executeMcpTool: exhausted retries")
}
