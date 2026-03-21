/**
 * agent-loop main process.
 *
 * Starts the REPL, IPC watcher, and task scheduler.
 * Messages from the REPL or send.ts are queued in SQLite and processed in order.
 * While an agent is running, new REPL input is injected into the live session.
 */
import readline from 'readline';

import { closeSession, injectMessage, runAgent } from './agent.js';
import {
  enqueueMessage,
  getNextPendingMessage,
  getSession,
  initDb,
  markMessageDone,
  setSession,
  writeTasksSnapshot,
} from './db.js';
import { startIpcWatcher } from './ipc.js';
import { startScheduler } from './scheduler.js';

// --- State ---
let currentSessionId: string | undefined;
let agentRunning = false;
let queueProcessing = false;

// --- Helpers ---

function print(text: string): void {
  // Ensure output starts on a new line (in case REPL prompt is showing)
  process.stdout.write(`\nAssistant: ${text}\n\n> `);
}

function onSessionId(id: string): void {
  currentSessionId = id;
  setSession(id);
}

// --- Queue processor ---

async function processQueue(): Promise<void> {
  if (queueProcessing) return;
  queueProcessing = true;

  while (true) {
    const msg = getNextPendingMessage();
    if (!msg) break;

    agentRunning = true;
    try {
      const finalSessionId = await runAgent(msg.content, {
        sessionId: currentSessionId,
        onOutput: (text) => print(text),
        onSessionId,
      });
      if (finalSessionId) onSessionId(finalSessionId);
    } catch (err) {
      console.error('\n[agent] Error:', err);
    } finally {
      agentRunning = false;
    }

    markMessageDone(msg.id);
  }

  queueProcessing = false;
}

// Poll for externally queued messages (from send.ts)
function startQueuePoller(): void {
  const poll = () => {
    if (agentRunning) {
      // Agent is busy — inject pending messages into the live session
      let msg = getNextPendingMessage();
      while (msg) {
        injectMessage(msg.content);
        markMessageDone(msg.id);
        msg = getNextPendingMessage();
      }
    } else if (!queueProcessing) {
      processQueue().catch(console.error);
    }
    setTimeout(poll, 1000);
  };
  setTimeout(poll, 1000);
}

// --- REPL ---

function startRepl(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  rl.prompt();

  rl.on('line', (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    if (agentRunning) {
      // Inject into the live session instead of queuing
      injectMessage(text);
      console.log('[injected into active session]');
    } else {
      enqueueMessage(text);
      processQueue().catch(console.error);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    // User hit Ctrl+D — close the active session gracefully then exit
    if (agentRunning) closeSession();
    process.exit(0);
  });
}

// --- Main ---

async function main(): Promise<void> {
  initDb();

  // Restore session from last run
  currentSessionId = getSession();

  // Write initial tasks snapshot for MCP list_tasks
  writeTasksSnapshot();

  // IPC watcher: receives send_message output + task ops from MCP
  startIpcWatcher({
    onMessage: (text) => print(text),
    onTasksChanged: () => writeTasksSnapshot(),
    getSessionId: () => currentSessionId,
  });

  // Scheduler: runs due tasks
  startScheduler({
    getSessionId: () => currentSessionId,
    onSessionId,
    onOutput: (text) => print(text),
  });

  // Poll for messages added by send.ts while this process is running
  startQueuePoller();

  console.log('agent-loop ready. Type a message or run: node send.ts "..."');
  if (currentSessionId) {
    console.log(`Resuming session ${currentSessionId.slice(0, 8)}…`);
  }

  startRepl();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
