import fs from 'node:fs';
import path from 'node:path';

/**
 * Starts every run with a clean evidence folder.
 *
 * Playwright clears `artifacts/test-results` itself, but the walkthrough
 * screenshots live in `artifacts/evidence` (consumed by `npm run evidence`).
 * Without this, screenshots from a previous run are merged into the new one.
 */
export default async function globalSetup(): Promise<void> {
  fs.rmSync(path.resolve('artifacts', 'evidence'), { recursive: true, force: true });
}
