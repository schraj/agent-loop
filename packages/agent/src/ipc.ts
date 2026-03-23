/**
 * IPC file watcher. Polls ipc/messages/ and ipc/tasks/ and processes them.
 * Messages → printed to stdout. Tasks → saved to SQLite.
 */
import { CronExpressionParser } from 'cron-parser';
import fs from 'fs';
import path from 'path';

import {
  createTask,
  deleteTask,
  getTaskById,
  updateTask,
  writeTasksSnapshot,
} from './db.js';

import { ROOT } from './paths.js';

const IPC_DIR = path.join(ROOT, 'ipc');
const MESSAGES_DIR = path.join(IPC_DIR, 'messages');
const TASKS_DIR = path.join(IPC_DIR, 'tasks');
const POLL_MS = 500;
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface IpcDeps {
  onMessage: (text: string) => void;
  onTasksChanged: () => void;
  getSessionId: () => string | undefined;
}

export function startIpcWatcher(deps: IpcDeps): void {
  fs.mkdirSync(MESSAGES_DIR, { recursive: true });
  fs.mkdirSync(TASKS_DIR, { recursive: true });

  const poll = async () => {
    // --- Messages (send_message from MCP) ---
    try {
      for (const file of fs
        .readdirSync(MESSAGES_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()) {
        const fp = path.join(MESSAGES_DIR, file);
        try {
          const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          fs.unlinkSync(fp);
          if (data.type === 'message' && data.text) {
            deps.onMessage(data.text);
          }
        } catch {
          try {
            fs.unlinkSync(fp);
          } catch {}
        }
      }
    } catch {}

    // --- Tasks (schedule/pause/cancel etc from MCP) ---
    try {
      for (const file of fs
        .readdirSync(TASKS_DIR)
        .filter((f) => f.endsWith('.json'))
        .sort()) {
        const fp = path.join(TASKS_DIR, file);
        try {
          const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          fs.unlinkSync(fp);
          await processTaskIpc(data, deps);
        } catch {
          try {
            fs.unlinkSync(fp);
          } catch {}
        }
      }
    } catch {}

    setTimeout(poll, POLL_MS);
  };

  poll();
}

async function processTaskIpc(data: Record<string, unknown>, deps: IpcDeps) {
  switch (data.type) {
    case 'schedule_task': {
      const scheduleType = data.schedule_type as 'cron' | 'interval' | 'once';
      const scheduleValue = data.schedule_value as string;
      let nextRun: string | null = null;

      if (scheduleType === 'cron') {
        try {
          nextRun = CronExpressionParser.parse(scheduleValue, {
            tz: TIMEZONE,
          })
            .next()
            .toISOString();
        } catch {
          console.error(`[ipc] Invalid cron: ${scheduleValue}`);
          break;
        }
      } else if (scheduleType === 'interval') {
        const ms = parseInt(scheduleValue, 10);
        if (isNaN(ms) || ms <= 0) {
          console.error(`[ipc] Invalid interval: ${scheduleValue}`);
          break;
        }
        nextRun = new Date(Date.now() + ms).toISOString();
      } else if (scheduleType === 'once') {
        const d = new Date(scheduleValue);
        if (isNaN(d.getTime())) {
          console.error(`[ipc] Invalid timestamp: ${scheduleValue}`);
          break;
        }
        nextRun = d.toISOString();
      }

      const taskId =
        (data.taskId as string) ||
        `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const contextMode =
        data.context_mode === 'group' ? 'group' : 'isolated';

      createTask({
        id: taskId,
        prompt: data.prompt as string,
        schedule_type: scheduleType,
        schedule_value: scheduleValue,
        context_mode: contextMode,
        next_run: nextRun,
        status: 'active',
        created_at: new Date().toISOString(),
      });

      console.log(`[scheduler] Task created: ${taskId}`);
      writeTasksSnapshot();
      deps.onTasksChanged();
      break;
    }

    case 'pause_task': {
      const task = getTaskById(data.taskId as string);
      if (task) {
        updateTask(task.id, { status: 'paused' });
        writeTasksSnapshot();
        deps.onTasksChanged();
      }
      break;
    }

    case 'resume_task': {
      const task = getTaskById(data.taskId as string);
      if (task) {
        updateTask(task.id, { status: 'active' });
        writeTasksSnapshot();
        deps.onTasksChanged();
      }
      break;
    }

    case 'cancel_task': {
      const task = getTaskById(data.taskId as string);
      if (task) {
        deleteTask(task.id);
        writeTasksSnapshot();
        deps.onTasksChanged();
      }
      break;
    }

    case 'update_task': {
      const task = getTaskById(data.taskId as string);
      if (!task) break;
      const updates: Parameters<typeof updateTask>[1] = {};
      if (data.prompt !== undefined) updates.prompt = data.prompt as string;
      if (data.schedule_type !== undefined)
        updates.schedule_type = data.schedule_type as
          | 'cron'
          | 'interval'
          | 'once';
      if (data.schedule_value !== undefined)
        updates.schedule_value = data.schedule_value as string;

      // Recompute next_run if schedule changed
      const merged = { ...task, ...updates };
      if (data.schedule_type || data.schedule_value) {
        if (merged.schedule_type === 'cron') {
          try {
            updates.next_run = CronExpressionParser.parse(
              merged.schedule_value,
              { tz: TIMEZONE },
            )
              .next()
              .toISOString();
          } catch {}
        } else if (merged.schedule_type === 'interval') {
          const ms = parseInt(merged.schedule_value, 10);
          if (!isNaN(ms) && ms > 0) {
            updates.next_run = new Date(Date.now() + ms).toISOString();
          }
        }
      }

      updateTask(task.id, updates);
      writeTasksSnapshot();
      deps.onTasksChanged();
      break;
    }
  }
}
