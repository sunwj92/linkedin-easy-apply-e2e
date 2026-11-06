import fs from 'node:fs';
import { test, expect } from '../../src/fixtures/test';
import { env } from '../../src/config/env';
import { storageStatePath } from '../../src/fixtures/users';
import { captureScreenshot } from '../../src/support/evidence';
import { JobsSearchPage } from '../../src/pages/jobs-search.page';

/**
 * Opt-in run against the real linkedin.com.
 *
 * Safety rules baked into this spec:
 *  - requires LINKEDIN_LIVE=1 AND a hand-made storage state (npm run auth:save)
 *  - never clicks Next on a prefilled form and never clicks Submit
 *  - skips (instead of failing) when the storage state is missing
 */
test.describe('@live LinkedIn Easy Apply', () => {
  test.skip(!env.live, 'Live mode disabled: set LINKEDIN_LIVE=1 and provide storage states (see README).');

  test('validates the Easy Apply form on linkedin.com without submitting', async ({ sessions, logger }, testInfo) => {
    const statePath = storageStatePath('userA');
    test.skip(!fs.existsSync(statePath), `Missing live storage state ${statePath}; run "npm run auth:save -- --user userA".`);

    const session = await sessions.open('userA');
    const { page } = session;

    const search = new JobsSearchPage(page, logger);
    await search.open(`${env.liveBaseURL}/jobs/`);

    const keyword = process.env.LINKEDIN_SEARCH_TERM ?? 'QA Automation Engineer';
    await search.search(keyword);
    await captureScreenshot(page, testInfo, logger, 'live-search-results');

    await search.filterEasyApply();
    await search.assertOnlyEasyApply();

    const details = await search.openFirstEasyApplyJob();
    await captureScreenshot(page, testInfo, logger, 'live-job-details');

    const modal = await details.openEasyApply();
    const fields = await modal.fields();
    logger.info('live Easy Apply fields', { fields });

    const labels = fields.map((field) => field.label.toLowerCase());
    expect(labels.some((label) => /name/.test(label))).toBe(true);
    expect(labels.some((label) => /email/.test(label))).toBe(true);

    const resumeInputs = await modal.dialog.locator('input[type="file"]').count();
    logger.info('resume inputs on the current step', { count: resumeInputs });

    const next = await modal.nextButton();
    logger.info('footer button state', {
      blocked: await modal.isButtonBlocked(next),
      label: (await next.innerText().catch(() => '')).trim(),
    });

    const step = await modal.stepInfo();
    logger.info('current step', { step });

    expect(await modal.isSubmitted()).toBe(false);
    await captureScreenshot(page, testInfo, logger, 'live-easy-apply-modal');
    // Intentionally no Next/Submit click: the account's saved answers could
    // complete the application in one step.
  });
});
