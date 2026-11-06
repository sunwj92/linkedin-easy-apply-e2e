#!/usr/bin/env node
/**
 * Collects walkthrough screenshots and execution logs produced by a test run
 * into docs/evidence/, so the repository carries a readable record of the last
 * green run (useful for the submission and for PR reviews).
 *
 * By default only a representative slice is copied (Chrome + Edge desktop and
 * two mobile profiles) to keep the repository small. Pass --all to copy every
 * screenshot from every project.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const evidenceRoot = path.join(root, 'artifacts', 'evidence');
const resultsFile = path.join(root, 'artifacts', 'results.json');
const outputRoot = path.join(root, 'docs', 'evidence');
const screenshotsDir = path.join(outputRoot, 'screenshots');
const logsDir = path.join(outputRoot, 'logs');
const copyAll = process.argv.includes('--all');

const EVIDENCE_PROJECTS = new Set(['chrome-desktop', 'msedge-desktop', 'chrome-iphone13', 'chrome-galaxy-s9']);

// Keep in sync with src/support/sanitize.ts. Evidence is committed to the repo,
// so machine paths must never reach it.
const VIRTUAL_HOME = '/home/user';
const VIRTUAL_ROOT = '/home/user/workspace';
function sanitizeText(value) {
  let output = value;
  for (const [from, to] of [
    [process.cwd(), VIRTUAL_ROOT],
    [os.homedir(), VIRTUAL_HOME],
  ]) {
    if (from && from !== '/') output = output.split(from).join(to);
  }
  output = output.replace(/\/Users\/[^/\s"'<>]+/g, VIRTUAL_HOME);
  output = output.replace(/\/home\/(?!user(?:\/|$))[^/\s"'<>]+/g, VIRTUAL_HOME);
  return output;
}

function sanitizeFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const clean = sanitizeText(content);
  if (clean !== content) fs.writeFileSync(file, clean);
}

fs.rmSync(screenshotsDir, { recursive: true, force: true });
fs.rmSync(logsDir, { recursive: true, force: true });
fs.mkdirSync(screenshotsDir, { recursive: true });
fs.mkdirSync(logsDir, { recursive: true });

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

let copied = 0;
for (const file of walk(evidenceRoot)) {
  if (!file.endsWith('.png')) continue;
  const relative = path.relative(evidenceRoot, file).split(path.sep);
  const project = relative[0];
  if (!copyAll && !EVIDENCE_PROJECTS.has(project)) continue;
  const name = `${project}--${relative.slice(1).join('-')}`;
  fs.copyFileSync(file, path.join(screenshotsDir, name));
  copied += 1;
}

const logCandidates = walk(path.join(root, 'artifacts', 'test-results')).filter((file) =>
  /execution-log-.*\.log$/.test(file),
);
let logs = 0;
for (const file of logCandidates) {
  // .../<test-folder>/attachments/execution-log-<hash>.log
  const attachmentsDir = path.dirname(file);
  const testDir = path.dirname(attachmentsDir);
  const folder = path.basename(testDir);
  const project = [...EVIDENCE_PROJECTS].find((candidate) => folder.endsWith(`-${candidate}`));
  if (!copyAll && !project) continue;
  const specPart = folder.split('--')[0].replace(/^mock-/, '');
  let target = path.join(logsDir, `${project}--${specPart}.log`);
  let counter = 2;
  while (fs.existsSync(target)) {
    target = path.join(logsDir, `${project}--${specPart}-${counter}.log`);
    counter += 1;
  }
  fs.copyFileSync(file, target);
  sanitizeFile(target);
  logs += 1;
}

// Final guard: fail the evidence job if any absolute workspace path slipped through.
const LEAK_PATTERNS = [/\/Users\/[A-Za-z0-9._-]+/, /\/home\/(?!user\b)[A-Za-z0-9._-]+/, /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/];
const textFiles = walk(outputRoot).filter((file) => /\.(log|jsonl|json|md|txt|html)$/.test(file));
const leaks = [];
for (const file of textFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of LEAK_PATTERNS) {
    const match = content.match(pattern);
    if (match) leaks.push(`${path.relative(root, file)} → ${match[0]}`);
  }
}
if (leaks.length > 0) {
  console.error('Sanitization check failed; absolute paths found in evidence:');
  for (const leak of leaks.slice(0, 20)) console.error(`  ${leak}`);
  process.exit(1);
}

let summary = '# Test execution evidence\n\n';
summary += `Generated: ${new Date().toISOString()}\n\n`;
summary += `Screenshots: ${copied} · Execution logs: ${logs}\n\n`;

if (fs.existsSync(resultsFile)) {
  const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
  const rows = [];
  const visit = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        rows.push({
          project: test.projectName ?? 'unknown',
          file: suite.file ?? '',
          title: spec.title,
          status: test.results?.[0]?.status ?? test.status ?? 'unknown',
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of results.suites ?? []) visit(suite);

  const counts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  summary += `Totals: ${Object.entries(counts)
    .map(([status, count]) => `${status}=${count}`)
    .join(', ')}\n\n`;
  summary += '| Project | Spec | Test | Status |\n| --- | --- | --- | --- |\n';
  for (const row of rows) {
    summary += `| ${row.project} | ${row.file} | ${row.title.replace(/\|/g, '\\|')} | ${row.status} |\n`;
  }
}

fs.writeFileSync(path.join(outputRoot, 'SUMMARY.md'), summary);

// Also scrub the raw machine-readable artifacts that CI uploads next to the
// evidence (Playwright writes absolute config paths into results.json).
for (const file of [resultsFile, path.join(root, 'artifacts', 'junit.xml')]) {
  if (fs.existsSync(file)) sanitizeFile(file);
}

console.log(`Copied ${copied} screenshot(s) and ${logs} log(s) into docs/evidence/`);
