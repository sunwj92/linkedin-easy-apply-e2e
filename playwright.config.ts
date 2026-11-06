import { defineConfig, devices, type Project } from '@playwright/test';
import { env, mockURL } from './src/config/env';

type Channel = 'chromium' | 'chrome' | 'msedge';

const channels = (process.env.BROWSER_CHANNELS ?? 'chrome,msedge')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean) as Channel[];

const mobileProfiles = [
  { name: 'iphone13', descriptor: devices['iPhone 13'] },
  { name: 'galaxy-s9', descriptor: devices['Galaxy S9+'] },
];

const sharedUse = {
  baseURL: env.baseURL,
  locale: 'en-US',
  timezoneId: 'Asia/Shanghai',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  actionTimeout: 15_000,
  navigationTimeout: 45_000,
} as const;

function channelOptions(channel: Channel): { channel?: string; browserName: 'chromium' } {
  return {
    browserName: 'chromium',
    ...(channel === 'chromium' ? {} : { channel }),
  };
}

const setupChannel = channels.find((channel) => channel !== 'chromium') ?? 'chromium';
const setupProject: Project = {
  name: 'setup',
  testMatch: /auth\.setup\.ts/,
  use: {
    ...sharedUse,
    browserName: 'chromium',
    ...(setupChannel === 'chromium' ? {} : { channel: setupChannel }),
  },
};

const browserProjects: Project[] = channels.flatMap((channel) => {
  const base = { ...sharedUse, ...channelOptions(channel) };

  return [
    {
      name: `${channel}-desktop`,
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: { ...base, viewport: { width: 1440, height: 900 } },
    },
    ...mobileProfiles.map((profile) => ({
      name: `${channel}-${profile.name}`,
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: {
        ...base,
        ...profile.descriptor,
        browserName: 'chromium' as const,
        ...(channel === 'chromium' ? {} : { channel }),
      },
    })),
  ];
});

export default defineConfig({
  testDir: './tests',
  globalSetup: './src/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: env.ci,
  retries: env.ci ? 1 : 0,
  workers: env.ci ? 2 : undefined,
  timeout: 75_000,
  expect: { timeout: 10_000 },
  outputDir: 'artifacts/test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/html-report', open: 'never' }],
    ['junit', { outputFile: 'artifacts/junit.xml' }],
    ['json', { outputFile: 'artifacts/results.json' }],
  ],
  use: {
    ...sharedUse,
    headless: !env.headed,
  },
  projects: [setupProject, ...browserProjects],
  ...(env.live
    ? {}
    : {
        webServer: {
          command: 'node mock/server.mjs',
          url: mockURL('/healthz'),
          reuseExistingServer: !env.ci,
          timeout: 30_000,
          stdout: 'ignore' as const,
          stderr: 'pipe' as const,
        },
      }),
});
