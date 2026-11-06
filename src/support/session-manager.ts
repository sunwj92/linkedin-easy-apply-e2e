import fs from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, BrowserContextOptions, Page } from '@playwright/test';
import { env } from '../config/env';
import { LoginPage } from '../pages/login.page';
import { SessionExpiredError, SessionUnavailableError } from '../support/errors';
import type { TestLogger } from '../support/logger';
import { getUser, storageStatePath, type TestUser, type UserKey } from '../fixtures/users';

export interface Session {
  key: UserKey;
  user: TestUser;
  context: BrowserContext;
  page: Page;
  /** true when the session was created from a persisted storage state */
  reusedState: boolean;
}

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  [key: string]: unknown;
}

interface StorageStateFile {
  cookies: StoredCookie[];
  origins: unknown[];
}

/** BrowserContextOptions keys we forward from the Playwright project (`use`). */
const CONTEXT_KEYS = [
  'baseURL',
  'viewport',
  'userAgent',
  'deviceScaleFactor',
  'isMobile',
  'hasTouch',
  'locale',
  'timezoneId',
  'colorScheme',
  'geolocation',
  'permissions',
  'extraHTTPHeaders',
  'httpCredentials',
  'ignoreHTTPSErrors',
  'javaScriptEnabled',
  'bypassCSP',
] as const;

export function pickContextOptions(source: Record<string, unknown>): BrowserContextOptions {
  const options: Record<string, unknown> = {};
  for (const key of CONTEXT_KEYS) {
    if (source[key] !== undefined) options[key] = source[key];
  }
  return options as BrowserContextOptions;
}

/**
 * Owns user sessions for a test.
 *
 * Responsibilities:
 *  - load/validate a per-user storage state (cookies + localStorage)
 *  - create isolated BrowserContexts (two users never share cookies)
 *  - refresh the state via UI login when allowed, with a file lock so parallel
 *    workers cannot corrupt the same JSON
 *  - expose the fallback "log in for this test only" strategy
 *  - register every live page so the failure hook can screenshot it
 */
export class SessionManager {
  private static readonly active = new Map<number, Set<Session>>();

  private readonly sessions: Session[] = [];

  constructor(
    private readonly browser: Browser,
    private readonly contextOptions: BrowserContextOptions,
    private readonly log: TestLogger,
    private readonly workerIndex = 0,
  ) {}

  static activeSessions(workerIndex: number): Session[] {
    return [...(SessionManager.active.get(workerIndex) ?? [])];
  }

  /** Open a session for the user, reusing its persisted storage state. */
  async open(key: UserKey, options: { statePath?: string } = {}): Promise<Session> {
    const user = getUser(key);
    const statePath = options.statePath ?? storageStatePath(key);

    if (env.sessionStrategy === 'per-test-login') {
      this.log.warn(`SESSION_STRATEGY=per-test-login: logging in ${key} from scratch`);
      return this.loginFresh(key, statePath, false);
    }

    const state = this.readStorageState(statePath);
    this.assertCookieFresh(state, statePath);
    this.log.info('storage state accepted', {
      user: key,
      path: statePath,
      cookies: state.cookies.length,
      origins: state.origins.length,
    });
    return this.createSession(key, user, statePath, true);
  }

  /**
   * Fallback strategy: sign in inside the test, optionally persisting the
   * state so the next run can reuse it. Used when storage state is missing,
   * expired, or when LinkedIn invalidates sessions server-side.
   */
  async loginFresh(key: UserKey, statePath = storageStatePath(key), persist = true): Promise<Session> {
    const user = getUser(key);
    if (!user.email || !user.password) {
      throw new SessionUnavailableError(
        `No credentials for ${key}; cannot fall back to a UI login. Set LINKEDIN_USER_${key === 'userA' ? 'A' : 'B'}_EMAIL/PASSWORD or provide a storage state.`,
        { user: key },
      );
    }

    const context = await this.browser.newContext(this.contextOptions);
    const page = await context.newPage();
    this.attachDiagnostics(page, key);

    const login = new LoginPage(page, this.log);
    await login.open();
    await login.login({ email: user.email, password: user.password });

    if (persist) {
      await this.persist(context, statePath);
    }

    return this.register({ key, user, context, page, reusedState: false });
  }

