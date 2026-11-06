import os from 'node:os';

/**
 * Redacts machine-specific paths before anything is written to logs or
 * committed evidence.
 *
 * The repository is public-facing: absolute home-directory paths leak the
 * local user name, and CI runner paths leak the worker layout. Everything is
 * mapped to the neutral virtual root `/home/user/workspace`.
 */
export const VIRTUAL_ROOT = '/home/user/workspace';
export const VIRTUAL_HOME = '/home/user';

const EXACT_REPLACEMENTS = (
  [
    [process.cwd(), VIRTUAL_ROOT],
    [os.homedir(), VIRTUAL_HOME],
  ] as Array<[string, string]>
).filter(([from]) => Boolean(from) && from !== '/');

function replaceAll(value: string, search: string, replacement: string): string {
  return search ? value.split(search).join(replacement) : value;
}

export function sanitizeText(value: string): string {
  let output = value;

  for (const [from, to] of EXACT_REPLACEMENTS) {
    output = replaceAll(output, from, to);
  }

  // Safety net for paths that did not start with cwd/home (CI temp dirs,
  // error messages from dependencies, Windows profiles, ...).
  output = output.replace(/\/Users\/[^/\s"'<>]+/g, VIRTUAL_HOME);
  output = output.replace(/\/home\/(?!user(?:\/|$))[^/\s"'<>]+/g, VIRTUAL_HOME);
  output = output.replace(/[A-Za-z]:\\Users\\[^\\\s"'<>]+/g, 'C:\\Users\\user');

  return output;
}

/** Deep-sanitizes strings inside log payloads and JSON artifacts. */
export function sanitizeValue<T>(value: T): T {
  if (typeof value === 'string') return sanitizeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item)) as unknown as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = sanitizeValue(item);
    }
    return output as T;
  }
  return value;
}
