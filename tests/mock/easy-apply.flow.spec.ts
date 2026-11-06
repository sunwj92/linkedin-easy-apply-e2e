import { test, expect } from '../../src/fixtures/test';
import { captureScreenshot } from '../../src/support/evidence';
import { executableFile, oversizedPdf, pdfResume } from '../../src/support/files';
import { JobsSearchPage } from '../../src/pages/jobs-search.page';

test.describe('@mock Easy Apply — search, form, upload and review', () => {
  test('gates every required step and stops before submitting', async ({ sessions, logger }, testInfo) => {
    const session = await sessions.open('userA');
    const { page } = session;

    const postedApplications: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/applications')) {
        postedApplications.push(request.url());
      }
    });

    const search = await logger.step('open job search with a persisted session', async () => {
      const instance = new JobsSearchPage(page, logger);
      await instance.open();
      return instance;
    });

    await logger.step('search for "QA Automation Engineer"', async () => {
      await search.search('QA Automation Engineer');
      const jobs = await search.listJobs();
      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.some((job) => job.easyApply)).toBe(true);
    });
    await captureScreenshot(page, testInfo, logger, 'search-results');

    await logger.step('filter the result list to Easy Apply only', async () => {
      await search.filterEasyApply();
      await search.assertOnlyEasyApply();
    });
    await captureScreenshot(page, testInfo, logger, 'easy-apply-filter');

    const details = await logger.step('open the first Easy Apply job', async () => {
      const result = await search.openFirstEasyApplyJob();
      expect(await result.title()).toContain('Senior QA Automation Engineer');
      expect(await result.isEasyApply()).toBe(true);
      return result;
    });

    const modal = await logger.step('open the Easy Apply form', async () => details.openEasyApply());

    await logger.step('read the form schema and assert required fields', async () => {
      const fields = await modal.fields();
      logger.info('form fields discovered', { fields });
      expect(fields.map((field) => field.label)).toEqual(
        expect.arrayContaining(['First name', 'Last name', 'Email address']),
      );
      expect(fields.find((field) => field.label === 'First name')?.required).toBe(true);
      expect(fields.find((field) => field.label === 'Email address')?.required).toBe(true);

      const step = await modal.stepInfo();
      expect(step?.current).toBe(1);
      expect(step?.total).toBe(3);
    });
    await captureScreenshot(page, testInfo, logger, 'form-step-1');

    await logger.step('clicking Next with empty required fields is rejected', async () => {
      await modal.clickNext();
      await expect.poll(async () => (await modal.stepInfo())?.current).toBe(1);

      const errors = await modal.visibleErrors();
      expect(errors.length).toBeGreaterThanOrEqual(3);
      expect(await modal.fieldError('First name')).toBeTruthy();
      expect(await modal.fieldError('Email address')).toBeTruthy();
      logger.info('validation errors shown', { errors });
    });
    await captureScreenshot(page, testInfo, logger, 'required-field-errors');

    await logger.step('fill contact details and advance to the resume step', async () => {
      await modal.fillContactInfo({
        'First name': 'Alice',
        'Last name': 'Chen',
        'Email address': 'alice.qa@example.com',
        'Mobile phone number': '+86 138 0000 0000',
      });
      await expect.poll(async () => modal.fieldError('First name')).toBeNull();
      await modal.clickNext();
      await expect.poll(async () => (await modal.stepInfo())?.current).toBe(2);
    });

    const fileInput = await modal.fileInput();
    await expect(fileInput).toHaveAttribute('accept', /\.pdf/);

    await logger.step('resume step starts with a blocked Next button', async () => {
      await modal.expectNextBlocked();
      const button = await modal.nextButton();
      expect(await button.isDisabled()).toBe(true);
    });
    await captureScreenshot(page, testInfo, logger, 'resume-step-blocked');

    await logger.step('reject an unsupported file type', async () => {
      await modal.uploadResume(executableFile());
      expect(await modal.isResumeAttached()).toBe(false);
      expect((await modal.visibleErrors()).join(' ')).toMatch(/file type|supported/i);
      await modal.expectNextBlocked();
    });
    await captureScreenshot(page, testInfo, logger, 'resume-invalid-type');

    await logger.step('reject a resume above the size limit', async () => {
      await modal.uploadResume(oversizedPdf());
      expect(await modal.isResumeAttached()).toBe(false);
      expect((await modal.visibleErrors()).join(' ')).toMatch(/2 MB/);
      await modal.expectNextBlocked();
    });

    await logger.step('accept a valid PDF and enable Next', async () => {
      await modal.uploadResume(pdfResume());
      expect(await modal.isResumeAttached()).toBe(true);
      await expect(modal.dialog.locator('[data-test-resume-filename]')).toContainText('alice-chen-resume.pdf');
      await modal.expectNextEnabled();
    });
    await captureScreenshot(page, testInfo, logger, 'resume-valid');

    await logger.step('advance to the review step', async () => {
      await modal.clickNext();
      await expect.poll(async () => (await modal.stepInfo())?.current).toBe(3);
    });

    await logger.step('review step exposes an enabled Submit button and nothing was sent', async () => {
      const submit = await modal.submitButton();
      await expect(submit).toBeVisible();
      await expect(submit).toBeEnabled();
      await expect(modal.dialog.locator('[data-test-review]')).toContainText('alice.qa@example.com');
      expect(await modal.isSubmitted()).toBe(false);
      expect(postedApplications).toHaveLength(0);
    });
    await captureScreenshot(page, testInfo, logger, 'review-step-without-submit');
  });
});
