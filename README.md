# LinkedIn Easy Apply — Playwright E2E suite

Automated coverage for the LinkedIn **Easy Apply** flow: search for a job, filter by
Easy Apply, open the application form, verify required fields, resume upload behaviour,
button state, and reach the review step **without submitting a real application**.

The suite runs on **Chrome** and **Edge**, in **desktop and mobile emulation**
(iPhone 13 and Galaxy S9+), and supports **multiple signed-in users** in isolated
browser contexts with persisted `storageState` sessions.

> **Safety / scope**
> - Real applications are **never submitted**: the flow stops at "Submit application"
>   and asserts that no `POST` was made.
> - The default test target is a **local, LinkedIn-DOM-compatible fixture** (no account,
>   no scraping of production data). It reproduces the DOM hooks the suite relies on
>   (`jobs-search-results__list-item`, `jobs-easy-apply-modal`,
>   `fb-dash-form-element`, `data-easy-apply-next-button`, …).
> - The `@live` spec targets `linkedin.com/jobs` but is **opt-in**, requires your own
>   storage state, never clicks Next on a prefilled form and never submits.
> - Automating LinkedIn may conflict with its User Agreement; use this only on an
>   account and environment you are allowed to test, and respect rate limits.

---

## Quick start

```bash
npm ci
npx playwright install --with-deps chrome msedge   # or: chromium
npm run typecheck
npm test                 # all projects, fixture mode
```

Useful commands:

| Command | What it does |
| --- | --- |
| `npm test` | All projects (Chrome + Edge × desktop/iPhone 13/Galaxy S9) |
| `npm run test:desktop` | Chrome + Edge desktop only |
| `npm run test:mobile` | Chrome iPhone 13 + Galaxy S9 only |
| `npm run test:mock` | Fixture + session tests (no browser limits) |
| `npm run test:live` | Opt-in run against linkedin.com (needs `.auth/live-*.json`) |
| `npm run auth` | Creates `.auth/userA.json` / `.auth/userB.json` for the fixture |
| `npm run auth:save -- --user userA` | Headed login → `.auth/live-userA.json` for live mode |
| `npm run report` | Opens the HTML report (`artifacts/html-report`) |
| `npm run evidence` | Copies screenshots/logs into `docs/evidence/` |
| `npm run typecheck` | `tsc --noEmit` |

Environment knobs are documented in `.env.example`. Common ones:

```bash
BROWSER_CHANNELS=chrome,msedge    # chromium | chrome | msedge (comma separated)
LINKEDIN_LIVE=1                  # target linkedin.com instead of the fixture
SESSION_STRATEGY=storage-state   # or per-test-login (fallback, slower)
ALLOW_UI_LOGIN=1                 # allow a fresh UI login when a state is missing (local only)
HEADED=1                         # watch the run
```

---

## Browser / device matrix

`playwright.config.ts` expands `BROWSER_CHANNELS` into one project per browser and device:

| Project | Engine | Profile |
| --- | --- | --- |
| `chrome-desktop` | installed Google Chrome | 1440×900 |
| `chrome-iphone13` | installed Google Chrome | `devices['iPhone 13']` (390×664, touch, iOS UA) |
| `chrome-galaxy-s9` | installed Google Chrome | `devices['Galaxy S9+']` (Playwright ships S9+, 320×658) |
| `msedge-desktop` | installed Microsoft Edge | 1440×900 |
| `msedge-iphone13` | installed Microsoft Edge | iPhone 13 profile |
| `msedge-galaxy-s9` | installed Microsoft Edge | Galaxy S9+ profile |

The same six projects exist with a `chromium-` prefix when `BROWSER_CHANNELS=chromium`
(useful on CI where only bundled Chromium is installed).

Mobile emulation is applied to **every** test, not just one spec: sessions created by
`SessionManager` forward `viewport`, `userAgent`, `deviceScaleFactor`, `isMobile`,
`hasTouch` and `locale` from the project's `use` block. `tests/mock/mobile-emulation.spec.ts`
additionally asserts the profile actually reached the page (viewport, UA, touch) and that
the modal fits the viewport.

---

## What the tests verify

### Happy path (`tests/mock/easy-apply.flow.spec.ts`)

1. Sign in with a persisted session and open `/jobs`.
2. Search for `QA Automation Engineer`, assert result cards render.
3. Toggle **Easy Apply**, assert no non-Easy-Apply card remains.
4. Open the first Easy Apply job and the modal.
5. Read the form schema from the DOM: labels, types, `required`/`aria-required`, `accept`.
6. Click **Next** with empty fields → inline errors are shown and the step does **not** advance.
7. Fill contact details → step 2.
8. Resume step starts with **Next disabled**; upload `.exe` → rejected; upload 2.5 MB PDF →
   rejected; upload valid PDF → filename shown, Next enabled.
