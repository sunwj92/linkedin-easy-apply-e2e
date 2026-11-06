import { expect, type Locator, type Page } from '@playwright/test';
import { MissingElementError, ValidationError } from '../support/errors';
import { firstAttached, firstVisible } from '../support/locators';
import type { TestLogger } from '../support/logger';
import { SELECTORS } from './selectors';

export interface FormField {
  label: string;
  type: string;
  required: boolean;
  accept?: string;
  name?: string;
}

export interface StepInfo {
  current: number;
  total: number;
  text: string;
}

export interface ResumeUpload {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const join = (selectors: readonly string[]): string => selectors.join(', ');
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The multi-step Easy Apply dialog.
 *
 * Encapsulates the three things the task calls out:
 *  - required-field metadata and enforcement (errors shown, step does not advance)
 *  - file upload behaviour (accept filter, attachment state, error feedback)
 *  - button state (native disabled / aria-disabled / artdeco disabled class)
 */
export class EasyApplyModal {
  readonly dialog: Locator;

  constructor(
    private readonly page: Page,
    private readonly log: TestLogger,
  ) {
    this.dialog = page
      .locator('.jobs-easy-apply-modal, div[role="dialog"]:has(.fb-dash-form-element)')
      .last();
  }

  async waitForOpen(timeoutMs = 20_000): Promise<this> {
    try {
      await this.dialog.waitFor({ state: 'visible', timeout: timeoutMs });
    } catch {
      throw new MissingElementError('Easy Apply modal did not open', [...SELECTORS.modal.root], {
        url: this.page.url(),
      });
    }
    await firstVisible(this.dialog, SELECTORS.modal.header, 'Easy Apply modal header', 10_000);
    this.log.info('Easy Apply modal opened', { header: await this.headerText() });
    return this;
  }

  async headerText(): Promise<string> {
    return (await this.dialog.locator(join(SELECTORS.modal.header)).first().innerText().catch(() => '')).trim();
  }