  /** Saves the current context's cookies/localStorage to disk (locked, atomic). */
  async persist(context: BrowserContext, statePath: string): Promise<void> {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const lockPath = `${statePath}.lock`;
    await this.acquireLock(lockPath);
    try {
      const temp = `${statePath}.${process.pid}.tmp`;
      await context.storageState({ path: temp });
      fs.renameSync(temp, statePath);
      this.log.info('storage state persisted', { path: statePath });
    } finally {
      fs.rmSync(lockPath, { force: true });
    }
  }

  async closeAll(): Promise<void> {
    for (const session of this.sessions.splice(0)) {
      await session.context.close().catch(() => undefined);
      SessionManager.active.get(this.workerIndex)?.delete(session);
    }
  }

  // ---------------------------------------------------------------------------

  private async createSession(
    key: UserKey,
    user: TestUser,
    statePath: string,
    reusedState: boolean,
  ): Promise<Session> {
    const context = await this.browser.newContext({ ...this.contextOptions, storageState: statePath });
    const page = await context.newPage();
    this.attachDiagnostics(page, key);
    this.log.info('browser context created', { user: key, reusedState, statePath });
    return this.register({ key, user, context, page, reusedState });
  }

  private register(session: Session): Session {
    this.sessions.push(session);
    const bucket = SessionManager.active.get(this.workerIndex) ?? new Set<Session>();
    bucket.add(session);
    SessionManager.active.set(this.workerIndex, bucket);
    return session;
  }

  private readStorageState(statePath: string): StorageStateFile {
    if (!fs.existsSync(statePath)) {
      throw new SessionUnavailableError(
        `No storage state for this user at ${statePath}. Run "npm run auth" (mock) or "npm run auth:save -- --user userA" (live), or set SESSION_STRATEGY=per-test-login.`,
        { statePath },
      );
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8')) as StorageStateFile;
      if (!Array.isArray(parsed.cookies) || parsed.cookies.length === 0) {
        throw new Error('cookies array is empty');
      }
      return parsed;
    } catch (error) {
      throw new SessionUnavailableError(
        `Storage state ${statePath} is unreadable: ${(error as Error).message}. Regenerate it with "npm run auth".`,
        { statePath },
      );
    }
  }

  private assertCookieFresh(state: StorageStateFile, statePath: string): void {
    const authCookie = state.cookies.find((cookie) => cookie.name === 'li_at');
    if (!authCookie) {
      throw new SessionUnavailableError(
        `Storage state ${statePath} has no "li_at" cookie (the LinkedIn auth cookie). Regenerate it with "npm run auth".`,
        { statePath, cookies: state.cookies.map((cookie) => cookie.name) },
      );
    }
    const expiresAt = authCookie.expires > 0 ? authCookie.expires * 1000 : 0;
    if (expiresAt && expiresAt < Date.now() + 60_000) {
      throw new SessionExpiredError(
        `Session for ${statePath} expired at ${new Date(expiresAt).toISOString()}. Delete it and run "npm run auth" (or use SESSION_STRATEGY=per-test-login).`,
        { statePath, expiresAt: new Date(expiresAt).toISOString() },
      );
    }
  }

  private attachDiagnostics(page: Page, key: UserKey): void {
    page.on('pageerror', (error) => this.log.error(`[${key}] uncaught page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') this.log.warn(`[${key}] console error: ${message.text()}`);
    });
    page.on('requestfailed', (request) => {
      this.log.warn(`[${key}] request failed: ${request.method()} ${request.url()}`, {
        failure: request.failure()?.errorText,
      });
    });
    page.on('response', (response) => {
      if (response.status() >= 500) {
        this.log.warn(`[${key}] server error: HTTP ${response.status()} ${response.url()}`);
      }
    });
  }

  private async acquireLock(lockPath: string, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST') throw error;
        if (Date.now() >= deadline) {
          throw new SessionUnavailableError(`Timed out waiting for storage-state lock ${lockPath}`, { lockPath });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
}
