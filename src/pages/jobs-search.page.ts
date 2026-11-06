import { expect, type Locator, type Page } from '@playwright/test';
import { env } from '../config/env';
import { NavigationError, ValidationError } from '../support/errors';
import { firstVisible } from '../support/locators';
import type { TestLogger } from '../support/logger';
import { JobDetailsPage } from './job-details.page';
import { SELECTORS } from './selectors';

export interface JobSummary {
  title: string;
  company: string;
  easyApply: boolean;
  location?: string;
}

const join = (selectors: readonly string[]): string => selectors.join(', ');

/**
 * Job search results page (linkedin.com/jobs and the DOM-compatible fixture).
 */
export class JobsSearchPage {
  constructor(
    private readonly page: Page,
    private readonly log: TestLogger,
  ) {}

  defaultUrl(): string {
    return env.live ? `${env.liveBaseURL}/jobs/` : '/jobs/';
  }

  async open(url = this.defaultUrl()): Promise<this> {
    this.log.info('opening job search', { url });
    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    if (response && response.status() >= 400) {
      throw new NavigationError(`Job search page returned HTTP ${response.status()}`, {
        url,
        status: response.status(),
      });
    }
    if (/\/login/i.test(this.page.url())) {
      throw new NavigationError('Session is not authenticated: redirected to /login', { url: this.page.url() });
    }
    // 'load' (not just DOMContentLoaded) guarantees inline handlers are attached,
    // which matters for the Easy Apply filter checkbox.
    await this.page.waitForLoadState('load').catch(() => undefined);
    await this.waitForResults();
    return this;
  }

  async search(keyword: string): Promise<this> {
    this.log.info('searching jobs', { keyword });
    const input = await firstVisible(this.page, SELECTORS.search.input, 'job search input');
    await input.fill(keyword);

    await Promise.all([
      this.page
        .waitForURL(/[?&](q|keywords)=/, { timeout: 15_000 })
        .catch(() => this.log.warn('search URL did not expose the query parameter; continuing with rendered results')),
      input.press('Enter'),
    ]);
    await this.page.waitForLoadState('load').catch(() => undefined);

    await this.waitForResults();
    return this;
  }

  async waitForResults(timeoutMs = 30_000): Promise<void> {
    await firstVisible(this.page, SELECTORS.search.results, 'job search result cards', timeoutMs);
    const count = await this.cards().count();
    if (count === 0) {
      throw new NavigationError('Job search returned zero result cards', { url: this.page.url() });
    }
    this.log.info('results rendered', { count, url: this.page.url() });
  }

  cards(): Locator {
    return this.page.locator(join(SELECTORS.search.results));
  }

  async listJobs(): Promise<JobSummary[]> {
    const cards = this.cards();
    const count = await cards.count();
    const jobs: JobSummary[] = [];

    for (let index = 0; index < count; index += 1) {
      const card = cards.nth(index);
      const title = await card
        .locator(join(SELECTORS.search.cardTitle))
        .first()
        .innerText()
        .catch(() => '');
      const company = await card
        .locator(join(SELECTORS.search.cardCompany))
        .first()
        .innerText()
        .catch(() => '');
      const badgeText = await card
        .locator(join(SELECTORS.search.cardEasyApply))
        .first()
        .innerText()
        .catch(() => '');
      const text = await card.innerText().catch(() => '');
      const easyApply = new RegExp(SELECTORS.search.easyApplyText, 'i').test(badgeText || text);

      jobs.push({
        title: title.replace(/\s+/g, ' ').trim() || '(untitled)',
        company: company.replace(/\s+/g, ' ').trim(),
        easyApply,
      });
    }

    this.log.info('job cards parsed', { count: jobs.length, easyApply: jobs.filter((job) => job.easyApply).length });
    return jobs;
  }

  /** Toggles the "Easy Apply" filter (checkbox on the fixture, pill button variant on live). */
  async filterEasyApply(): Promise<this> {
    const checkbox = this.page.locator(join(SELECTORS.search.filterCheckbox)).first();
    const hasCheckbox = (await checkbox.count()) > 0 && (await checkbox.isVisible().catch(() => false));

    if (hasCheckbox) {
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
        this.log.info('checked Easy Apply filter checkbox');
      }
    } else {
      const toggle = await firstVisible(this.page, SELECTORS.search.filterToggle, 'Easy Apply filter toggle');
      await toggle.click();
      this.log.info('clicked Easy Apply filter toggle');
    }

    await this.page
      .waitForURL(/f_AL=(1|true)/, { timeout: 10_000 })
      .catch(() => this.log.warn('filter did not change the URL; validating by rendered badges instead'));
    await this.page.waitForLoadState('load').catch(() => undefined);

    // The URL commits before the new list is painted; wait until every rendered
    // card carries the Easy Apply badge instead of trusting the first paint.
    await expect
      .poll(
        async () => {
          const jobs = await this.listJobs();
          return jobs.length > 0 && jobs.every((job) => job.easyApply);
        },
        { timeout: 15_000, message: 'filtered list should contain only Easy Apply jobs' },
      )
      .toBe(true)
      .catch(() => this.log.warn('filtered list still contains non-Easy-Apply jobs; assertOnlyEasyApply will report them'));

    await this.waitForResults(15_000);
    return this;
  }

  async assertOnlyEasyApply(): Promise<void> {
    const jobs = await this.listJobs();
    const withoutEasyApply = jobs.filter((job) => !job.easyApply).map((job) => job.title);
    if (withoutEasyApply.length > 0) {
      throw new ValidationError('Easy Apply filter did not remove non-Easy-Apply jobs', {
        withoutEasyApply,
        url: this.page.url(),
      });
    }
  }

  async openJobByTitle(title: string): Promise<JobDetailsPage> {
    this.log.info('opening job', { title });
    const card = this.cards().filter({ hasText: title }).first();
    const link = card.locator(join(SELECTORS.search.cardLink)).first();

    if ((await link.count()) === 0) {
      throw new ValidationError(`No job card matched "${title}"`, {
        available: (await this.listJobs()).map((job) => job.title),
      });
    }

    await Promise.all([
      this.page.waitForURL(/\/jobs\/view\//, { timeout: 20_000 }).catch(() => undefined),
      link.click(),
    ]);
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);

    const details = new JobDetailsPage(this.page, this.log);
    await details.waitForLoaded();
    return details;
  }

  async openFirstEasyApplyJob(): Promise<JobDetailsPage> {
    const jobs = await this.listJobs();
    const target = jobs.find((job) => job.easyApply);
    if (!target) {
      throw new ValidationError('No Easy Apply job found in the current result set', {
        available: jobs.map((job) => `${job.title} (easyApply=${job.easyApply})`),
      });
    }
    return this.openJobByTitle(target.title);
  }
}
