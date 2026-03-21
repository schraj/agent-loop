# Agent Loop

A persistent local assistant built on the [Claude Agent SDK](https://docs.anthropic.com/en/docs/agents/agent-sdk). Runs as a long-lived process with a REPL, SQLite-backed message queue, file-based IPC, and a task scheduler.

## Quick Start

```bash
npm install
npm run dev        # Start the REPL
npm run send -- "your message here"  # Queue a message from another terminal
```

No build step is needed for development — `tsx` runs TypeScript directly.

## Features

- **REPL** — interactive prompt; input during an active agent run is injected into the live session
- **Message queue** — SQLite-backed, so messages are never lost (via REPL or `send.ts`)
- **Task scheduler** — schedule recurring (`cron`, `interval`) or one-time tasks that run autonomously
- **Session persistence** — conversation history is resumed across restarts
- **MCP server** — exposes tools (`send_message`, `schedule_task`, `list_tasks`, etc.) to the agent via the Model Context Protocol
- **File-based IPC** — MCP tool outputs are written as JSON files and picked up by the host process
- **Live message injection** — send follow-up messages into a running agent session
- **Conversation archival** — past conversations are saved to `workspace/conversations/`

## Architecture

```
src/
  index.ts       — entry point: REPL, queue poller, IPC watcher, scheduler
  agent.ts       — runs prompts via the SDK; manages sessions and live injection
  mcp.ts         — MCP server (subprocess) exposing tools to the agent
  db.ts          — SQLite schema and queries (messages, tasks, kv)
  scheduler.ts   — polls for due tasks every 60s, runs them concurrently
  ipc.ts         — watches ipc/ dirs and processes tool output into SQLite
  gmail-helper.ts — Gmail API helper (read emails, create drafts)
send.ts          — CLI tool to enqueue a message without the REPL
```

### Data Flow

1. User input (REPL or `send.ts`) → SQLite `messages` table → queue processor → `runAgent()`
2. Agent tools write JSON to `ipc/messages/` or `ipc/tasks/` → IPC watcher reads and processes them
3. Live injection: REPL input during active agent → `ipc/input/*.json` → `MessageStream` → SDK

### Runtime Directories (gitignored)

- `store/` — SQLite database
- `ipc/` — IPC JSON files
- `workspace/` — agent working directory, conversation archives, credentials

## Task Scheduling

The agent can schedule its own tasks via the `schedule_task` MCP tool:

- **`cron`** — e.g. `"0 9 * * *"` (daily at 9am)
- **`interval`** — milliseconds, e.g. `"600000"` (every 10 min)
- **`once`** — local ISO timestamp, e.g. `"2026-03-20T15:30:00"`

Tasks run in either `"group"` mode (shares conversation history) or `"isolated"` mode (fresh session).

## Gmail Integration

A helper script at `src/gmail-helper.ts` provides Gmail read/draft capabilities:

```bash
npx tsx src/gmail-helper.ts auth       # One-time OAuth setup
npx tsx src/gmail-helper.ts check      # List unread emails
npx tsx src/gmail-helper.ts read <id>  # Read full email
npx tsx src/gmail-helper.ts draft <id> "reply body"  # Create draft reply
npx tsx src/gmail-helper.ts drafts     # List drafts
```

Requires a Google Cloud project with the Gmail API enabled. Place `credentials.json` in `workspace/gmail/`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run the assistant (no build step) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run send -- "msg"` | Queue a message from the CLI |
