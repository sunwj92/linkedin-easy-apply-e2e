# Test execution evidence

Generated: 2026-11-06T03:04:45.033Z

Screenshots: 42 · Execution logs: 44

Totals: passed=66, skipped=8

| Project | Spec | Test | Status |
| --- | --- | --- | --- |
| setup | auth.setup.ts | prepare session for userA | passed |
| setup | auth.setup.ts | prepare session for userB | passed |
| chrome-desktop | live/easy-apply.live.spec.ts | validates the Easy Apply form on linkedin.com without submitting | skipped |
| chrome-iphone13 | live/easy-apply.live.spec.ts | validates the Easy Apply form on linkedin.com without submitting | skipped |
| chrome-galaxy-s9 | live/easy-apply.live.spec.ts | validates the Easy Apply form on linkedin.com without submitting | skipped |
| msedge-desktop | live/easy-apply.live.spec.ts | validates the Easy Apply form on linkedin.com without submitting | skipped |
| msedge-iphone13 | live/easy-apply.live.spec.ts | validates the Easy Apply form on linkedin.com without submitting | skipped |
| msedge-galaxy-s9 | live/easy-apply.live.spec.ts | validates the Easy Apply form on linkedin.com without submitting | skipped |
| chrome-desktop | mock/easy-apply.flow.spec.ts | gates every required step and stops before submitting | passed |
| chrome-iphone13 | mock/easy-apply.flow.spec.ts | gates every required step and stops before submitting | passed |
| chrome-galaxy-s9 | mock/easy-apply.flow.spec.ts | gates every required step and stops before submitting | passed |
| msedge-desktop | mock/easy-apply.flow.spec.ts | gates every required step and stops before submitting | passed |
| msedge-iphone13 | mock/easy-apply.flow.spec.ts | gates every required step and stops before submitting | passed |
| msedge-galaxy-s9 | mock/easy-apply.flow.spec.ts | gates every required step and stops before submitting | passed |
| chrome-desktop | mock/error-handling.spec.ts | a closed job produces a MissingElementError plus screenshot and DOM dump | passed |
| chrome-iphone13 | mock/error-handling.spec.ts | a closed job produces a MissingElementError plus screenshot and DOM dump | passed |
| chrome-galaxy-s9 | mock/error-handling.spec.ts | a closed job produces a MissingElementError plus screenshot and DOM dump | passed |
| msedge-desktop | mock/error-handling.spec.ts | a closed job produces a MissingElementError plus screenshot and DOM dump | passed |
| msedge-iphone13 | mock/error-handling.spec.ts | a closed job produces a MissingElementError plus screenshot and DOM dump | passed |
| msedge-galaxy-s9 | mock/error-handling.spec.ts | a closed job produces a MissingElementError plus screenshot and DOM dump | passed |
| chrome-desktop | mock/error-handling.spec.ts | HTTP 500 on a job page is reported as a NavigationError | passed |
| chrome-iphone13 | mock/error-handling.spec.ts | HTTP 500 on a job page is reported as a NavigationError | passed |
| chrome-galaxy-s9 | mock/error-handling.spec.ts | HTTP 500 on a job page is reported as a NavigationError | passed |
| msedge-desktop | mock/error-handling.spec.ts | HTTP 500 on a job page is reported as a NavigationError | passed |
| msedge-iphone13 | mock/error-handling.spec.ts | HTTP 500 on a job page is reported as a NavigationError | passed |
| msedge-galaxy-s9 | mock/error-handling.spec.ts | HTTP 500 on a job page is reported as a NavigationError | passed |
| chrome-desktop | mock/error-handling.spec.ts | redirect to /login while opening a job surfaces as an authentication error | passed |
| chrome-iphone13 | mock/error-handling.spec.ts | redirect to /login while opening a job surfaces as an authentication error | passed |
| chrome-galaxy-s9 | mock/error-handling.spec.ts | redirect to /login while opening a job surfaces as an authentication error | passed |
| msedge-desktop | mock/error-handling.spec.ts | redirect to /login while opening a job surfaces as an authentication error | passed |
| msedge-iphone13 | mock/error-handling.spec.ts | redirect to /login while opening a job surfaces as an authentication error | passed |
| msedge-galaxy-s9 | mock/error-handling.spec.ts | redirect to /login while opening a job surfaces as an authentication error | passed |
| chrome-desktop | mock/mobile-emulation.spec.ts | applies the device profile and still opens the Easy Apply form | skipped |
| chrome-iphone13 | mock/mobile-emulation.spec.ts | applies the device profile and still opens the Easy Apply form | passed |
| chrome-galaxy-s9 | mock/mobile-emulation.spec.ts | applies the device profile and still opens the Easy Apply form | passed |
| msedge-desktop | mock/mobile-emulation.spec.ts | applies the device profile and still opens the Easy Apply form | skipped |
| msedge-iphone13 | mock/mobile-emulation.spec.ts | applies the device profile and still opens the Easy Apply form | passed |
| msedge-galaxy-s9 | mock/mobile-emulation.spec.ts | applies the device profile and still opens the Easy Apply form | passed |
| chrome-desktop | mock/validation.spec.ts | rejects missing and malformed required answers without advancing | passed |
| chrome-iphone13 | mock/validation.spec.ts | rejects missing and malformed required answers without advancing | passed |
| chrome-galaxy-s9 | mock/validation.spec.ts | rejects missing and malformed required answers without advancing | passed |
| msedge-desktop | mock/validation.spec.ts | rejects missing and malformed required answers without advancing | passed |
| msedge-iphone13 | mock/validation.spec.ts | rejects missing and malformed required answers without advancing | passed |
| msedge-galaxy-s9 | mock/validation.spec.ts | rejects missing and malformed required answers without advancing | passed |
| chrome-desktop | mock/validation.spec.ts | clearing the uploaded resume blocks the Next button again | passed |
| chrome-iphone13 | mock/validation.spec.ts | clearing the uploaded resume blocks the Next button again | passed |
| chrome-galaxy-s9 | mock/validation.spec.ts | clearing the uploaded resume blocks the Next button again | passed |
| msedge-desktop | mock/validation.spec.ts | clearing the uploaded resume blocks the Next button again | passed |
| msedge-iphone13 | mock/validation.spec.ts | clearing the uploaded resume blocks the Next button again | passed |
| msedge-galaxy-s9 | mock/validation.spec.ts | clearing the uploaded resume blocks the Next button again | passed |
| chrome-desktop | session/multi-user.spec.ts | two users browse concurrently in isolated contexts | passed |
| chrome-iphone13 | session/multi-user.spec.ts | two users browse concurrently in isolated contexts | passed |
| chrome-galaxy-s9 | session/multi-user.spec.ts | two users browse concurrently in isolated contexts | passed |
| msedge-desktop | session/multi-user.spec.ts | two users browse concurrently in isolated contexts | passed |
| msedge-iphone13 | session/multi-user.spec.ts | two users browse concurrently in isolated contexts | passed |
| msedge-galaxy-s9 | session/multi-user.spec.ts | two users browse concurrently in isolated contexts | passed |
| chrome-desktop | session/multi-user.spec.ts | reuses the persisted storage state without hitting the login form | passed |
| chrome-iphone13 | session/multi-user.spec.ts | reuses the persisted storage state without hitting the login form | passed |
| chrome-galaxy-s9 | session/multi-user.spec.ts | reuses the persisted storage state without hitting the login form | passed |
| msedge-desktop | session/multi-user.spec.ts | reuses the persisted storage state without hitting the login form | passed |
| msedge-iphone13 | session/multi-user.spec.ts | reuses the persisted storage state without hitting the login form | passed |
| msedge-galaxy-s9 | session/multi-user.spec.ts | reuses the persisted storage state without hitting the login form | passed |
| chrome-desktop | session/multi-user.spec.ts | an expired li_at cookie fails fast with an actionable SessionExpiredError | passed |
| chrome-iphone13 | session/multi-user.spec.ts | an expired li_at cookie fails fast with an actionable SessionExpiredError | passed |
| chrome-galaxy-s9 | session/multi-user.spec.ts | an expired li_at cookie fails fast with an actionable SessionExpiredError | passed |
| msedge-desktop | session/multi-user.spec.ts | an expired li_at cookie fails fast with an actionable SessionExpiredError | passed |
| msedge-iphone13 | session/multi-user.spec.ts | an expired li_at cookie fails fast with an actionable SessionExpiredError | passed |
| msedge-galaxy-s9 | session/multi-user.spec.ts | an expired li_at cookie fails fast with an actionable SessionExpiredError | passed |
| chrome-desktop | session/multi-user.spec.ts | falls back to a fresh UI login and persists it when no state exists | passed |
| chrome-iphone13 | session/multi-user.spec.ts | falls back to a fresh UI login and persists it when no state exists | passed |
| chrome-galaxy-s9 | session/multi-user.spec.ts | falls back to a fresh UI login and persists it when no state exists | passed |
| msedge-desktop | session/multi-user.spec.ts | falls back to a fresh UI login and persists it when no state exists | passed |
| msedge-iphone13 | session/multi-user.spec.ts | falls back to a fresh UI login and persists it when no state exists | passed |
| msedge-galaxy-s9 | session/multi-user.spec.ts | falls back to a fresh UI login and persists it when no state exists | passed |
