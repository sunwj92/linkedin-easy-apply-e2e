import { expect, type Page } from '@playwright/test';
import { env } from '../config/env';
import { NavigationError } from '../support/errors';
import { firstVisible } from '../support/locators';
import type { TestLogger } from '../support/logger';
import { SELECTORS } from './selectors';

export interface Credentials {
  email: string;
  password: string;
}

/**
 * LinkedIn sign-in page.
 *
 * Used by the auth setup project, by the `per-test-login` fallback strategy and
 * by `scripts/save-auth.mjs` guidance. In live mode the account may be sent to
 * a checkpoint/challenge page instead of the feed — that is surfaced as a
 * NavigationError so the operator knows a human step is required.
 */
export class LoginPage {
  constructor(
    private readonly page: Page,
    private readonly log: TestLogger,
  ) {}

  async open(): Promise<void> {
    const url = env.live ? `${env.liveBaseURL}/login` : '/login';
    this.log.info('opening login page', { url });
    const response = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    if (response && response.status() >= 400) {
      throw new NavigationError(`Login page returned HTTP ${response.status()}`, { url, status: response.status() });
    }
  }

  async login({ email, password }: Credentials): Promise<void> {
    if (!email || !password) {
      throw new NavigationError('Login credentials are missing (email/password).');
    }
    this.log.info('submitting credentials', { email, mode: env.live ? 'live' : 'mock' });

    const emailInput = await firstVisible(this.page, SELECTORS.login.email, 'login email field');
    await emailInput.fill(email);

    const passwordInput = await firstVisible(this.page, SELECTORS.login.password, 'login password field');
    await passwordInput.fill(password);

    const submit = await firstVisible(this.page, SELECTORS.login.submit, 'login submit button');
    await submit.click();

    await this.waitForAuthenticated();
  }

  /**
   * Waits until the app left /login. Handles the mock (instant redirect) and
   * live LinkedIn (feed, or a checkpoint page that needs a human).
   */
  async waitForAuthenticated(timeoutMs = 45_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const url = this.page.url();
      if (/checkpoint|challenge|captcha/i.test(url)) {
        throw new NavigationError(
          `Login requires human verification at ${url}. Run "npm run auth:save -- --user userA" to sign in manually and persist the storage state.`,
          { url },
        );
      }
      if (!/\/login/i.test(url)) {
        // Either the feed is rendered, or at least the login form is gone.
        const signedIn = await this.page
          .locator(SELECTORS.session.signedIn.join(','))
          .first()
          .isVisible()
          .catch(() => false);
        if (signedIn || /\/(feed|jobs|mynetwork)/i.test(url)) {
          this.log.info('login succeeded', { url });
          return;
        }
      }

      const errorText = await this.page
        .locator(SELECTORS.login.error.join(','))
        .first()
        .innerText()
        .catch(() => '');
      if (errorText.trim()) {
        throw new NavigationError(`Login rejected: ${errorText.trim()}`, { url });
      }

      if (Date.now() >= deadline) {
        throw new NavigationError(`Login did not complete within ${timeoutMs} ms`, { url });
      }
      await this.page.waitForTimeout(250);
    }
  }

  /** True when the current page shows an authenticated session. */
  async isAuthenticated(): Promise<boolean> {
    if (/\/login/i.test(this.page.url())) return false;
    return this.page
      .locator(SELECTORS.session.signedIn.join(','))
      .first()
      .isVisible()
      .catch(() => false);
  }

  async assertLoggedOut(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
