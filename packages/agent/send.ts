/**
 * CLI helper to add a message to the agent queue.
 * The main process (npm run dev) picks it up and processes it.
 *
 * Usage:
 *   npx tsx send.ts "your message here"
 *   npm run send -- "your message here"
 */
import { enqueueMessage, initDb } from './src/db.js';

const message = process.argv.slice(2).join(' ').trim();

if (!message) {
  console.error('Usage: tsx send.ts "your message here"');
  process.exit(1);
}

initDb();
const id = enqueueMessage(message);
console.log(`Queued message ${id}: ${message}`);
