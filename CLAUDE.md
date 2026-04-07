# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Wyrmbarrow Client is a Next.js patron dashboard that orchestrates AI agents playing in the Wyrmbarrow MUD. Patrons configure an LLM endpoint, authenticate characters, then watch agents play autonomously via a real-time activity feed. Up to 4 agents can run concurrently with Party Mode allowing a single LLM to control all party members.

This is a standalone git repo (`Wyrmbarrow/client`), separate from the other Wyrmbarrow repos (server, mcp, portal, lore, infra). See the root `CLAUDE.md` one directory up for the full project layout.

## Commands

```bash
npm run dev      # Dev server on :3001 (or PORT env var)
npm run build    # Production build
npm run start    # Serve production build on :3001
npm run lint     # ESLint (flat config, Next.js + TypeScript rules)
```

No test framework is configured.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `WYRMBARROW_MCP_URL` | `https://mcp.wyrmbarrow.com/mcp` | MCP server endpoint |
| `ALLOWED_DEV_ORIGINS` | — | Comma-separated CORS origins for local dev |
| `LLM_RATE_LIMIT_ENABLED` | `true` | Toggle global rate limiter |
| `LLM_RATE_LIMIT_MAX_REQUESTS` | `40` | Max LLM requests per window |
| `LLM_RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window in ms |

## Architecture

### Three-layer design

1. **Agent Loop** (`app/api/agent/route.ts`) — SSE streaming endpoint using AI SDK `streamText`. Runs up to 50 LLM steps per invocation. Registers both MCP tools (from the game server) and local tools (`read_todo`, `update_todo`, `follower_*` in Party Mode). On completion, the client auto-restarts the loop (500ms pause, or 30s on rate limit).

2. **State Normalization** (`lib/parse-state.ts`, `lib/parse-mcp-result.ts`) — Defensive parsing layer that extracts typed `CharacterState` and `RoomState` from raw MCP tool results. Handles three input shapes: plain objects, JSON strings, and MCP `CallToolResult` envelopes. Multi-path extraction searches `character` → `bootstrap.character` → root object.

3. **Frontend Orchestration** (`hooks/use-party.ts`, `hooks/use-poller.ts`, `hooks/use-party-mode.ts`) — React hooks managing multi-agent state, background polling, and Party Mode transitions.

### Data flow

```
Setup page (/) → sessionStorage handoff → Session page (/session)
                                              ↓
                                         useParty hook
                                              ↓
                                    POST /api/agent (SSE stream)
                                              ↓
                                    AI SDK streamText ↔ MCP tools
                                              ↓
                                    SSE events → activity feed
```

### API routes

| Route | Purpose |
|---|---|
| `/api/agent` | Main agent loop (SSE). Takes LLM config, sessionId, system prompt, bootstrap/resume context, TODO, partyMembers. |
| `/api/agent/init` | Character login/register via MCP. Returns sessionId + bootstrap payload. |
| `/api/agent/action` | Direct MCP tool execution for party operations (whitelisted to `social`). |
| `/api/agent/command` | Patron manual command execution. Whitelisted tool set. |
| `/api/agent/poll` | Background state polling (`look` or `character`). No LLM involved. |
| `/api/models` | OpenAI-compat model list proxy with SSRF validation. |

### Party Mode (single-LLM design)

The leader's LLM loop controls all party members via `follower_*` local tools (combat, move_zone, journal, rest, character). Followers don't run separate LLM loops — their agents remain idle. The leader's route resolves follower names to their sessionIds and executes MCP tools on their behalf. Results emit both a normal `tool_result` (for the leader's LLM) and a `follower_tool_result` (routed to the follower's activity feed in the UI).

### MCP client singleton

`lib/mcp-session-manager.ts` maintains a module-level singleton MCP connection. Tool map is fetched once and shared across all agents. 30-second cooldown after init failure. Exponential backoff (2s, 5s) on 429 responses.

### Storage

- **localStorage**: LLM config, system prompt (versioned, v3), party roster, per-character TODO lists, per-agent directives
- **sessionStorage**: `wyrmbarrow:firstAgent` — one-time handoff from setup to session page

### Background polling

Character state polls every 3s (half a Pulse). Room state polls every 6s in solo, 3s in Party Mode. Polls rotate through agents by staleness. Both back off 30s on 429.

## Key conventions

- **Provider compatibility**: `createReasoningTransform` remaps non-standard reasoning fields (e.g. GLM4's `reasoning_content`). The `noToolChoice` flag strips `tool_choice` for servers like vLLM that reject it.
- **System prompt assembly**: `WORLD_RULES` (fixed game rules) + character class/level + `CHARACTER_BRIEF` (patron-editable) + optional directive + optional TODO + optional party members section. Built in `lib/system-prompt.ts`.
- **Tool catalog**: `lib/tools.ts` contains the full MCP tool descriptions, actions, and parameters. This must stay in sync with the MCP server's tool definitions.
- **Feed event rendering**: Each MCP tool has a specialized renderer in `components/feed/` (look, combat, speak, journal, etc.) with a generic fallback for unrecognized tools.
- **UI framework**: shadcn/ui components (base-nova theme) with Tailwind CSS 4. Config in `components.json`.
- **Fonts**: Geist (body) + Cinzel (headings/fantasy elements), loaded in `app/layout.tsx`.