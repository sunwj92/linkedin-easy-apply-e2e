import fs from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { env } from '../src/config/env';
import { ALL_USERS, getUser, storageStatePath } from '../src/fixtures/users';
import { LoginPage } from '../src/pages/login.page';
import { TestLogger } from '../src/support/logger';
import { SessionManager } from '../src/support/session-manager';

/**
 * Prepares one storage state per user.
 *
 * - Mock mode: performs a real UI login against the fixture and saves cookies.
 * - Live mode: validates that `npm run auth:save` produced a state file; it
 *   deliberately does NOT automate linkedin.com login (checkpoint/2FA needs a
 *   human, and unattended logins are the quickest way to get an account flagged).
 */
for (const key of ALL_USERS) {
  setup(`prepare session for ${key}`, async ({ browser }, testInfo) => {
    const logger = new TestLogger(testInfo, `setup-${key}`);
    const statePath = storageStatePath(key);

    if (env.live) {
      if (!fs.existsSync(statePath)) {
        logger.warn(`live storage state missing at ${statePath}`);
        setup.skip(
          true,
          `No storage state for ${key}. Run: npm run auth:save -- --user ${key} --url https://www.linkedin.com/login`,
        );
        return;
      }
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8')) as { cookies?: { name: string }[] };
      const cookie = state.cookies?.find((entry) => entry.name === 'li_at');
      if (!cookie) {
        throw new Error(`${statePath} has no li_at cookie; regenerate it with "npm run auth:save -- --user ${key}"`);
      }
      logger.info('live storage state verified', { path: statePath });
      await expect(fs.statSync(statePath).size).toBeGreaterThan(0);
      await logger.publish();
      return;
    }

    const user = getUser(key);
    const context = await browser.newContext({ baseURL: env.mockBaseURL });
    const page = await context.newPage();
    const login = new LoginPage(page, logger);

    await login.open();
    await login.login({ email: user.email, password: user.password });
    await expect(page.locator('[data-test-signed-in-user]').first()).toContainText(user.displayName);

    const manager = new SessionManager(browser, { baseURL: env.mockBaseURL }, logger, testInfo.workerIndex);
    await manager.persist(context, statePath);
    await context.close();

    logger.info('mock storage state saved', { user: key, path: statePath });
    await logger.publish();
  });
}
