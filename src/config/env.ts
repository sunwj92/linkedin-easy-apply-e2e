import 'dotenv/config';
import path from 'node:path';

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export type SessionStrategy = 'storage-state' | 'per-test-login';

/**
 * Central place for every knob the suite exposes. Nothing else reads
 * process.env directly so that CI overrides stay discoverable.
 */
export const env = {
  live: bool(process.env.LINKEDIN_LIVE, false),
  mockBaseURL: process.env.MOCK_BASE_URL ?? 'http://127.0.0.1:4321',
  mockPort: Number(process.env.MOCK_PORT ?? 4321),
  liveBaseURL: process.env.LINKEDIN_BASE_URL ?? 'https://www.linkedin.com',
  authDir: path.resolve(process.env.AUTH_DIR ?? '.auth'),
  sessionStrategy: (process.env.SESSION_STRATEGY ?? 'storage-state') as SessionStrategy,
  allowUiLogin: bool(process.env.ALLOW_UI_LOGIN, false),
  mockPassword: process.env.MOCK_PASSWORD ?? 'demo1234',
  headed: bool(process.env.HEADED, false),
  ci: bool(process.env.CI, false),
  baseURL: process.env.BASE_URL ?? process.env.MOCK_BASE_URL ?? 'http://127.0.0.1:4321',
} as const;

export function mockURL(pathname: string): string {
  return new URL(pathname, env.mockBaseURL).toString();
}