9. Advance to **Review**, assert **Submit application** is visible and enabled,
   and that no `POST /api/applications` happened.

### Validation rules (`tests/mock/validation.spec.ts`)

- A different job exposes a different required set (email only, 2 steps) — proves the
  schema is read from the page rather than hard-coded.
- Missing email → required error; `not-an-email` → format error; both keep the step.
- Removing an uploaded resume disables **Next** again.

### Failure handling (`tests/mock/error-handling.spec.ts`)

- A closed job (Easy Apply badge is gone) raises `MissingElementError` including the
  ordered selector chain; a screenshot + full DOM + JSON breadcrumb are written and
  asserted on disk.
- `HTTP 500` job page → `NavigationError` with `status: 500`.
- Cookie dropped / redirected to `/login` → authentication error instead of a hang.

### Multi-user sessions (`tests/session/multi-user.spec.ts`)

- Two users run **concurrently in separate contexts**: different cookies, different
  identities, both browse jobs at the same time.
- A persisted state is reused with **zero** `POST /login` requests.
- An expired `li_at` cookie produces `SessionExpiredError` with a remediation hint.
- Missing state → fallback `loginFresh()` logs in, persists a new state atomically
  (file lock + rename), and the next run can reuse it.

### Live smoke test (`tests/live/easy-apply.live.spec.ts`)

Runs only with `LINKEDIN_LIVE=1` and a hand-made storage state. It verifies a job can be
found with Easy Apply, the modal opens, required name/email fields exist, and logs the
resume-field/button state. It intentionally does not click Next or Submit.

---

## Architecture

```
src/
  config/env.ts              all environment switches (single source of truth)
  fixtures/test.ts           Playwright fixtures: logger, SessionManager, failure hook
  fixtures/users.ts          two-user model, per-mode credentials and state paths
  pages/
    selectors.ts             selector fallback chains (one place to fix UI drift)
    login.page.ts            sign-in, checkpoint detection
    jobs-search.page.ts      search, Easy Apply filter, card parsing
    job-details.page.ts      job page, Easy Apply button/closed-job detection
    easy-apply.modal.ts      multi-step modal: fields, upload, button state, errors
  support/
    session-manager.ts       storageState validation, isolated contexts, login fallback
    logger.ts                per-test text + JSONL logger, step timings
    evidence.ts              numbered screenshots; failure bundles (PNG + HTML + JSON)
    locators.ts              first-visible / first-attached selector resolution
    errors.ts                MissingElement / Navigation / Validation / Session* errors
    files.ts                 in-memory PDF/DOCX/EXE/oversized fixtures
mock/
  server.mjs                 LinkedIn-compatible fixture (auth, search, job, apply API)
  public/app.js              client-side multi-step Easy Apply modal
tests/
  auth.setup.ts              per-user storage states
  mock/*.spec.ts             fixture suites
  session/multi-user.spec.ts session behaviour
  live/*.spec.ts             opt-in linkedin.com smoke test
```

Design points:

- **Selector fallbacks.** Every important element resolves through an ordered list
  (`page.locator('.a, .b')` is avoided in favour of `firstVisible()`), so an A/B variant
  or class rename fails with one actionable `MissingElementError` listing all attempts.
- **No brittle sleeps.** Waits are semantic (`expect.poll` on step number, URL, badge
  state, element visibility). The only fixed waits are 80–150 ms after file upload to let
  the app's `change` handler run.
- **Structured logs.** Each test writes `execution.log` (human) and
  `execution-log.jsonl` (machine), with step index, duration and status; both are
  attached to the HTML report.
- **Failure bundles.** On a failed test the fixture captures a screenshot, the full DOM,
  and a JSON file with URL, title, error type/details and step timings.
- **Typed errors.** `MissingElementError`, `NavigationError`, `ValidationError`,
  `SessionUnavailableError`, `SessionExpiredError` — CI greps and dashboards can group
  by failure class instead of parsing strings.

---

## Multi-user session strategy

Three layers, in order:

1. **Persisted storage state (default).**
   `tests/auth.setup.ts` signs each user in once and writes `.auth/userA.json` /
   `.auth/userB.json`. `SessionManager.open('userA')` creates a fresh `BrowserContext`
   with that state; two users never share cookies. The setup project is a Playwright
   dependency, so the files always exist before dependent projects run.

