/**
 * Task scheduler. Polls SQLite every 60s for due tasks and runs them.
 */
import { CronExpressionParser } from 'cron-parser';

import { getDueTasks, getTaskById, logTaskRun, updateTask, updateTaskAfterRun, Task } from './db.js';
import { runAgent } from './agent.js';

const POLL_MS = 60_000;
const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function computeNextRun(task: Task): string | null {
  if (task.schedule_type === 'once') return null;

  if (task.schedule_type === 'cron') {
    return CronExpressionParser.parse(task.schedule_value, { tz: TIMEZONE })
      .next()
      .toISOString();
  }

  if (task.schedule_type === 'interval') {
    const ms = parseInt(task.schedule_value, 10);
    if (!ms || ms <= 0) return new Date(Date.now() + 60_000).toISOString();
    // Anchor to scheduled time to avoid drift; fall back to now if next_run is missing
    const anchor = task.next_run ? new Date(task.next_run).getTime() : Date.now();
    if (isNaN(anchor)) return new Date(Date.now() + ms).toISOString();
    let next = anchor + ms;
    while (next <= Date.now()) next += ms;
    return new Date(next).toISOString();
  }

  return null;
}

export interface SchedulerDeps {
  getSessionId: () => string | undefined;
  onSessionId: (id: string) => void;
  onOutput: (text: string) => void;
}

async function runTask(task: Task, deps: SchedulerDeps): Promise<void> {
  const startTime = Date.now();
  console.log(`\n[scheduler] Running task ${task.id}: ${task.prompt.slice(0, 60)}`);

  const sessionId =
    task.context_mode === 'group' ? deps.getSessionId() : undefined;

  let result: string | null = null as string | null;
  let error: string | null = null;

  try {
    const finalSessionId = await runAgent(task.prompt, {
      sessionId,
      isScheduledTask: true,
      onOutput: (text) => {
        result = text;
        deps.onOutput(text);
      },
      onSessionId: (id) => {
        if (task.context_mode === 'group') deps.onSessionId(id);
      },
    });

    if (finalSessionId && task.context_mode === 'group') {
      deps.onSessionId(finalSessionId);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] Task ${task.id} agent error:`, error);
  }

  try {
    const durationMs = Date.now() - startTime;
    logTaskRun({
      task_id: task.id,
      run_at: new Date().toISOString(),
      duration_ms: durationMs,
      status: error ? 'error' : 'success',
      result,
      error,
    });

    const nextRun = computeNextRun(task);
    updateTaskAfterRun(
      task.id,
      nextRun,
      error ? `Error: ${error}` : (result ? result.slice(0, 200) : 'Completed'),
    );

    console.log(
      `[scheduler] Task ${task.id} done (${durationMs}ms), next: ${nextRun ?? 'none'}`,
    );
  } catch (bookkeepingErr) {
    console.error(`[scheduler] Task ${task.id} bookkeeping error:`, bookkeepingErr);
    // Still try to schedule the next run so the task doesn't get stuck
    try {
      const nextRun = computeNextRun(task);
      updateTaskAfterRun(task.id, nextRun, `Bookkeeping error: ${bookkeepingErr}`);
    } catch {
      console.error(`[scheduler] Task ${task.id} failed to update next_run — task may be stuck`);
    }
  }
}

let running = false;
// Track which tasks are currently executing to avoid double-running
const activeTasks = new Set<string>();

export function startScheduler(deps: SchedulerDeps): void {
  if (running) return;
  running = true;

  const loop = async () => {
    try {
      const due = getDueTasks();
      for (const task of due) {
        if (activeTasks.has(task.id)) continue;
        const current = getTaskById(task.id);
        if (!current || current.status !== 'active') continue;

        activeTasks.add(task.id);
        // Run concurrently — each task is independent
        runTask(current, deps)
          .catch((err) => console.error(`[scheduler] Unhandled error in task ${task.id}:`, err))
          .finally(() => activeTasks.delete(task.id));
      }
    } catch (err) {
      console.error('[scheduler] Loop error:', err);
    }
    setTimeout(loop, POLL_MS);
  };

  loop();
}
