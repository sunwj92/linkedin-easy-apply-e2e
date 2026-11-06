import { test, expect } from '../../src/fixtures/test';
import { captureScreenshot } from '../../src/support/evidence';
import { JobsSearchPage } from '../../src/pages/jobs-search.page';

test.describe('@mock mobile emulation', () => {
  test('applies the device profile and still opens the Easy Apply form', async ({ sessions, logger }, testInfo) => {
    test.skip(
      !/iphone13|galaxy-s9/.test(testInfo.project.name),
      'Runs only in the iPhone 13 / Galaxy S9 emulation projects',
    );

    const session = await sessions.open('userA');
    const { page } = session;

    const viewport = page.viewportSize();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const touch = await page.evaluate(() => navigator.maxTouchPoints > 0 || 'ontouchstart' in window);

    expect(viewport).toEqual(testInfo.project.use.viewport);
    expect(userAgent).toBe(testInfo.project.use.userAgent);
    expect(touch).toBe(true);
    logger.info('device profile verified', { project: testInfo.project.name, viewport, touch });

    const search = new JobsSearchPage(page, logger);
    await search.open();
    await search.search('QA Automation Engineer');
    const details = await search.openFirstEasyApplyJob();
    const modal = await details.openEasyApply();

    await expect(modal.dialog).toBeVisible();
    const box = await modal.dialog.boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);

    await captureScreenshot(page, testInfo, logger, 'mobile-easy-apply-form');
  });
});
