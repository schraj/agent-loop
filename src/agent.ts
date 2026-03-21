/**
 * Core agent runner. Calls the Claude Agent SDK directly (no subprocess).
 * Manages a MessageStream so follow-up messages can be injected during a query.
 */
import { query, HookCallback, PreCompactHookInput } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const WORKSPACE_DIR = path.join(ROOT, 'workspace');
export const IPC_INPUT_DIR = path.join(ROOT, 'ipc', 'input');
export const IPC_INPUT_CLOSE = path.join(IPC_INPUT_DIR, '_close');

const IPC_POLL_MS = 500;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

type SDKUserMessage = {
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
};

class MessageStream {
  private queue: SDKUserMessage[] = [];
  private waiting: (() => void) | null = null;
  private done = false;

  push(text: string): void {
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    });
    this.waiting?.();
  }

  end(): void {
    this.done = true;
    this.waiting?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      while (this.queue.length > 0) yield this.queue.shift()!;
      if (this.done) return;
      await new Promise<void>((r) => {
        this.waiting = r;
      });
      this.waiting = null;
    }
  }
}

function drainIpcInput(): string[] {
  try {
    fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
    const files = fs
      .readdirSync(IPC_INPUT_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();
    const messages: string[] = [];
    for (const file of files) {
      const fp = path.join(IPC_INPUT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        fs.unlinkSync(fp);
        if (data.type === 'message' && data.text) messages.push(data.text);
      } catch {
        try {
          fs.unlinkSync(fp);
        } catch {}
      }
    }
    return messages;
  } catch {
    return [];
  }
}

function shouldClose(): boolean {
  if (fs.existsSync(IPC_INPUT_CLOSE)) {
    try {
      fs.unlinkSync(IPC_INPUT_CLOSE);
    } catch {}
    return true;
  }
  return false;
}

function createPreCompactHook(): HookCallback {
  return async (input) => {
    const { transcript_path: transcriptPath, session_id: sessionId } =
      input as PreCompactHookInput;
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return {};

    try {
      const messages: Array<{ role: string; content: string }> = [];
      for (const line of fs.readFileSync(transcriptPath, 'utf-8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'user' && entry.message?.content) {
            const text =
              typeof entry.message.content === 'string'
                ? entry.message.content
                : entry.message.content
                    .map((c: { text?: string }) => c.text || '')
                    .join('');
            if (text) messages.push({ role: 'user', content: text });
          } else if (entry.type === 'assistant' && entry.message?.content) {
            const text = entry.message.content
              .filter((c: { type: string }) => c.type === 'text')
              .map((c: { text: string }) => c.text)
              .join('');
            if (text) messages.push({ role: 'assistant', content: text });
          }
        } catch {}
      }
      if (messages.length === 0) return {};

      const dir = path.join(WORKSPACE_DIR, 'conversations');
      fs.mkdirSync(dir, { recursive: true });
      const date = new Date().toISOString().split('T')[0];
      const name = `${date}-${sessionId?.slice(0, 8) ?? 'conv'}.md`;

      const lines = [
        `# Conversation`,
        ``,
        `Archived: ${new Date().toLocaleString()}`,
        ``,
        `---`,
        ``,
      ];
      for (const msg of messages) {
        const body =
          msg.content.length > 2000
            ? msg.content.slice(0, 2000) + '...'
            : msg.content;
        lines.push(`**${msg.role === 'user' ? 'User' : 'Assistant'}**: ${body}`, ``);
      }
      fs.writeFileSync(path.join(dir, name), lines.join('\n'));
    } catch {}

    return {};
  };
}

export interface RunAgentOptions {
  sessionId?: string;
  isScheduledTask?: boolean;
  /** Called with each assistant text result as it arrives. */
  onOutput: (text: string) => void;
  /** Called whenever a session ID is established or updated. */
  onSessionId: (id: string) => void;
}

/**
 * Run the agent with an initial prompt. Keeps the session alive using a
 * MessageStream, polling ipc/input/ for follow-up messages until a _close
 * sentinel is received or the idle timeout fires.
 *
 * Returns the final session ID.
 */