2. **Validated reuse.**
   Before creating a context the manager checks the file exists, parses, contains
   `li_at`, and that the cookie has not expired. Expired → `SessionExpiredError` with the
   exact regeneration command, instead of a confusing redirect later.

3. **Fallbacks when persistence is not feasible.**
   - `SESSION_STRATEGY=per-test-login`: sign in inside each test (slower, but works when
     storage is blocked, e.g. cookie encryption differs per machine).
   - `sessions.loginFresh(user, path, persist=true)`: sign in and atomically persist
     (lock file + temp file + rename) so concurrent workers cannot corrupt the JSON.
   - Live LinkedIn checkpoints/2FA: `npm run auth:save -- --user userA` opens a headed
     browser, lets a human complete the challenge, and saves the state. Credentials
     never need to be stored.

For CI, the live job decodes base64 storage states from GitHub Environment secrets into
`.auth/live-user*.json` (chmod 600). Nothing sensitive is committed — `.auth/` and `.env`
are ignored.

---

## CI/CD integration

`.github/workflows/e2e.yml`:

- **Trigger:** PR, push to `main`, nightly cron, manual dispatch.
- **Matrix:** `chromium`, `chrome`, `msedge`; each run executes desktop + iPhone 13 +
  Galaxy S9 projects against the fixture.
- **Quality gate:** `npm run typecheck` runs before tests; the job fails on any test
  failure (retries = 1 only in CI, `trace: on-first-retry`).
- **Artifacts (always):** HTML report, JUnit XML, `docs/evidence` with screenshots and
  logs, 14-day retention.
- **Live job:** `workflow_dispatch` only, protected by the `linkedin-live` environment,
  reads `LINKEDIN_STATE_A_B64` / `LINKEDIN_STATE_B_B64`, and skips with a warning when
  they are absent.
- **Recommended repo settings:** require the `e2e / fixture` checks on `main`, upload
  JUnit to your test-management tool, and alert on the nightly job rather than gating
  every PR on the live job.

The same container works locally and in CI: only `BROWSER_CHANNELS` and secrets differ.

### Maintaining it over time

- **UI drift:** selectors live in `src/pages/selectors.ts`. When LinkedIn changes a class,
  add the new selector at the front of the relevant chain; tests fail with the full chain
  and a screenshot, so the fix is usually one line.
- **Locator health:** keep the fixture and the live path on the same DOM contract. If the
  live smoke test detects a new step/field, update `mock/server.mjs` + `app.js` so the
  deterministic suite covers it.
- **Flake control:** no arbitrary sleeps, `expect.poll` everywhere, per-project retries
  only in CI, and failure bundles that show whether it was a missing element, a timeout or
  a business-rule change.
- **Session hygiene:** storage states expire (LinkedIn rotates cookies). The manager
  detects expiry early; schedule `npm run auth` locally / refresh CI secrets when the
  nightly live job reports `SessionExpiredError`. Prefer the per-test-login fallback for
  short-lived, security-sensitive accounts.
- **Test data:** fixture jobs/users are versioned in `mock/server.mjs`; add a job per new
  form variant (file optional, multi-select, screening question) and extend
  `EasyApplyModal.fields()` assertions rather than adding new page objects.
- **Reporting trend:** JUnit + `artifacts/results.json` feed dashboards; track pass rate,
  duration and failure class (`MissingElementError` vs `NavigationError`) per project.

---

## Evidence from the last run

`docs/evidence/` contains the walkthrough screenshots and execution logs generated by
`npm run evidence`:

- `screenshots/<project>--<step>.png` — search results, filter applied, form step 1,
  required-field errors, disabled Next, invalid/oversized resume, valid resume, review.
- `logs/*.log` — timestamped step logs including URLs, field metadata, validation errors.
- `SUMMARY.md` — pass/fail table per project.

The HTML report (`artifacts/html-report/index.html`) additionally embeds traces on retry
and the failure bundles.

---

## Limitations

- The fixture approximates LinkedIn's DOM contract; it is not a pixel-perfect clone. The
  live smoke test is the check that the contract still matches production.
- Live login automation is intentionally not implemented: 2FA, checkpoints and bot
  detection need a human. Use `auth:save` and rotate the state when it expires.
- LinkedIn experiments (A/B variants) can change field order or add screening questions.
  The modal reads the schema dynamically, so extra required fields fail the explicit
  assertions (by design) rather than being silently skipped.
- Playwright ships `Galaxy S9+` (not `Galaxy S9`); the project is named `galaxy-s9` but uses
  that descriptor.
