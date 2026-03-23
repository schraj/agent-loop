/**
 * Gmail helper script for agent-loop.
 *
 * Usage:
 *   tsx src/gmail-helper.ts auth          — One-time OAuth flow
 *   tsx src/gmail-helper.ts check [n]     — List n recent unread emails (default 10)
 *   tsx src/gmail-helper.ts read <id>     — Read full email by ID
 *   tsx src/gmail-helper.ts draft <id> <body> — Create a draft reply to email <id>
 *   tsx src/gmail-helper.ts drafts        — List recent drafts
 *
 * Credentials and tokens are stored in workspace/gmail/ (gitignored).
 */
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { createServer } from 'http';

import { ROOT } from './paths.js';
const GMAIL_DIR = path.join(ROOT, 'workspace', 'gmail');
const CREDENTIALS_PATH = path.join(GMAIL_DIR, 'credentials.json');
const TOKEN_PATH = path.join(GMAIL_DIR, 'token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

// ── Auth helpers ──

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(
      `Missing ${CREDENTIALS_PATH} — download it from Google Cloud Console.\n` +
      'See: https://console.cloud.google.com/apis/credentials',
    );
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  // Handle both "installed" and "web" credential types
  return raw.installed || raw.web;
}

async function getAuthClient() {
  const creds = loadCredentials();
  const oauth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    'http://localhost:3891/oauth2callback',
  );

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2.setCredentials(token);

    // Auto-refresh if expired
    oauth2.on('tokens', (newTokens) => {
      const merged = { ...token, ...newTokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
    });

    return oauth2;
  }

  throw new Error('Not authenticated. Run: tsx src/gmail-helper.ts auth');
}

async function runAuthFlow() {
  fs.mkdirSync(GMAIL_DIR, { recursive: true });
  const creds = loadCredentials();
  const oauth2 = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    'http://localhost:3891/oauth2callback',
  );

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('Open this URL in your browser to authorize:\n');
  console.log(authUrl);
  console.log('\nWaiting for callback on http://localhost:3891 ...');

  return new Promise<void>((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url!, 'http://localhost:3891');
      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400);
        res.end('Missing code parameter');
        return;
      }

      try {
        const { tokens } = await oauth2.getToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorized! You can close this tab.</h1>');
        console.log('\nToken saved to', TOKEN_PATH);
      } catch (err) {
        res.writeHead(500);
        res.end('Token exchange failed: ' + String(err));
        console.error('Token exchange failed:', err);
      }

      server.close();
      resolve();
    });

    server.listen(3891);
  });
}

// ── Gmail operations ──

function decodeBody(payload: any): string {
  // Try to find text/plain part first, then text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    // Recurse into nested parts
    for (const part of payload.parts) {
      if (part.parts) {
        const result = decodeBody(part);
        if (result) return result;
      }
    }
  }

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  return '';
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

async function checkEmails(count: number) {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread category:primary',
    maxResults: count,
  });

  const messages = res.data.messages || [];
  if (messages.length === 0) {
    console.log('No unread emails.');
    return;
  }

  console.log(`Found ${messages.length} unread email(s):\n`);

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const headers = detail.data.payload?.headers || [];
    const from = getHeader(headers, 'From');
    const subject = getHeader(headers, 'Subject');
    const date = getHeader(headers, 'Date');
    const snippet = detail.data.snippet || '';

    console.log(`ID: ${msg.id}`);
    console.log(`From: ${from}`);
    console.log(`Subject: ${subject}`);
    console.log(`Date: ${date}`);
    console.log(`Snippet: ${snippet}`);
    console.log('---');
  }
}

async function readEmail(messageId: string) {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = res.data.payload?.headers || [];
  const from = getHeader(headers, 'From');
  const to = getHeader(headers, 'To');
  const subject = getHeader(headers, 'Subject');
  const date = getHeader(headers, 'Date');
  const body = decodeBody(res.data.payload);

  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Date: ${date}`);
  console.log(`\n--- Body ---\n`);
  console.log(body.slice(0, 5000)); // Truncate very long emails
}

async function createDraftReply(messageId: string, replyBody: string) {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  // Get the original message for reply headers
  const original = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'metadata',
    metadataHeaders: ['From', 'Subject', 'Message-ID', 'References', 'In-Reply-To'],
  });

  const headers = original.data.payload?.headers || [];
  const from = getHeader(headers, 'From');
  const subject = getHeader(headers, 'Subject');
  const messageIdHeader = getHeader(headers, 'Message-ID');
  const existingRefs = getHeader(headers, 'References');

  const reSubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  const references = existingRefs
    ? `${existingRefs} ${messageIdHeader}`
    : messageIdHeader;

  // Build RFC 2822 message
  const rawMessage = [
    `To: ${from}`,
    `Subject: ${reSubject}`,
    `In-Reply-To: ${messageIdHeader}`,
    `References: ${references}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    replyBody,
  ].join('\n');

  const encoded = Buffer.from(rawMessage)
    .toString('base64url');

  const draft = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: {
        raw: encoded,
        threadId: original.data.threadId!,
      },
    },
  });

  console.log(`Draft created: ${draft.data.id}`);
  console.log(`Thread: ${original.data.threadId}`);
  console.log(`Reply to: ${from}`);
  console.log(`Subject: ${reSubject}`);
}

async function listDrafts() {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.drafts.list({
    userId: 'me',
    maxResults: 10,
  });

  const drafts = res.data.drafts || [];
  if (drafts.length === 0) {
    console.log('No drafts.');
    return;
  }

  for (const draft of drafts) {
    const detail = await gmail.users.drafts.get({
      userId: 'me',
      id: draft.id!,
      format: 'metadata',
    });
    const headers = detail.data.message?.payload?.headers || [];
    const to = getHeader(headers, 'To');
    const subject = getHeader(headers, 'Subject');
    console.log(`Draft ${draft.id} — To: ${to} — Subject: ${subject}`);
  }
}

// ── CLI ──

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'auth':
    await runAuthFlow();
    break;
  case 'check':
    await checkEmails(parseInt(args[0] || '10', 10));
    break;
  case 'read':
    if (!args[0]) { console.error('Usage: read <messageId>'); process.exit(1); }
    await readEmail(args[0]);
    break;
  case 'draft':
    if (!args[0] || !args[1]) { console.error('Usage: draft <messageId> <body>'); process.exit(1); }
    await createDraftReply(args[0], args.slice(1).join(' '));
    break;
  case 'drafts':
    await listDrafts();
    break;
  default:
    console.log(`Gmail helper for agent-loop

Commands:
  auth          — Run OAuth flow (one-time setup)
  check [n]     — List n recent unread emails (default 10)
  read <id>     — Read full email by ID
  draft <id> <body> — Create a draft reply
  drafts        — List recent drafts`);
}
