# Project 1A: Use-case validation notes

## Code link

- Test implementation: [proj1-26F/uc-usecases.test.js](proj1-26F/uc-usecases.test.js)
- Use-case source: [proj1a-report/usecases.md](proj1a-report/usecases.md)
- Existing project test suite: [proj2/tests/example.test.js](proj2/tests/example.test.js)

## Raw test output sample

Command run:

```bash
cd /Users/cynthiadu/Github/CSC510_SE26F/proj2 && npx jest --config='{"rootDir":"..","testEnvironment":"node","testMatch":["**/proj1-26F/*.test.js"]}' --runTestsByPath ../proj1-26F/uc-usecases.test.js --runInBand --verbose
```

Sample output:

```text
 FAIL  ../proj1-26F/uc-usecases.test.js
  UC2 — Log in
    ✓ allows a registered customer to log in with valid credentials (116 ms)
  UC6 — Place an order
    ✕ blocks a negative total before creating an order (21 ms)
  UC9 — Earn and view points
    ✓ awards points for a completed order in the customer points ledger (28 ms)
  UC12 — Handle an incoming order
    ✕ requires a valid kitchen workflow before an order can be marked delivered
  UC19 — Earn and view badges
    ✓ returns earned badge data for a customer with stored stats (4 ms)

  ● UC6 — Place an order › blocks a negative total before creating an order
    Expected: 400
    Received: 201

  ● UC12 — Handle an incoming order › requires a valid kitchen workflow before an order can be marked delivered
    Expected: 400
    Received: 0 calls to status
```

## Results table

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| UC2: Log in | Validate the login flow described as the core customer entry point. | A valid existing user should receive a success response. | Passed. The login endpoint verified credentials and returned the user payload as expected. |
| UC6: Place an order | Confirm the app rejects invalid or unsafe checkout data before creating an order. | A negative total should be blocked with HTTP 400 and no order created. | Failed. The current route accepted the request and returned HTTP 201 because it only validates field presence, not business rules like total >= 0. |
| UC9: Earn and view points | Exercise the points award path when a delivery is completed. | Awarded points should be persisted to the customer ledger. | Passed. The points function created an earned transaction and wrote the updated totals. |
| UC12: Handle an incoming order | Check that restaurant order handling follows the intended kitchen progression. | A delivery status leap such as delivered from a new pending order should be rejected. | Failed. The route accepts a status update without checking the prior state or guards for valid transitions. |
| UC19: Earn and view badges | Confirm the badge evaluation endpoint returns customer stats and badge data. | Badge lookup should return a computed result for a valid customer. | Passed. The badge service resolved stored stats and returned an earned badge object. |

## Failures and explanations

### UC6 failure

The route in [proj2/server/routes/orders.js](proj2/server/routes/orders.js) validates only that required fields exist:

- `restaurantId` is not empty
- `items` is an array with at least one item
- `totalAmount` is numeric
- `customerId` is present

It does not reject negative totals, and it does not confirm the order data matches the menu or an acceptable price range. This matches the project notes in [proj1a-report/usecases.md](proj1a-report/usecases.md), which identify missing validation for negative totals and a lack of deeper checking.

### UC12 failure

The status update route in [proj2/server/routes/orders.js](proj2/server/routes/orders.js) accepts any status in the enum, but it never enforces the allowed workflow between states such as `pending -> confirmed -> preparing -> ready -> out_for_delivery -> delivered`.

This means the app can skip statuses and still return a success response, which fails the intended business rule from UC12 and exposes a blind spot in the production logic.

## Traceability table: tests ↔ use cases

| Test case | Use case | Coverage | Notes |
|---|---|---|---|
| UC2 login success | UC2: Log in | Yes | Covers the happy-path login flow and successful user lookup. |
| UC6 invalid checkout | UC6: Place an order | Yes | Exercises validation around an invalid order total and confirms a bad checkout is rejected. |
| UC9 points award | UC9: Earn and view points | Yes | Tests the core awarding logic when an order is marked delivered. |
| UC12 status workflow | UC12: Handle an incoming order | Yes | Validates that order status changes are not allowed to bypass the order lifecycle. |
| UC19 badge computation | UC19: Earn and view badges | Yes | Confirms badge data is returned for a customer with existing stats. |

## Project’s own tests: coverage and blind spots

The repository’s existing automated tests in [proj2/tests/example.test.js](proj2/tests/example.test.js) mostly cover math-heavy validation helpers and business logic formulas such as points calculations, status transitions, and role checks. They do not strongly cover the actual application use cases in the server routes or the end-to-end user flows that matter for UC2, UC6, UC9, UC12, and UC19.

Main blind spots:

- No real API integration tests for auth, orders, points, or badges.
- No route-level tests for HTTP status codes and response bodies.
- No checks for validation gaps documented in [proj1a-report/usecases.md](proj1a-report/usecases.md), such as negative totals, missing workflow enforcement, or route-level authorization gaps.
- No tests that run the actual Firebase-backed flow used by the app in production, so the project’s own suite can miss runtime behavior that is only visible through live server calls.

In short, the existing suite is useful for helper logic but not sufficient to prove the critical user journeys described by the requirement document. The new UC-focused tests in [proj1-26F/uc-usecases.test.js](proj1-26F/uc-usecases.test.js) are a better match for the use-case-level validation requested in this assignment.
