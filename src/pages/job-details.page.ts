import type { Locator, Page } from '@playwright/test';
import { MissingElementError, NavigationError } from '../support/errors';
import { firstVisible } from '../support/locators';
import type { TestLogger } from '../support/logger';
import { EasyApplyModal } from './easy-apply.modal';
import { SELECTORS } from './selectors';

const join = (selectors: readonly string[]): string => selectors.join(', ');

/** Single job posting page, with the apply button that opens the Easy Apply modal. */
export class JobDetailsPage {
  constructor(
    private readonly page: Page,
    private readonly log: TestLogger,
  ) {}

  async open(url: string): Promise<this> {
    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    if (!response) {
      throw new NavigationError(`Navigation to ${url} returned no response`, { url });
    }
    if (response.status() >= 400) {
      throw new NavigationError(`Job page returned HTTP ${response.status()}`, { url, status: response.status() });
    }
    await this.waitForLoaded();
    return this;
  }

  async waitForLoaded(): Promise<this> {
    if (/\/login/i.test(this.page.url())) {
      throw new NavigationError('Session expired: redirected to /login while opening the job page', {
        url: this.page.url(),
      });
    }
    await firstVisible(this.page, SELECTORS.job.title, 'job title', 20_000);
    this.log.info('job detail loaded', { title: await this.title(), url: this.page.url() });
    return this;
  }

  async title(): Promise<string> {
    const heading = this.page.locator(join(SELECTORS.job.title)).first();
    return (await heading.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  }

  async company(): Promise<string> {
    const element = this.page.locator(join(SELECTORS.job.company)).first();
    if ((await element.count()) === 0) return '';
    return (await element.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  }

  applyButton(): Locator {
    return this.page.locator(join(SELECTORS.job.applyButton)).first();
  }

  async isEasyApply(): Promise<boolean> {
    const button = this.applyButton();
    if (!(await button.isVisible().catch(() => false))) return false;
    const label = `${(await button.getAttribute('aria-label')) ?? ''} ${await button.innerText().catch(() => '')}`;
    return /easy apply/i.test(label);
  }

  async closedNotice(): Promise<string> {
    for (const selector of SELECTORS.job.closedNotice) {
      const notice = this.page.locator(selector).first();
      if (await notice.isVisible().catch(() => false)) {
        return (await notice.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      }
    }
    return '';
  }

  async openEasyApply(): Promise<EasyApplyModal> {
    if (!(await this.isEasyApply())) {
      const notice = await this.closedNotice();
      throw new MissingElementError(
        `Easy Apply button is not available for "${await this.title()}"${notice ? ` (page says: ${notice})` : ''}`,
        [...SELECTORS.job.applyButton],
        { url: this.page.url(), notice },
      );
    }

    const button = this.applyButton();
    this.log.info('clicking Easy Apply', { title: await this.title() });
    await button.click();

    const modal = new EasyApplyModal(this.page, this.log);
    await modal.waitForOpen();
    return modal;
  }
}
