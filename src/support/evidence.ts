import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { describeError, type TestLogger } from './logger';
import { sanitizeText, sanitizeValue } from './sanitize';

export const EVIDENCE_ROOT = path.resolve('artifacts', 'evidence');

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function testDir(testInfo: TestInfo): string {
  const project = slugify(testInfo.project.name);
  const title = slugify(testInfo.titlePath.slice(1).join('-')) || 'test';
  const dir = path.join(EVIDENCE_ROOT, project, title);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Captures a screenshot for the walkthrough evidence folder and attaches it to
 * the HTML report. Files are numbered in capture order.
 */
export async function captureScreenshot(
  page: Page,
  testInfo: TestInfo,
  log: TestLogger,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<string> {
  const dir = testDir(testInfo);
  const existing = fs.readdirSync(dir).filter((file) => file.endsWith('.png')).length;
  const file = path.join(dir, `${String(existing + 1).padStart(2, '0')}-${slugify(name)}.png`);

  await page.screenshot({ path: file, fullPage: options.fullPage ?? false });
  log.info(`screenshot captured: ${path.relative(process.cwd(), file)}`, {
    url: page.url(),
    title: await page.title().catch(() => ''),
  });
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
  return file;
}

/**
 * On failure: screenshot, full DOM, console/network tail and a JSON breadcrumb
 * are written next to the test output and attached to the report.
 */
export async function captureFailureBundle(
  page: Page,
  testInfo: TestInfo,
  log: TestLogger,
  error: unknown,
): Promise<void> {
  const dir = testInfo.outputPath('failure');
  fs.mkdirSync(dir, { recursive: true });

  const screenshot = path.join(dir, 'failure.png');
  const htmlDump = path.join(dir, 'failure.html');
  const metaFile = path.join(dir, 'failure.json');

  await page.screenshot({ path: screenshot, fullPage: true }).catch((err) => log.warn(`failure screenshot failed: ${String(err)}`));
  const html = await page.content().catch(() => '<unavailable>');
  fs.writeFileSync(htmlDump, sanitizeText(html));

  const meta = sanitizeValue({
    capturedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title().catch(() => ''),
    error: describeError(error),
    steps: log.steps,
  });
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  log.error('failure bundle written', { dir, error: describeError(error) });
  await testInfo.attach('failure-screenshot', { path: screenshot, contentType: 'image/png' });
  await testInfo.attach('failure-dom', { path: htmlDump, contentType: 'text/html' });
  await testInfo.attach('failure-meta', { path: metaFile, contentType: 'application/json' });
}
