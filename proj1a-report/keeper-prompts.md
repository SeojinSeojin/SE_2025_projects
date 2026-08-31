# Keeper Prompts — Cross-Model Comparison

Run each prompt **verbatim** in all three LLMs (Claude Code, Gemini CLI,
Copilot/Codex) inside the `proj2` repo directory. Same wording across all
three is what makes the prompt × model comparison table valid for D5/step 8.

---

## KP1 — First contact

```
You are a senior engineer who just joined this project.

In 500 words or less, explain what this codebase's tech stack/framework
is and what the product actually does.

Output format:
1. Tech stack (language, framework, DB, key libraries)
2. What the product does, in plain terms
3. The five files that matter most, ranked, one sentence each on why

Rules:
- Base every claim only on what you find in this repo.
- If you cannot verify a claim from the code, write "UNVERIFIED" instead
  of guessing.
```

---

## KP2 — Code rot anywhere

```
You are a senior engineer auditing this repo for maintenance risk.

Find every place in this codebase where the code is likely to be
rotten or fragile — outdated dependencies, deprecated APIs, TODO/FIXME
comments, or code that depends on something that may no longer exist
(e.g. expired credentials, dead endpoints, unmaintained packages).

Output format: a table with columns:
| File | Evidence of rot | Why it matters |

Rules:
- Cite file and line for every row.
- Do not guess based on the age of the project alone — show the actual
  evidence in the code.
```

---

## KP3 — Build failure triage

```
You are a senior engineer triaging a build failure.

Here is the exact error I hit trying to run this project locally:
<paste the FirebaseAppError stack trace>

Classify this failure: (a) code rot, (b) my local setup, or (c) a real
bug in the project. Give your confidence for each option.

Output format:
1. Classification + confidence (%) for each of the 3 options
2. Root cause, cited to file and line
3. The cheapest fix, in order of effort

Rules:
- Only use evidence from the repo (e.g. LOCAL_SETUP.md, config files) —
  do not assume how Firebase projects "normally" work.
- If the repo doesn't explain something, say so instead of guessing.
```

---

## KP4 — Main feature check (voice ordering)

```
You are a QA engineer evaluating one feature end to end.

The main feature to evaluate is: voice ordering (/api/voice).

Does the code actually implement this well? Walk through the main
scenario end to end and identify any place it would break or behave
unexpectedly.

Output format:
1. Actor, trigger, and main flow (numbered steps, 6 max)
2. Does it work as intended? Yes/Partial/No, with evidence
3. Three weaknesses or missing pieces, each cited to file and line

Rules:
- Cite file and line for every claim about behavior.
- If a step's behavior is unclear from the code, write "UNVERIFIED"
  rather than assuming standard behavior.
```

---

## KP5 — Existing test coverage for that feature

```
You are a QA lead reviewing test coverage for one feature.

Are there any existing tests for the voice ordering feature
(/api/voice)? Evaluate their quality and identify untested edge cases.

Output format:
1. List of existing tests that touch this feature (file + what they
   check), or "NONE FOUND"
2. Quality verdict: strong / weak / missing, with reasoning
3. Any edge cases that are not currently tested

Rules:
- Only count a test as covering this feature if you can point to the
  exact assertion that checks it.
- Do not infer coverage from a test's filename alone.
```

---

## KP6 — Write a test case

```
You are a senior engineer writing tests for naked code.

Write a test case for the voice ordering feature's main success path
(the step described in KP4's main flow).

Output format:
- Test name (as a sentence, e.g. "test_rejects_empty_voice_input")
- The test code itself
- One line: "This proves ..."

Rules:
- Base the test only on the actual function signature and behavior you
  find in the code — do not invent parameters or return values.
- If you must assume something about the environment (e.g. a mocked
  Firebase call), state the assumption explicitly instead of hiding it.
```

---

## KP7 — Gap analysis + test case for the gap

```
You are a QA lead closing coverage gaps.

Based on KP5's findings, pick the single biggest untested edge case
for the voice ordering feature. Explain why it's risky, then write a
test case for it.

Output format:
1. The gap, in one sentence
2. Why it's risky (what could go wrong for a real user)
3. Test case: name, code, and "This proves ..." line

Rules:
- The gap must come from KP5's actual output, not a new guess.
- If no real gap was found in KP5, say so rather than inventing one.
```

---

## KP8 — Feature value / long-run viability

```
You are a product-minded engineer assessing long-term value.

Is the voice ordering feature and the donation service useful and worth maintaining over the
next few years? Consider adoption cost, fragility, and whether it
solves a real user problem.

Output format:
1. Verdict: worth keeping / worth reworking / worth cutting
2. Three pieces of evidence from the code or docs that support the
   verdict
3. One risk that could make this feature costly to maintain long-term

Rules:
- Base the verdict on evidence in the repo (code complexity, external
  dependencies, docs) — not on general opinions about voice features.
- Flag anything you're inferring versus anything you can point to
  directly.
```
