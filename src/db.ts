import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORE_DIR = path.join(ROOT, 'store');

let db: Database.Database;

export function initDb(): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  db = new Database(path.join(STORE_DIR, 'agent.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      context_mode TEXT NOT NULL DEFAULT 'isolated',
      next_run TEXT,
      last_run TEXT,
      last_result TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      run_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status, timestamp);
    CREATE INDEX IF NOT EXISTS idx_tasks_next_run ON scheduled_tasks(status, next_run);
  `);
}

// --- Messages ---

export interface QueuedMessage {
  id: string;
  content: string;
  timestamp: string;
  status: string;
}

export function enqueueMessage(content: string): string {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO messages (id, content, timestamp, status) VALUES (?, ?, ?, 'pending')`,
  ).run(id, content, new Date().toISOString());
  return id;
}

export function getNextPendingMessage(): QueuedMessage | undefined {
  return db
    .prepare(
      `SELECT * FROM messages WHERE status = 'pending' ORDER BY timestamp LIMIT 1`,
    )
    .get() as QueuedMessage | undefined;
}

export function markMessageDone(id: string): void {
  db.prepare(`UPDATE messages SET status = 'done' WHERE id = ?`).run(id);
}

// --- Session ---

export function getSession(): string | undefined {
  const row = db
    .prepare(`SELECT value FROM kv WHERE key = 'session_id'`)
    .get() as { value: string } | undefined;
  return row?.value;
}

export function setSession(sessionId: string): void {
  db.prepare(
    `INSERT OR REPLACE INTO kv (key, value) VALUES ('session_id', ?)`,
  ).run(sessionId);
}

// --- Tasks ---

export interface Task {
  id: string;
  prompt: string;
  schedule_type: 'cron' | 'interval' | 'once';
  schedule_value: string;
  context_mode: 'group' | 'isolated';
  next_run: string | null;
  last_run: string | null;
  last_result: string | null;
  status: string;
  created_at: string;
}

export function createTask(task: Omit<Task, 'last_run' | 'last_result'>): void {
  db.prepare(
    `INSERT INTO scheduled_tasks (id, prompt, schedule_type, schedule_value, context_mode, next_run, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    task.id,
    task.prompt,
    task.schedule_type,
    task.schedule_value,
    task.context_mode,
    task.next_run,
    task.status,
    task.created_at,
  );
}

export function getTaskById(id: string): Task | undefined {
  return db
    .prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`)
    .get(id) as Task | undefined;
}

export function getAllTasks(): Task[] {
  return db
    .prepare(`SELECT * FROM scheduled_tasks ORDER BY created_at DESC`)
    .all() as Task[];
}

export function getDueTasks(): Task[] {
  const now = new Date().toISOString();
  return db
    .prepare(
      `SELECT * FROM scheduled_tasks
       WHERE status = 'active' AND next_run IS NOT NULL AND next_run <= ?
       ORDER BY next_run`,
    )
    .all(now) as Task[];
}

export function updateTask(
  id: string,
  updates: Partial<
    Pick<Task, 'prompt' | 'schedule_type' | 'schedule_value' | 'next_run' | 'status'>
  >,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      fields.push(`${k} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(
    `UPDATE scheduled_tasks SET ${fields.join(', ')} WHERE id = ?`,
  ).run(...values);
}

export function deleteTask(id: string): void {
  db.prepare(`DELETE FROM task_run_logs WHERE task_id = ?`).run(id);
  db.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`).run(id);
}

export function updateTaskAfterRun(
  id: string,
  nextRun: string | null,
  lastResult: string,
): void {
  db.prepare(
    `UPDATE scheduled_tasks
     SET next_run = ?, last_run = ?, last_result = ?,
         status = CASE WHEN ? IS NULL THEN 'completed' ELSE status END
     WHERE id = ?`,
  ).run(nextRun, new Date().toISOString(), lastResult, nextRun, id);
}

export function logTaskRun(log: {
  task_id: string;
  run_at: string;
  duration_ms: number;
  status: string;
  result: string | null;
  error: string | null;
}): void {
  db.prepare(
    `INSERT INTO task_run_logs (task_id, run_at, duration_ms, status, result, error)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    log.task_id,
    log.run_at,
    log.duration_ms,
    log.status,
    log.result,
    log.error,
  );
}

export function writeTasksSnapshot(): void {
  const tasks = getAllTasks();
  const snapshotPath = path.join(ROOT, 'ipc', 'current_tasks.json');
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      tasks.map((t) => ({
        id: t.id,
        prompt: t.prompt,
        schedule_type: t.schedule_type,
        schedule_value: t.schedule_value,
        status: t.status,
        next_run: t.next_run,
      })),
      null,
      2,
    ),
  );
}
