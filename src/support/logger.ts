import fs from 'node:fs';
import path from 'node:path';
import type { TestInfo } from '@playwright/test';
import { sanitizeText, sanitizeValue } from './sanitize';

type Level = 'INFO' | 'WARN' | 'ERROR' | 'STEP';

interface LogLine {
  ts: string;
  level: Level;
  scope: string;
  step?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface StepRecord {
  index: number;
  name: string;
  startedAt: number;
  durationMs?: number;
  status: 'passed' | 'failed';
}

/**
 * Per-test structured logger.
 *
 * Writes a human-readable `.log` and a machine-readable `.jsonl` into the
 * Playwright output directory and attaches both to the HTML report.
 * Console output is kept short so `playwright test` stays readable.
 */
export class TestLogger {
  private readonly textPath: string;
  private readonly jsonPath: string;
  private readonly startedAt = Date.now();
  private stepCounter = 0;
  private currentStep?: string;
  readonly steps: StepRecord[] = [];

  constructor(
    private readonly testInfo: TestInfo | undefined,
    readonly scope: string,
  ) {
    const dir = testInfo
      ? testInfo.outputPath('logs')
      : path.resolve('artifacts', 'logs', 'adhoc');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.textPath = path.join(dir, `${scope}-${stamp}.log`);
    this.jsonPath = path.join(dir, `${scope}-${stamp}.jsonl`);
    this.info(`logger initialised for "${scope}"`);
  }

  get logFile(): string {
    return this.textPath;
  }

  get jsonlFile(): string {
    return this.jsonPath;
  }

  /** Run a named step: logs start/end, duration and failures. */
  async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.stepCounter += 1;
    const index = this.stepCounter;
    const record: StepRecord = { index, name, startedAt: Date.now(), status: 'passed' };
    this.steps.push(record);
    this.currentStep = name;
    this.write('STEP', `▶ ${name}`, { stepIndex: index });

    try {
      const result = await fn();
      record.durationMs = Date.now() - record.startedAt;
      this.write('STEP', `✔ ${name} (${record.durationMs} ms)`, { stepIndex: index });
      return result;
    } catch (error) {
      record.durationMs = Date.now() - record.startedAt;
      record.status = 'failed';
      this.error(`✖ ${name} failed after ${record.durationMs} ms`, error);
      throw error;
    } finally {
      this.currentStep = undefined;
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.write('INFO', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.write('WARN', message, data);
  }

  error(message: string, error?: unknown): void {
    const data =
      error instanceof Error
        ? { error: error.name, errorMessage: error.message, ...(error as { details?: object }).details }
        : error !== undefined
          ? { error: String(error) }
          : undefined;
    this.write('ERROR', message, data);
  }

  /** Attach log files to the Playwright report. Safe to call once, after the test body. */
  async publish(): Promise<void> {
    if (!this.testInfo) return;
    const summary = {
      scope: this.scope,
      durationMs: Date.now() - this.startedAt,
      steps: this.steps,
      log: this.textPath,
    };
    this.write('INFO', 'test finished', summary);

    await this.testInfo.attach('execution-log', {
      path: this.textPath,
      contentType: 'text/plain',
    });
    await this.testInfo.attach('execution-log-jsonl', {
      path: this.jsonPath,
      contentType: 'application/jsonl',
    });
  }

  private write(level: Level, message: string, data?: Record<string, unknown>): void {
    const line: LogLine = {
      ts: new Date().toISOString(),
      level,
      scope: this.scope,
      ...(this.currentStep ? { step: this.currentStep } : {}),
      message: sanitizeText(message),
      ...(data ? { data: sanitizeValue(data) } : {}),
    };
    fs.appendFileSync(this.textPath, format(line) + '\n');
    fs.appendFileSync(this.jsonPath, JSON.stringify(line) + '\n');

    if (level === 'ERROR' || level === 'WARN') {
      // eslint-disable-next-line no-console
      console.error(`[${level}] ${sanitizeText(message)}`, data ? sanitizeValue(data) : '');
    }
  }
}

function format(line: LogLine): string {
  const time = line.ts.slice(11, 23);
  const step = line.step ? ` [${line.step}]` : '';
  const data = line.data ? ` ${JSON.stringify(line.data)}` : '';
  return `${time} ${line.level.padEnd(5)} ${line.scope}${step} ${line.message}${data}`;
}

export function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return sanitizeValue({
      name: error.name,
      message: error.message,
      ...(error as { details?: Record<string, unknown> }).details,
      stack: error.stack?.split('\n').slice(0, 6).join('\n'),
    });
  }
  return { message: sanitizeText(String(error)) };
}
