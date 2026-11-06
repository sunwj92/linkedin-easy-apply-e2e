/**
 * Selector chains shared by the page objects.
 *
 * Order = preference. The first entries are the stable hooks we rely on
 * (`data-*`, aria labels, semantic roles); the rest are current LinkedIn class
 * names. Keeping them here means a UI change is a one-line fix and the failure
 * log always shows exactly what was attempted.
 */
export const SELECTORS = {
  login: {
    email: ['input#username', 'input[name="session_key"]', 'input[autocomplete="username"]'],
    password: ['input#password', 'input[name="session_password"]', 'input[type="password"]'],
    submit: ['button[type="submit"]', 'button:has-text("Sign in")', 'button:has-text("登录")'],
    error: ['.form__label--error', '[role="alert"]', '#error-for-username'],
  },

  session: {
    // Present in the authenticated global nav on linkedin.com and in the mock fixture.
    signedIn: [
      '[data-test-signed-in-user]',
      'img.global-nav__me-photo',
      'button.global-nav__primary-link-me-menu-trigger',
      'button[aria-label*="Me"]',
      'a[href*="/in/"] img.global-nav__me-photo',
    ],
  },

  search: {
    input: [
      'input.jobs-search-box__keyboard-text-input',
      'input[aria-label="Search by title, skill, or company"]',
      'input[placeholder="Search by title, skill, or company"]',
      'input[name="keywords"]',
    ],
    submit: [
      'button.jobs-search-box__submit-button',
      'button[aria-label="Search"]',
      'button[type="submit"]:has-text("Search")',
    ],
    filterCheckbox: ['input#f_AL', 'input[type="checkbox"][id*="f_AL"]'],
    filterToggle: ['button[aria-label*="Easy Apply"]', 'button:has-text("Easy Apply")'],
    results: [
      'li.jobs-search-results__list-item',
      'li[data-occludable-job-id]',
      'li.scaffold-layout__list-item',
    ],
    cardLink: ['a.job-card-container__link', 'a.job-card-list__title--link', 'a[href*="/jobs/view/"]'],
    cardTitle: ['strong', '.job-card-list__title', '.job-card-container__link span'],
    cardCompany: ['.artdeco-entity-lockup__subtitle', '.job-card-container__primary-description'],
    cardEasyApply: ['li.job-card-container__apply-method', '.job-card-container__apply-method'],
    easyApplyText: 'Easy Apply',
  },

  job: {
    title: [
      'h1.job-details-jobs-unified-top-card__job-title',
      '.job-details-jobs-unified-top-card__job-title h1',
      'h1.t-24',
      'h1',
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '[data-test-company-name]',
    ],
    applyButton: [
      'button.jobs-apply-button',
      'button[aria-label^="Easy Apply"]',
      'button[aria-label*="Easy Apply"]',
      'button:has-text("Easy Apply")',
    ],
    closedNotice: [
      '.jobs-apply-button--disabled',
      '[data-test-job-closed]',
      ':has-text("No longer accepting applications")',
    ],
  },

  modal: {
    root: [
      'div[role="dialog"].jobs-easy-apply-modal',
      'div[role="dialog"][data-easy-apply-modal]',
      'div[role="dialog"]:has(button[data-easy-apply-next-button])',
      'div[role="dialog"]',
    ],
    header: ['.artdeco-modal__header h2', '#jobs-easy-apply-modal-header', 'h2'],
    stepLabel: ['.jobs-easy-apply-content .t-14', '[data-test-step-label]', '.artdeco-completeness-meter-linear__progress-element'],
    progressbar: ['[role="progressbar"]'],
    fieldGroup: ['.fb-dash-form-element', '[data-test-form-element]', '.jobs-easy-apply-form-section__grouping'],
    fileInput: ['input[type="file"]'],
    error: [
      '.artdeco-inline-feedback--error',
      '[role="alert"]',
      '.fb-dash-form-element__error',
    ],
    footer: ['.artdeco-modal__actionbar', 'footer', '[data-test-modal-footer]'],
    nextButton: [
      'button[data-easy-apply-next-button]',
      'footer button.artdeco-button--primary',
      '.artdeco-modal__actionbar button.artdeco-button--primary',
      'button[aria-label="Continue to next step"]',
      'button[aria-label="Review your application"]',
      'button:has-text("Review")',
      'button:has-text("Next")',
    ],
    submitButton: [
      'button[data-easy-apply-submit-button]',
      'button[aria-label="Submit application"]',
      'button:has-text("Submit application")',
    ],
    dismiss: ['.artdeco-modal__dismiss', 'button[aria-label="Dismiss"]'],
  },

  mock: {
    signedInUser: '[data-test-signed-in-user]',
    applicationSent: '[data-test-application-sent]',
    resumeFilename: '[data-test-resume-filename]',
  },
} as const;
