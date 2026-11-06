/**
 * Error taxonomy for the suite.
 *
 * Every failure carries a `details` bag that ends up in the JSON log line and
 * in the screenshot/DOM dump written by the fixtures, so a red CI run can be
 * triaged without re-running the test.
 */

export interface ErrorDetails {
  url?: string;
  title?: string;
  selectors?: string[];
  status?: number;
  step?: string;
  [key: string]: unknown;
}

export class LinkedInAutomationError extends Error {
  readonly details: ErrorDetails;

  constructor(message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      ...this.details,
    };
  }
}

/** An element that the flow requires is absent (A/B variant, stale job, UI change). */
export class MissingElementError extends LinkedInAutomationError {
  constructor(description: string, selectors: readonly string[], details: ErrorDetails = {}) {
    super(
      `Missing element: ${description}. Tried ${selectors.length} selector(s): ${selectors.join(' | ')}`,
      { ...details, selectors: [...selectors] },
    );
  }
}

/** Navigation returned an error status or never reached the expected URL. */
export class NavigationError extends LinkedInAutomationError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, details);
  }
}

/** A UI invariant was violated (button enabled when it should be blocked, error missing, ...). */
export class ValidationError extends LinkedInAutomationError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, details);
  }
}

/** No usable storage state and automated login is not allowed. */
export class SessionUnavailableError extends LinkedInAutomationError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, details);
  }
}

/** Storage state exists but its authentication cookie has expired. */
export class SessionExpiredError extends SessionUnavailableError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, details);
    this.name = 'SessionExpiredError';
  }
}

export function isNavigationError(error: unknown): error is NavigationError {
  return error instanceof NavigationError;
}
