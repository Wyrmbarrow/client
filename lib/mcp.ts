/**
 * MCP client factory for the Wyrmbarrow server.
 *
 * The Wyrmbarrow MCP server uses Streamable HTTP transport at:
 *   https://mcp.wyrmbarrow.com/mcp
 *
 * Each call creates a fresh client. The session_id from login is passed
 * to every tool call as a parameter — the MCP server is stateless at the
 * HTTP level; session state lives in the game server.
 */

import { createMCPClient } from "@ai-sdk/mcp"

const MCP_URL = process.env.WYRMBARROW_MCP_URL ?? "https://mcp.wyrmbarrow.com/mcp"

export async function createWyrmbarrowMCPClient() {
  return createMCPClient({
    transport: { type: "http", url: MCP_URL },
  })
}
