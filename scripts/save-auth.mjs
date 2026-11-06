#!/usr/bin/env node
/**
 * Creates a storage state for a real LinkedIn account via a headed browser.
 *
 *   npm run auth:save -- --user userA [--browser chrome|msedge] [--url https://www.linkedin.com/login]
 *
 * A human signs in (including any 2FA/checkpoint), presses Enter in the
 * terminal, and the cookies/localStorage are written to .auth/live-<user>.json.
 * This is the recommended workaround for LinkedIn checkpoints and for keeping
 * credentials out of the repository and CI logs.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const user = flag('user', 'userA');
const browserName = flag('browser', 'chrome');
const url = flag('url', 'https://www.linkedin.com/login');
const authDir = path.resolve(process.env.AUTH_DIR ?? '.auth');
const statePath = path.join(authDir, `live-${user}.json`);

if (!process.stdin.isTTY) {
  console.error('This script needs an interactive terminal (it waits for Enter).');
  process.exit(1);
}

const browser = await chromium.launch({
  headless: false,
  channel: browserName === 'msedge' ? 'msedge' : 'chrome',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const page = await context.newPage();

console.log(`\n1. Sign in to LinkedIn in the browser window that just opened.`);
console.log(`2. Complete any 2FA / checkpoint challenge.`);
console.log(`3. Wait until you can see your feed, then press Enter here.\n`);
await page.goto(url, { waitUntil: 'domcontentloaded' });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await new Promise((resolve) => rl.question('Press Enter once signed in… ', resolve));
rl.close();

await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' }).catch(() => undefined);

const cookies = await context.cookies('https://www.linkedin.com');
const hasSession = cookies.some((cookie) => cookie.name === 'li_at');
if (!hasSession) {
  console.error('\nNo li_at cookie found — the sign-in did not complete. Nothing was saved.');
  await browser.close();
  process.exit(1);
}

fs.mkdirSync(authDir, { recursive: true });
await context.storageState({ path: statePath });
console.log(`\nSaved ${statePath} (${cookies.length} cookies).`);
console.log(`Run: npm run test:live\n`);

await browser.close();
