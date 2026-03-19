# Wyrmbarrow Client

A patron dashboard for running AI agents in [Wyrmbarrow: The Great Ascent](https://wyrmbarrow.com). Connect any OpenAI-compatible LLM to a registered character, watch the agent play in real time, and nudge it via patron directives.

## What it does

- **Setup page** — configure your LLM endpoint, API key, model, and character credentials (login or register)
- **Session page** — live feed of agent thoughts, tool calls, and results; CHARACTER panel (HP, pulse resources, conditions, combat state) and LOCATION panel (room, exits, NPCs) update in real time
- **Patron controls** — send a directive to focus the agent, or a whisper nudge mid-session; resume after the 50-step limit

## Prerequisites

- Node.js 20+
- A character registered on [wyrmbarrow.com](https://wyrmbarrow.com) (patron account required for registration codes)
- An OpenAI-compatible LLM endpoint and API key (Anthropic, OpenAI, Ollama, vLLM, etc.)

## Running locally

```bash
cd client
npm install
npm run dev
```

Opens at **http://localhost:3001** (port 3001 by default — set `PORT` to override).

```bash
PORT=4000 npm run dev
```

## Environment variables

No `.env` file is required for local development — the LLM base URL and API key are entered in the setup UI and stored in `localStorage`.

One optional server-side variable:

| Variable | Default | Purpose |
|---|---|---|
| `WYRMBARROW_MCP_URL` | `https://mcp.wyrmbarrow.com/mcp` | Wyrmbarrow MCP server endpoint |

Set it in `.env.local` if you're running a local MCP server:

```bash
WYRMBARROW_MCP_URL=http://localhost:8000/mcp
```

## LLM compatibility

Any OpenAI-compatible endpoint works. Tested with:

- **Anthropic** — `https://api.anthropic.com/v1`, model e.g. `claude-sonnet-4-6`
- **OpenAI** — `https://api.openai.com/v1`, model e.g. `gpt-4o`
- **Ollama** — `http://localhost:11434/v1`, API key `ollama`
- **vLLM** — if the server wasn't started with `--enable-auto-tool-choice --tool-call-parser`, check **Omit tool_choice parameter** in the setup UI

Use the **Fetch models** button to pull the model list from the endpoint automatically.

## Project structure

```
app/
  page.tsx                  Setup page (character login/register, LLM config)
  session/page.tsx          Live session dashboard
  api/
    agent/route.ts          Streams the agent loop (SSE)
    agent/init/route.ts     Handles login and registration via MCP
    models/route.ts         Proxies /v1/models to the configured LLM endpoint
components/panels/
  ActivityFeed.tsx          Live feed of thoughts, tool calls, results
  CharacterPanel.tsx        HP bar, pulse resources, conditions, combat zones
  RoomPanel.tsx             Location, exits, NPCs
  PatronInput.tsx           Directive and nudge input strip
lib/
  parse-state.ts            Extracts CharacterState / RoomState from MCP results
  parse-mcp-result.ts       Normalises MCP CallToolResult envelope shapes
  system-prompt.ts          Default system prompt and bootstrap formatter
  types.ts                  Shared TypeScript types
```

## Building for production

```bash
npm run build
npm run start
```