export async function runAgent(
  prompt: string,
  opts: RunAgentOptions,
): Promise<string | undefined> {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
  try {
    fs.unlinkSync(IPC_INPUT_CLOSE);
  } catch {}

  // Absorb any messages that arrived before we started
  const pending = drainIpcInput();
  if (pending.length > 0) prompt += '\n' + pending.join('\n');

  if (opts.isScheduledTask) {
    prompt = `[SCHEDULED TASK — not directly from the user]\n\n${prompt}`;
  }

  const mcpServerPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'mcp.js',
  );

  let sessionId = opts.sessionId;
  let resumeAt: string | undefined;

  const runQuery = async (
    queryPrompt: string,
  ): Promise<{
    newSessionId?: string;
    lastAssistantUuid?: string;
    closedDuringQuery: boolean;
  }> => {
    const stream = new MessageStream();
    stream.push(queryPrompt);

    let ipcPolling = true;
    let closedDuringQuery = false;

    const pollIpc = () => {
      if (!ipcPolling) return;
      if (shouldClose()) {
        closedDuringQuery = true;
        stream.end();
        ipcPolling = false;
        return;
      }
      for (const text of drainIpcInput()) stream.push(text);
      setTimeout(pollIpc, IPC_POLL_MS);
    };
    setTimeout(pollIpc, IPC_POLL_MS);

    // Reset idle timer whenever a result arrives; close session when it fires
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        ipcPolling = false;
        stream.end();
      }, IDLE_TIMEOUT_MS);
    };
    resetIdle();

    let newSessionId: string | undefined;
    let lastAssistantUuid: string | undefined;

    for await (const message of query({
      prompt: stream,
      options: {
        cwd: WORKSPACE_DIR,
        resume: sessionId,
        resumeSessionAt: resumeAt,
        allowedTools: [
          'Bash',
          'Read', 'Write', 'Edit', 'Glob', 'Grep',
          'WebSearch', 'WebFetch',
          'Task', 'TaskOutput', 'TaskStop',
          'TodoWrite', 'ToolSearch', 'Skill',
          'NotebookEdit',
          'mcp__agent_loop__*',
        ],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: ['project', 'user'],
        mcpServers: {
          agent_loop: {
            command: 'node',
            args: [mcpServerPath],
          },
        },
        hooks: {
          PreCompact: [{ hooks: [createPreCompactHook()] }],
        },
      },
    })) {
      if (message.type === 'assistant' && 'uuid' in message) {
        lastAssistantUuid = (message as { uuid: string }).uuid;
      }
      if (message.type === 'system' && message.subtype === 'init') {
        newSessionId = message.session_id;
        opts.onSessionId(message.session_id);
      }
      if (message.type === 'result') {
        const text =
          'result' in message
            ? (message as { result?: string }).result ?? null
            : null;
        if (text) opts.onOutput(text);
        resetIdle();
      }
    }

    if (idleTimer) clearTimeout(idleTimer);
    ipcPolling = false;
    return { newSessionId, lastAssistantUuid, closedDuringQuery };
  };

  // Query loop: run query → wait for IPC follow-up → repeat
  let currentPrompt = prompt;
  while (true) {
    const result = await runQuery(currentPrompt);
    if (result.newSessionId) sessionId = result.newSessionId;
    if (result.lastAssistantUuid) resumeAt = result.lastAssistantUuid;
    if (result.closedDuringQuery) break;

    if (sessionId) opts.onSessionId(sessionId);

    // Wait for next IPC message or _close
    const next = await new Promise<string | null>((resolve) => {
      const poll = () => {
        if (shouldClose()) {
          resolve(null);
          return;
        }
        const msgs = drainIpcInput();
        if (msgs.length > 0) {
          resolve(msgs.join('\n'));
          return;
        }
        setTimeout(poll, IPC_POLL_MS);
      };
      poll();
    });

    if (next === null) break;
    currentPrompt = next;
  }

  return sessionId;
}

/**
 * Inject a follow-up message into the currently running agent session.
 */
export function injectMessage(text: string): void {
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
  const fp = path.join(
    IPC_INPUT_DIR,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`,
  );
  fs.writeFileSync(fp + '.tmp', JSON.stringify({ type: 'message', text }));
  fs.renameSync(fp + '.tmp', fp);
}

/**
 * Signal the running agent to close its session after the current query.
 */
export function closeSession(): void {
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });
  fs.writeFileSync(IPC_INPUT_CLOSE, '');
}