  async stepInfo(): Promise<StepInfo | null> {
    const element = this.dialog.locator(join(SELECTORS.modal.stepLabel)).first();
    if ((await element.count()) === 0) return null;
    const text = (await element.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const match = /Step\s+(\d+)\s+of\s+(\d+)/i.exec(text);
    if (!match) return null;
    return { current: Number(match[1]), total: Number(match[2]), text };
  }

  async waitForStep(expected: number, timeoutMs = 15_000): Promise<StepInfo> {
    await expect
      .poll(async () => (await this.stepInfo())?.current ?? -1, { timeout: timeoutMs })
      .toBe(expected);
    const info = await this.stepInfo();
    if (!info) throw new ValidationError(`Step label disappeared while waiting for step ${expected}`);
    this.log.info('modal step reached', { step: info.current, total: info.total, label: info.text });
    return info;
  }

  /** All form fields of the current step, extracted from the DOM once. */
  async fields(): Promise<FormField[]> {
    const groups = this.dialog.locator('.fb-dash-form-element, [data-test-form-element]');
    return groups.evaluateAll((nodes) =>
      nodes.map((node) => {
        const labelEl = node.querySelector('label');
        const control = node.querySelector('input, select, textarea') as
          | HTMLInputElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          | null;
        const rawLabel = (labelEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const required =
          Boolean((control as HTMLInputElement | null)?.required) ||
          control?.getAttribute('aria-required') === 'true' ||
          rawLabel.includes('*');
        const type = control
          ? control instanceof HTMLInputElement
            ? control.type || 'text'
            : control.tagName.toLowerCase()
          : 'unknown';

        return {
          label: rawLabel.replace(/[\s*]+$/, '').trim(),
          type,
          required,
          accept: control?.getAttribute('accept') ?? undefined,
          name: control?.getAttribute('name') ?? control?.id ?? undefined,
        };
      }),
    );
  }

  async requiredFields(): Promise<FormField[]> {
    return (await this.fields()).filter((field) => field.required);
  }

  async requiredLabels(): Promise<string[]> {
    return (await this.requiredFields()).map((field) => field.label);
  }

  fieldGroup(label: string): Locator {
    const pattern = new RegExp(escapeRegExp(label), 'i');
    return this.dialog
      .locator('.fb-dash-form-element, [data-test-form-element]')
      .filter({ has: this.page.locator('label', { hasText: pattern }) })
      .first();
  }

  async fillField(label: string, value: string): Promise<void> {
    const group = this.fieldGroup(label);
    if ((await group.count()) === 0) {
      throw new MissingElementError(`Form field "${label}" not found`, ['.fb-dash-form-element label']);
    }
    const control = group.locator('input:not([type="file"]), select, textarea').first();
    const tag = await control.evaluate((element) => element.tagName.toLowerCase()).catch(() => '');
    if (tag === 'select') {
      await control.selectOption(value);
    } else {
      await control.fill(value);
    }
    // Blur so client-side validation (if any) runs before the next assertion.
    await control.press('Tab').catch(() => undefined);
    this.log.info('filled field', { label, value: value.length > 40 ? `${value.slice(0, 20)}…` : value });
  }

  async fillContactInfo(values: Record<string, string>): Promise<void> {
    for (const [label, value] of Object.entries(values)) {
      await this.fillField(label, value);
    }
  }

  fileInput(): Promise<Locator> {
    return firstAttached(this.dialog, [...SELECTORS.modal.fileInput], 'resume file input');
  }

  async uploadResume(file: string | ResumeUpload): Promise<void> {
    const input = await this.fileInput();
    await input.setInputFiles(file);
    await this.page.waitForTimeout(120); // allow the upload handler / validation to settle
    this.log.info('resume upload attempted', {
      name: typeof file === 'string' ? file : file.name,
      attached: await this.isResumeAttached(),
    });
  }

  async clearResume(): Promise<void> {
    const input = await this.fileInput();
    await input.setInputFiles([]);
    await this.page.waitForTimeout(80);
  }

  async isResumeAttached(): Promise<boolean> {
    const input = await this.fileInput();
    const fileCount = await input.evaluate((element) => (element as HTMLInputElement).files?.length ?? 0);
    if (fileCount > 0) return true;
    const filename = this.dialog.locator('[data-test-resume-filename]').first();
    return (await filename.innerText().catch(() => '')).trim().length > 0;
  }

  async resumeFilename(): Promise<string> {
    const filename = this.dialog.locator('[data-test-resume-filename]').first();
    return (await filename.innerText().catch(() => '')).trim();
  }

  nextButton(): Promise<Locator> {
    return firstVisible(
      this.dialog,
      [
        'button[data-easy-apply-next-button]',
        'footer button.artdeco-button--primary:not([data-easy-apply-submit-button])',
        '.artdeco-modal__actionbar button.artdeco-button--primary:not([data-easy-apply-submit-button])',
        'button[aria-label="Continue to next step"]',
        'button[aria-label="Review your application"]',
      ],
      'Easy Apply footer primary button',
      10_000,
    );
  }

  submitButton(): Promise<Locator> {
    return firstVisible(this.dialog, [...SELECTORS.modal.submitButton], 'Submit application button', 10_000);
  }

  async isButtonBlocked(button: Locator): Promise<boolean> {
    if (await button.isDisabled().catch(() => false)) return true;
    if ((await button.getAttribute('aria-disabled')) === 'true') return true;
    const className = (await button.getAttribute('class')) ?? '';
    return /artdeco-button--disabled|jobs-apply-button--disabled/.test(className);
  }

  async isNextBlocked(): Promise<boolean> {
    return this.isButtonBlocked(await this.nextButton());
  }

  async expectNextBlocked(): Promise<void> {
    const button = await this.nextButton();
    if (!(await this.isButtonBlocked(button))) {
      throw new ValidationError('Expected the footer button to be disabled/blocked, but it is enabled', {
        label: (await button.innerText().catch(() => '')).trim(),
      });
    }
  }

  async expectNextEnabled(): Promise<void> {
    const button = await this.nextButton();
    if (await this.isButtonBlocked(button)) {
      throw new ValidationError('Expected the footer button to be enabled, but it is disabled', {
        label: (await button.innerText().catch(() => '')).trim(),
      });
    }
  }

  async clickNext(): Promise<void> {
    const button = await this.nextButton();
    if (await this.isButtonBlocked(button)) {
      throw new ValidationError('Refusing to click a blocked "Next" button', {
        label: (await button.innerText().catch(() => '')).trim(),
      });
    }
    this.log.info('clicking Next', { label: (await button.innerText().catch(() => '')).trim() });
    await button.click();
    await this.page.waitForTimeout(150);
  }

  /** Visible inline validation errors of the current step. */
  async visibleErrors(): Promise<string[]> {
    const errors = this.dialog.locator(
      '.artdeco-inline-feedback--error:visible, .fb-dash-form-element__error:visible, [role="alert"]:visible',
    );
    const texts = await errors.allInnerTexts().catch(() => []);
    return texts.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  async fieldError(label: string): Promise<string | null> {
    const group = this.fieldGroup(label);
    if ((await group.count()) === 0) return null;
    const error = group.locator('.artdeco-inline-feedback--error, [role="alert"]').first();
    if (!(await error.isVisible().catch(() => false))) return null;
    return (await error.innerText().catch(() => '')).replace(/\s+/g, ' ').trim() || null;
  }

  async dismiss(): Promise<void> {
    const close = this.dialog.locator(join(SELECTORS.modal.dismiss)).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await this.dialog.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  }

  /** True when the application has actually been submitted (must stay false in our tests). */
  async isSubmitted(): Promise<boolean> {
    return this.page
      .locator('[data-test-application-sent], .jobs-post-apply, :has-text("Application sent")')
      .first()
      .isVisible()
      .catch(() => false);
  }
}
