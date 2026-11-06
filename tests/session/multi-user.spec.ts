import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '../../src/fixtures/test';
import { storageStatePath } from '../../src/fixtures/users';
import { SessionExpiredError, SessionUnavailableError } from '../../src/support/errors';

const tempFiles: string[] = [];

test.afterAll(() => {
  for (const file of tempFiles) fs.rmSync(file, { force: true });
});

function tempStateFile(label: string): string {
  const file = path.join(os.tmpdir(), `linkedin-e2e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  tempFiles.push(file);
  return file;
}

test.describe('@mock multi-user sessions', () => {
  test('two users browse concurrently in isolated contexts', async ({ sessions, logger }) => {
    const alice = await sessions.open('userA');
    const bob = await sessions.open('userB');
    expect(alice.context).not.toBe(bob.context);

    await alice.page.goto('/feed');
    await bob.page.goto('/feed');

    await expect(alice.page.locator('[data-test-signed-in-user]').first()).toContainText('Alice Chen');
    await expect(bob.page.locator('[data-test-signed-in-user]').first()).toContainText('Bob Liu');

    const aliceCookie = (await alice.context.cookies()).find((cookie) => cookie.name === 'li_at')?.value;
    const bobCookie = (await bob.context.cookies()).find((cookie) => cookie.name === 'li_at')?.value;
    expect(aliceCookie).toBeTruthy();
    expect(bobCookie).toBeTruthy();
    expect(aliceCookie).not.toBe(bobCookie);

    await Promise.all([alice.page.goto('/jobs'), bob.page.goto('/jobs')]);
    await expect(alice.page.locator('.jobs-search-results__list-item').first()).toBeVisible();
    await expect(bob.page.locator('.jobs-search-results__list-item').first()).toBeVisible();

    logger.info('two concurrent sessions verified', {
      alice: alice.user.displayName,
      bob: bob.user.displayName,
    });
  });

  test('reuses the persisted storage state without hitting the login form', async ({ sessions, logger }) => {
    const session = await sessions.open('userA');
    expect(session.reusedState).toBe(true);

    const loginRequests: string[] = [];
    session.page.on('request', (request) => {
      if (request.url().includes('/login') && request.method() === 'POST') loginRequests.push(request.url());
    });

    await session.page.goto('/jobs');
    await expect(session.page).toHaveURL(/\/jobs/);
    await expect(session.page.locator('[data-test-signed-in-user]').first()).toContainText('Alice Chen');
    expect(loginRequests).toHaveLength(0);
    logger.info('session reused with zero login requests');
  });

  test('an expired li_at cookie fails fast with an actionable SessionExpiredError', async ({ sessions }) => {
    const source = JSON.parse(fs.readFileSync(storageStatePath('userA'), 'utf8')) as {
      cookies: { name: string; expires: number }[];
      origins: unknown[];
    };
    for (const cookie of source.cookies) {
      if (cookie.name === 'li_at') cookie.expires = Math.floor(Date.now() / 1000) - 3600;
    }
    const expiredPath = tempStateFile('expired');
    fs.writeFileSync(expiredPath, JSON.stringify(source));

    let error: unknown;
    try {
      await sessions.open('userA', { statePath: expiredPath });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SessionExpiredError);
    expect((error as SessionExpiredError).message).toMatch(/expired/i);
    expect((error as SessionExpiredError).message).toMatch(/npm run auth/);
  });

  test('falls back to a fresh UI login and persists it when no state exists', async ({ sessions, logger }) => {
    const freshPath = tempStateFile('fresh');

    await expect(sessions.open('userA', { statePath: freshPath })).rejects.toBeInstanceOf(SessionUnavailableError);

    const session = await sessions.loginFresh('userA', freshPath, true);
    await session.page.goto('/feed');
    await expect(session.page.locator('[data-test-signed-in-user]').first()).toContainText('Alice Chen');

    expect(fs.existsSync(freshPath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(freshPath, 'utf8')) as { cookies: { name: string }[] };
    expect(saved.cookies.some((cookie) => cookie.name === 'li_at')).toBe(true);
    logger.info('fallback login persisted a new storage state', { path: freshPath });
  });
});
