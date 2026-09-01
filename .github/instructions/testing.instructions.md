---
description: "Use when changing AADB source, tests, exports, UI behavior, layout, prompts, pricing, or other product contracts. Enforces focused validation, red-green regression fences, output-boundary checks, and flaky-test handling."
applyTo:
  - "src/**"
  - "server/**"
  - "mcp-server/**"
  - "scripts/**"
  - "tests/**"
---
# Testing Discipline

- Name the claim and the cheapest check that can falsify it before editing.
- After each bounded task, run that check before widening scope.
- A bug fix requires a red/green fence: reproduce failure on old behavior, then
  pass on the fix. Record both outcomes.
- Verify the changed user output: decode exports, inspect rendered UI, exercise
  interactions, or call the exact API contract as applicable.
- `npm run verify:release` is required before acceptance, but it does not replace
  focused tests.
- Do not retry an unexplained failure. Stop, preserve evidence, and diagnose. If
  flaky, fix or quarantine it explicitly with an owner before treating the gate
  as trustworthy.
- State checks not run and do not broaden a result beyond the tested path,
  population, browser, model, format, region, or revision.
