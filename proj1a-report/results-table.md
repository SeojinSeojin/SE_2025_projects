# D3 — Test results table

One row per test we wrote. "Expected" states what the use case / README
promises — not what the code does — so a FAIL reads as a defect found, not a
mistake made. Keep raw output samples in `proj1a-report/raw-output/`.
Failures are findings: explain them, never hide them.

| Test | Why we tried it | Expected | What happened |
|---|---|---|---|
| `test_rejects_redeeming_more_points_than_available` | UC6 ext 3a: balance must cover request | 400 with available vs. requested | *(run and fill in)* |
| `test_redeem_converts_at_one_cent_per_point` | UC6 step 4: stated conversion rate | 500 points → $5.00 discount | *(run and fill in)* |
| `test_concurrent_redemptions_cannot_double_spend` | UC6 ext 5a: no transaction around read-then-update (`points.js:82–127`) | Second redemption refused | *(expect FAIL — real bug)* |
| `test_earn_rate_matches_readme_ten_percent` | README says 10% of bill; code awards 1 pt/$ (`points.js:195`) | $50 order → 5 points | *(expect FAIL — docs/code disagree)* |
