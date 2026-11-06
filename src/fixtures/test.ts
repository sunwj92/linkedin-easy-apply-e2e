import { test as base } from '@playwright/test';
import { captureFailureBundle } from '../support/evidence';
import { TestLogger } from '../support/logger';
import { SessionManager, pickContextOptions } from '../support/session-manager';

export interface TestFixtures {
  /** Structured per-test logger; attached to the report at the end of the test. */
  logger: TestLogger;
  /** Session factory: one isolated BrowserContext per user. */
  sessions: SessionManager;
}

export const test = base.extend<TestFixtures>({
  logger: async ({}, use, testInfo) => {
    const logger = new TestLogger(testInfo, `${testInfo.project.name}-${testInfo.testId.slice(0, 8)}`);
    await use(logger);
    await logger.publish();
  },

  sessions: async ({ browser, logger }, use, testInfo) => {
    const manager = new SessionManager(
      browser,
      pickContextOptions(testInfo.project.use as unknown as Record<string, unknown>),
      logger,
      testInfo.workerIndex,
    );
    await use(manager);
    await manager.closeAll();
  },
});

/**
 * Failure hook: every live page gets a screenshot + DOM dump + JSON breadcrumb.
 * Uses the static session registry so it also works when the failure happened
 * before the `sessions` fixture was requested.
 */
test.afterEach(async ({ logger }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  for (const session of SessionManager.activeSessions(testInfo.workerIndex)) {
    await captureFailureBundle(session.page, testInfo, logger, testInfo.error ?? new Error('unknown failure'));
  }
});

export { expect } from '@playwright/test';
