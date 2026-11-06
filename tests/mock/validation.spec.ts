import { test, expect } from '../../src/fixtures/test';
import { captureScreenshot } from '../../src/support/evidence';
import { pdfResume } from '../../src/support/files';
import { JobsSearchPage } from '../../src/pages/jobs-search.page';

test.describe('@mock Easy Apply — validation rules and button state', () => {
  test('rejects missing and malformed required answers without advancing', async ({ sessions, logger }, testInfo) => {
    const session = await sessions.open('userB');
    const search = new JobsSearchPage(session.page, logger);
    await search.open();
    await search.search('SDET II');

    const details = await search.openJobByTitle('SDET II');
    const modal = await details.openEasyApply();

    await logger.step('form schema reflects the job (single email field, two steps)', async () => {
      expect((await modal.fields()).map((field) => field.label)).toEqual(['Email address']);
      expect(await modal.requiredLabels()).toEqual(['Email address']);
      const step = await modal.stepInfo();
      expect(step?.current).toBe(1);
      expect(step?.total).toBe(2);
    });

    await logger.step('empty submission shows a required-field error and stays on step 1', async () => {
      await modal.clickNext();
      expect(await modal.fieldError('Email address')).toMatch(/valid answer/i);
      expect((await modal.stepInfo())?.current).toBe(1);
      expect(await modal.isNextBlocked()).toBe(false); // button is clickable, validation blocks the transition
    });
    await captureScreenshot(session.page, testInfo, logger, 'email-required-error');

    await logger.step('malformed email is rejected', async () => {
      await modal.fillField('Email address', 'not-an-email');
      await modal.clickNext();
      expect(await modal.fieldError('Email address')).toMatch(/valid email/i);
      expect((await modal.stepInfo())?.current).toBe(1);
    });

    await logger.step('valid email advances to review', async () => {
      await modal.fillField('Email address', 'bob.qa@example.com');
      await modal.clickNext();
      await expect.poll(async () => (await modal.stepInfo())?.current).toBe(2);
      await expect(await modal.submitButton()).toBeVisible();
      expect(await modal.isSubmitted()).toBe(false);
    });
  });

  test('clearing the uploaded resume blocks the Next button again', async ({ sessions, logger }, testInfo) => {
    const session = await sessions.open('userA');
    const search = new JobsSearchPage(session.page, logger);
    await search.open();
    await search.search('QA Automation Engineer');

    const details = await search.openJobByTitle('Senior QA Automation Engineer');
    const modal = await details.openEasyApply();

    await modal.fillContactInfo({
      'First name': 'Alice',
      'Last name': 'Chen',
      'Email address': 'alice.qa@example.com',
    });
    await modal.clickNext();
    await expect.poll(async () => (await modal.stepInfo())?.current).toBe(2);

    await modal.uploadResume(pdfResume());
    await modal.expectNextEnabled();

    await logger.step('removing the resume re-disables the footer button', async () => {
      await modal.clearResume();
      expect(await modal.isResumeAttached()).toBe(false);
      await modal.expectNextBlocked();
      expect(await (await modal.nextButton()).isDisabled()).toBe(true);
    });
    await captureScreenshot(session.page, testInfo, logger, 'next-disabled-after-clear');
  });
});
