import fs from 'node:fs';
import { test, expect } from '../../src/fixtures/test';
import { mockURL } from '../../src/config/env';
import { captureFailureBundle } from '../../src/support/evidence';
import { JobDetailsPage } from '../../src/pages/job-details.page';
import { MissingElementError, NavigationError } from '../../src/support/errors';
import { JobsSearchPage } from '../../src/pages/jobs-search.page';

test.describe('@mock failure handling — missing elements and broken navigation', () => {
  test('a closed job produces a MissingElementError plus screenshot and DOM dump', async ({ sessions, logger }, testInfo) => {
    const session = await sessions.open('userA');
    const search = new JobsSearchPage(session.page, logger);
    await search.open();
    await search.search('Frontend Engineer');

    const details = await search.openJobByTitle('Frontend Engineer');
    expect(await details.isEasyApply()).toBe(false);

    let error: unknown;
    await logger.step('opening Easy Apply on a closed job fails', async () => {
      try {
        await details.openEasyApply();
      } catch (caught) {
        error = caught;
      }
    });

    expect(error).toBeInstanceOf(MissingElementError);
    const missing = error as MissingElementError;
    expect(missing.message).toMatch(/Easy Apply button is not available/);
    expect(missing.details.selectors?.length ?? 0).toBeGreaterThan(1);
    expect(await details.closedNotice()).toMatch(/no longer accepting/i);

    await captureFailureBundle(session.page, testInfo, logger, missing);
    expect(fs.existsSync(testInfo.outputPath('failure/failure.png'))).toBe(true);
    expect(fs.existsSync(testInfo.outputPath('failure/failure.html'))).toBe(true);
    expect(fs.existsSync(testInfo.outputPath('failure/failure.json'))).toBe(true);
  });

  test('HTTP 500 on a job page is reported as a NavigationError', async ({ sessions, logger }) => {
    const session = await sessions.open('userB');
    const details = new JobDetailsPage(session.page, logger);

    let error: unknown;
    try {
      await details.open(mockURL('/jobs/view/1005'));
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(NavigationError);
    expect((error as NavigationError).details.status).toBe(500);
    expect((error as NavigationError).message).toMatch(/HTTP 500/);
  });

  test('redirect to /login while opening a job surfaces as an authentication error', async ({ sessions, logger }) => {
    const session = await sessions.open('userA');
    await session.page.goto('/jobs');
    await expect(session.page).toHaveURL(/\/jobs/);

    // Simulate server-side session invalidation: drop the auth cookie, then reload.
    await session.context.clearCookies();
    await session.page.goto('/jobs/view/1001');
    await expect(session.page).toHaveURL(/\/login/);

    const details = new JobDetailsPage(session.page, logger);
    await expect(details.open(mockURL('/jobs/view/1001'))).rejects.toThrow(/Session expired|not authenticated/i);
  });
});
