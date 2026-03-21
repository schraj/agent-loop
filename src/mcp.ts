/**
 * MCP server for agent-loop (runs as a subprocess spawned by the SDK).
 * Provides send_message and task management tools.
 * Communicates with the host via files in ipc/.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CronExpressionParser } from 'cron-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IPC_MESSAGES_DIR = path.join(ROOT, 'ipc', 'messages');
const IPC_TASKS_DIR = path.join(ROOT, 'ipc', 'tasks');
const TASKS_SNAPSHOT = path.join(ROOT, 'ipc', 'current_tasks.json');

function writeIpc(dir: string, data: object): void {
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(
    dir,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`,
  );
  fs.writeFileSync(fp + '.tmp', JSON.stringify(data, null, 2));
  fs.renameSync(fp + '.tmp', fp);
}

const server = new McpServer({ name: 'agent_loop', version: '1.0.0' });

server.tool(
  'send_message',
  "Send a message to the user immediately while you're still working. Useful for progress updates.",
  { text: z.string().describe('The message text to send') },
  async (args) => {
    writeIpc(IPC_MESSAGES_DIR, { type: 'message', text: args.text });
    return { content: [{ type: 'text' as const, text: 'Message sent.' }] };
  },
);

server.tool(
  'schedule_task',
  `Schedule a recurring or one-time task.

CONTEXT MODE:
• "group": runs with current conversation history
• "isolated": fresh session — include all context in the prompt

SCHEDULE VALUE FORMAT (local timezone):
• cron: "0 9 * * *" (daily 9am), "*/5 * * * *" (every 5 min)
• interval: milliseconds, e.g. "3600000" for 1 hour
• once: local timestamp, e.g. "2026-02-01T15:30:00" (no Z suffix)`,
  {
    prompt: z.string().describe('What the agent should do when the task runs'),
    schedule_type: z
      .enum(['cron', 'interval', 'once'])
      .describe('Schedule type'),
    schedule_value: z.string().describe('Schedule value (see format above)'),
    context_mode: z
      .enum(['group', 'isolated'])
      .default('isolated')
      .describe('Whether to run with conversation history'),
  },
  async (args) => {
    if (args.schedule_type === 'cron') {
      try {
        CronExpressionParser.parse(args.schedule_value);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid cron: "${args.schedule_value}".`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'interval') {
      const ms = parseInt(args.schedule_value, 10);
      if (isNaN(ms) || ms <= 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid interval: "${args.schedule_value}". Must be positive ms.`,
            },
          ],
          isError: true,
        };
      }
    } else if (args.schedule_type === 'once') {
      if (
        /[Zz]$/.test(args.schedule_value) ||
        /[+-]\d{2}:\d{2}$/.test(args.schedule_value)
      ) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Use local time without timezone suffix, e.g. "2026-02-01T15:30:00".`,
            },
          ],
          isError: true,
        };
      }
    }

    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeIpc(IPC_TASKS_DIR, {
      type: 'schedule_task',
      taskId,
      prompt: args.prompt,
      schedule_type: args.schedule_type,
      schedule_value: args.schedule_value,
      context_mode: args.context_mode ?? 'isolated',
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${taskId} scheduled (${args.schedule_type}: ${args.schedule_value}).`,
        },
      ],
    };
  },
);

server.tool('list_tasks', 'List all scheduled tasks.', {}, async () => {
  try {
    if (!fs.existsSync(TASKS_SNAPSHOT)) {
      return {
        content: [{ type: 'text' as const, text: 'No scheduled tasks.' }],
      };
    }
    const tasks = JSON.parse(fs.readFileSync(TASKS_SNAPSHOT, 'utf-8'));
    if (tasks.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No scheduled tasks.' }],
      };
    }
    const lines = tasks.map(
      (t: {
        id: string;
        prompt: string;
        schedule_type: string;
        schedule_value: string;
        status: string;
        next_run: string | null;
      }) =>
        `• [${t.id}] ${t.prompt.slice(0, 60)}… (${t.schedule_type}: ${t.schedule_value}) — ${t.status}, next: ${t.next_run ?? 'N/A'}`,
    );
    return {
      content: [
        {
          type: 'text' as const,
          text: `Scheduled tasks:\n${lines.join('\n')}`,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
});

server.tool(
  'pause_task',
  'Pause a scheduled task.',
  { task_id: z.string() },
  async (args) => {
    writeIpc(IPC_TASKS_DIR, { type: 'pause_task', taskId: args.task_id });
    return {
      content: [
        { type: 'text' as const, text: `Task ${args.task_id} pause requested.` },
      ],
    };
  },
);

server.tool(
  'resume_task',
  'Resume a paused task.',
  { task_id: z.string() },
  async (args) => {
    writeIpc(IPC_TASKS_DIR, { type: 'resume_task', taskId: args.task_id });
    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} resume requested.`,
        },
      ],
    };
  },
);

server.tool(
  'cancel_task',
  'Cancel and delete a scheduled task.',
  { task_id: z.string() },
  async (args) => {
    writeIpc(IPC_TASKS_DIR, { type: 'cancel_task', taskId: args.task_id });
    return {
      content: [
        {
          type: 'text' as const,
          text: `Task ${args.task_id} cancelled.`,
        },
      ],
    };
  },
);

server.tool(
  'update_task',
  'Update an existing scheduled task.',
  {
    task_id: z.string(),
    prompt: z.string().optional(),
    schedule_type: z.enum(['cron', 'interval', 'once']).optional(),
    schedule_value: z.string().optional(),
  },
  async (args) => {
    writeIpc(IPC_TASKS_DIR, { type: 'update_task', ...args, taskId: args.task_id });
    return {
      content: [
        { type: 'text' as const, text: `Task ${args.task_id} updated.` },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
