# D4 — Traceability + verdict on the project's own tests

## Our tests ↔ use cases

Every UC needs at least one test (marker's fast check). Gaps must be
explained, not hidden.

| Test | Use case(s) | What it proves |
|---|---|---|
| `test_rejects_redeeming_more_points_than_available` | UC6 | Balance check refuses over-redemption (ext 3a) |
| `test_concurrent_redemptions_cannot_double_spend` | UC6 | Redemption is NOT safe under concurrency (ext 5a) |

### Orphans — use cases with no test (explain each)

- *(example)* UC-voice-ordering: no test — requires a Gemini API key we do
  not have; gap acknowledged.

### Orphans — tests mapped to no use case

- *(should be empty; if a test lands here, say what it is for or delete it)*

## Verdict on the project's own tests (evidence collected 2026-08-28)

Inventory — test artifacts exist in three places; **zero are runnable**:

1. `proj2/tests/example.test.js` — 151 tests over 28 business-logic
   functions. Cannot run: it imports `../src/utils/businessLogic` (line 30),
   a file never committed (`proj2/src/` contains only `badges/`).
2. `proj2/client/src/App.test.tsx` — untouched CRA boilerplate ("renders
   learn react link"). Fails before the assertion: App.tsx line 2 import
   (react-router-dom v7 ESM) cannot be resolved by CRA 5's Jest.
3. `proj2/server/` — jest + supertest installed as devDependencies; zero
   test files exist ("0 matches").

CI forensics — `.github/workflows/ci.yml:38` sets `continue-on-error: true`
on the test step (the lint step above it is `false`), so the green "Build
Passing" badge is configured to ignore test failures. A Codecov token is
also committed in plaintext at line 44.

TODO: map the 151 test *names* (readable even though unrunnable) onto our 20
use cases to show what coverage was intended vs. what was blind (e.g.
delivery-partner flows, all HTTP routes — supertest installed, never used).
