# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev           # Run the assistant (no build step needed, uses tsx)
npm run build         # Compile TypeScript to dist/
npm run send -- "msg" # Queue a message from the CLI
```

No test runner or linter is configured. TypeScript targets ES2022 with NodeNext module resolution.

## Architecture

Agent-Loop is a persistent local assistant built on the Claude Agent SDK. It runs as a long-lived process with a REPL, SQLite-backed message queue, file-based IPC, and a task scheduler.

**Entry points:**
- `src/index.ts` — starts REPL, polls queue (1s interval), watches IPC files, starts scheduler
- `send.ts` — CLI tool to enqueue a message without opening the REPL

**Core modules:**
- `src/agent.ts` — runs prompts via Claude Agent SDK `query()`; manages session resumption and live message injection via `MessageStream` (async generator); 30-minute idle timeout; polls `ipc/input/` for injected messages during a query
- `src/mcp.ts` — MCP server (spawned as subprocess by the SDK) that exposes tools to the agent: `send_message`, `schedule_task`, `list_tasks`, `pause_task`, `resume_task`, `cancel_task`, `update_task`
- `src/db.ts` — SQLite via `better-sqlite3`; tables: `messages`, `scheduled_tasks`, `task_run_logs`, `kv`; database stored in `store/agent.db`
- `src/scheduler.ts` — polls for due tasks every 60s; supports `cron`, `interval` (ms), and `once` (ISO timestamp) schedule types; runs tasks concurrently
- `src/ipc.ts` — file-based IPC using `ipc/messages/`, `ipc/tasks/` dirs; polls every 500ms; processes MCP tool output into SQLite

**Data flow:**
1. User input (REPL or `send.ts`) → SQLite `messages` table → queue processor → `runAgent()`
2. MCP tools write JSON files to `ipc/messages/` or `ipc/tasks/` → IPC watcher reads and processes them
3. Live message injection: REPL input during active agent → `ipc/input/*.json` → `MessageStream` async generator → SDK
4. Session close: `ipc/input/_close` sentinel file ends the active query loop

**Session persistence:** Session ID is stored in the `kv` table and resumed across restarts. The SDK `resume` option restores conversation history.

**Task context modes:**
- `"group"` — resumes the current conversation (shares history)
- `"isolated"` — fresh Claude session (prompt must include all needed context)

**Conversation archival:** A PreCompact hook in `agent.ts` writes `workspace/conversations/YYYY-MM-DD-{session-id}.md`.

**Key directories (gitignored runtime data):**
- `store/` — SQLite database
- `ipc/` — IPC JSON files (input/, messages/, tasks/, current_tasks.json)
- `workspace/` — agent working directory and conversation archives

---

# Agent Runtime Instructions

You are a personal assistant running locally. You have access to:
- A workspace directory (`workspace/`) for your files — this is your working directory
- Web search and browsing
- Bash (runs on the host, full access)
- Scheduled tasks (use `schedule_task` to set up recurring or one-time tasks)

## Communication

Use `mcp__agent_loop__send_message` to send messages immediately while still working.
Wrap internal reasoning in `<internal>` tags to suppress it from output.

## Memory

Store notes and structured data as files in `workspace/`. The `workspace/conversations/`
folder contains archived past conversations — search it to recall previous context.

## Scheduling

When asked to do something later or on a recurring basis, use `schedule_task`.
- `context_mode: "group"` — resumes the current conversation (access to history)
- `context_mode: "isolated"` — fresh session (include all context in the prompt)
