import type { Locator, Page } from '@playwright/test';
import { MissingElementError } from './errors';

/**
 * Polls an ordered list of selectors and returns the first visible match.
 *
 * LinkedIn ships several DOM variants (A/B tests, locale, new vs legacy job
 * search) so every important element has a fallback chain instead of one
 * brittle CSS path. When all of them miss we throw MissingElementError with the
 * full chain, which is what shows up in the failure bundle.
 */
export async function firstVisible(
  page: Page | Locator,
  selectors: readonly string[],
  description: string,
  timeoutMs = 10_000,
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const selector of selectors) {
      const locator = (page as Page).locator
        ? (page as Page).locator(selector).first()
        : (page as Locator).locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const details: Record<string, unknown> = {};
  if ('url' in page) {
    details.url = (page as Page).url();
    details.title = await (page as Page).title().catch(() => '');
  }
  throw new MissingElementError(description, selectors, details);
}

/** Returns the first locator that exists in the DOM, even if it is visually hidden. */
export async function firstAttached(
  scope: Page | Locator,
  selectors: readonly string[],
  description: string,
  timeoutMs = 10_000,
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const selector of selectors) {
      const locator = (scope as Page).locator(selector).first();
      if ((await locator.count()) > 0) return locator;
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new MissingElementError(description, selectors);
}

/** True when at least one selector currently resolves to a visible element. */
export async function anyVisible(scope: Page | Locator, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    if (await scope.locator(selector).first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return false;
}
