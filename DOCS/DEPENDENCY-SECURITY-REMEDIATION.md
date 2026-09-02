# Dependency Security Remediation Plan

- Status: AI acceptance conformant with justified divergence; human R3 review pending
- Date: 2026-09-01
- Risk: R3 — dependency and supply-chain boundary
- Branch: `security/dependency-audit-triage`
- Base: `main` at `4be6705` (AADB v2.0.4)

## Review Readiness Brief

### Blockers / Critical Findings

- The 2 critical findings are remediated. Two high `image-size` advisories remain
  under the time-bounded exception because no patched release exists.
- Independent human R3 security review is required before merge.
- The production-like telemetry-enabled entry bundle is 484,809 / 500,000 gzip
  bytes, leaving 15,191 bytes of budget headroom.

### Unexpected Discoveries

- A conservative three-package upgrade reduces all findings from 26 to 20 and
  production findings from 6 to 2.
- A compatible toolchain upgrade plus non-force lockfile remediation reduces both
  full and production audits to the same two high findings:
  `pptxgenjs -> image-size`.
- `image-size` has no patched release according to both current npm audit and the
  GitHub advisories.
- PPTXGenJS 4.0.1 marks `image-size` as `browser: false`. Its distributed browser
  module contains an image-dimension helper commented as unused. AADB's PPTX path
  passes an app-generated PNG data URL rather than an uploaded ICNS/JXL/HEIF
  buffer.
- TypeScript-ESLint 8 checks catch bindings that the previous version ignored;
  the lint configuration now makes the existing `caughtErrors: none` policy
  explicit instead of changing unrelated product catches.

### Limitations / Not Tested

- Application Insights initialization was tested against a fake ingestion
  endpoint; delivery to the real production resource was not tested.
- Speech/Avatar verification proves the upgraded browser chunk loads and exports
  the required API; it does not establish a live Azure avatar/WebRTC session.
- PPTX verification covers the single-slide browser export and decoded package;
  it does not exercise every customer-deck slide combination.
- No Docker image, production deployment, Azure mutation, or live application
  check was performed.
- The two unpatched image parser findings are excepted, not fixed.

### Decision Requested

Implement the bounded remediation below, then return for independent acceptance
review. Do not merge or deploy from this plan.

## Measured Baseline

| Tree | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Root, all dependencies | 2 | 19 | 4 | 1 | 26 |
| Root, production only | 0 | 4 | 2 | 0 | 6 |
| Token server, production | 0 | 0 | 0 | 0 | 0 |
| MCP server, production | 0 | 0 | 0 | 0 | 0 |

## Advisory Ownership

| Direct package | Current | Candidate | Finding removed |
| --- | --- | --- | --- |
| `concurrently` | 9.2.1 | 9.2.4 | Critical `shell-quote` chain moves to 1.9.0 |
| `@microsoft/applicationinsights-web` | 3.3.11 | 3.4.3 | High `@nevware21/ts-utils` moves to >=0.14.0 |
| `microsoft-cognitiveservices-speech-sdk` | 1.48.0 | 1.51.0 | High `ws` >=8.21.0 and moderate `uuid` >=11.1.1 |
| `vite` | 5.4.21 | 6.4.3 | Patched development-server and Rollup chains |
| `@vitejs/plugin-react` | 4.2.1 | 4.7.0 | Vite 6-compatible plugin |
| `@typescript-eslint/eslint-plugin` | 6.21.0 locked | 8.44.1 | Patched parser/util chains |
| `@typescript-eslint/parser` | 6.21.0 locked | 8.44.1 | Patched parser/util chains |

All candidate peer/engine ranges include Node 20, ESLint 8.57, TypeScript 5.3,
and Vite 6 as applicable.

## Residual Exception Candidate

GitHub advisories GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq affect all
published `image-size` versions through 2.0.2 and list no patched release. The
vulnerable parsers require crafted ICNS, JXL, or HEIF input that causes an
infinite loop.

A temporary exception is acceptable only if implementation evidence proves:

1. `image-size` is absent from the production browser bundle.
2. AADB's PPTX exports accept only app-generated PNG data URLs.
3. Existing PPTX artifact tests still decode the generated package and verify
   expected slides/content.
4. A network-backed audit gate allows exactly the two advisory IDs above and
  fails on any new critical, high, or moderate production advisory. A separate
  deterministic policy test verifies allowlist shape, exact IDs, owner, expiry,
  and rejection behavior without contacting the registry.
5. The exception has an owner and expires no later than 2026-10-01, or earlier
   when PPTXGenJS/image-size publishes a patched path.

- Exception owner: Arturo Quiroga
- Expiry: 2026-10-01, or the first patched PPTXGenJS/image-size path, whichever
  occurs first
- Review frequency: every PR/release audit and a weekly scheduled audit workflow

## Implementation Tasks

- `SEC-P01`: Update the seven direct dependencies to the candidate versions.
- `SEC-P02`: Apply npm's non-force, package-lock-only remediation and review every
  transitive lockfile change; no `--force` and no semver-breaking automatic fix.
- `SEC-P03`: Add a network-backed dependency-security audit for root all, root
  production, token-server production, and MCP production trees. Permit only the
  two named unpatched image-size advisories; fail closed on new severe findings;
  report registry/transport failure separately. Add deterministic unit tests for
  the policy and allowlist without network access.
- `SEC-P04`: Measure the Vite bundle report and prove `image-size` is absent.
- `SEC-P05`: Add and run three focused tests against the upgraded packages:
  (a) initialize Application Insights with transmission disabled and record a
  synthetic event without exception; (b) dynamically load the Speech SDK and
  verify the Avatar/Speech exports used by `avatarPresenter.ts` exist without
  contacting Azure; (c) generate a real PPTX from an app-style PNG data URL,
  unzip it, and verify expected slide/media entries and labels.
- `SEC-P06`: Run typecheck, lint, build, all deterministic tests, version contract,
  browser smoke, and full `verify:release` once.
- `SEC-P07`: Independent read-only acceptance review against this plan.
- `SEC-P08`: Present a Review Readiness Brief. Keep the PR draft; do not merge or
  deploy without separate approvals.

## Acceptance Criteria

Prerequisite gates before acceptance review:

- `SEC-P03`: network-backed audits and deterministic allowlist-policy tests pass.
- `SEC-P04`: bundle report proves `image-size` is absent.
- `SEC-P05`: telemetry initialization, Speech/Avatar SDK loading, and PPTX
  artifact tests pass at the specified boundaries.

1. Root full audit has zero critical findings.
2. Root production audit has no critical, high, or moderate findings except the
   two named `image-size` advisories.
3. Token-server and MCP production audits remain at zero.
4. No automatic downgrade or `npm audit fix --force` occurs; every lockfile
  change maps to a reviewed direct or transitive dependency chain.
5. The three focused SEC-P05 tests pass and cover telemetry initialization,
  Speech/Avatar exports, and a decoded PPTX artifact.
6. The Vite bundle report confirms `image-size` is absent, and code-path evidence
  confirms PPTX input is an app-generated PNG data URL.
7. The deterministic policy test rejects a non-allowlisted advisory and an
  expired exception; the network audit reports transport failures distinctly.
8. `npm run verify:release` passes in one final execution.
9. No product version, main merge, release tag, deployment, or Azure mutation is
   performed.

## Stop Conditions

Return to Research or Plan if:

- Any direct upgrade requires an unplanned API migration.
- An audit finding remains outside the exact exception.
- `image-size` appears in the browser bundle or receives uploaded bytes.
- A focused user feature fails after an upgrade.
- Any required test is flaky or fails unexpectedly.
- The network-backed audit cannot reach the configured registry. Do not retry
  blindly; classify the transport failure and resume only when registry health is
  established.
- The lockfile changes packages outside the simulated/remediation set without a
  reviewed dependency-chain explanation.

## Rollback

Before merge, delete the isolated branch/worktree. After merge, revert the single
security remediation merge commit. No schema, data, infrastructure, or Azure
migration is involved.

This branch remains independent of draft governance PR #25. Dependency upgrades
will not include, merge, or deploy governance changes; each workstream receives
its own review and approval.

## Implementation Evidence

### Audit outcome

| Tree | Before | After |
| --- | --- | --- |
| Root, all dependencies | 2 critical, 19 high, 4 moderate, 1 low | 2 high (`image-size`, `pptxgenjs`) |
| Root, production only | 4 high, 2 moderate | 2 high (`image-size`, `pptxgenjs`) |
| Token server, production | 0 | 0 |
| MCP server, production | 0 | 0 |

No `npm audit fix --force` or automatic downgrade was used. The lockfile changed
136 package entries within the seven direct upgrade trees and npm's non-force
remediation: Babel/plugin-react, Vite/esbuild/Rollup/PostCSS, TypeScript-ESLint,
Application Insights, Speech SDK, concurrently, and their transitive utilities.

### Focused gates

- Dependency policy passed the approved exception plus five fail-closed cases:
  new package, unknown advisory, critical exception attempt, expired exception,
  and audit transport/tool failure.
- Network audit passed root all/root production with the two exact exceptions;
  token-server and MCP production remained zero.
- Browser bundle report proved `image-size` absent from 2,881 bundled modules.
- Dependency runtime browser test passed: Application Insights initialized
  against a fake endpoint, Speech/Avatar chunk loaded without Azure, and a real
  PPTX downloaded, unzipped, and contained slide XML, PNG media, and expected
  title text.
- Typecheck and lint passed. TypeScript-ESLint 8 began checking four pre-existing
  unused catch bindings; `caughtErrors: none` was made explicit to preserve the
  existing lint policy rather than edit unrelated product code.
- Build, bundle budget, 16 deterministic checks, version contract, and standard
  browser smoke passed in one `&&`-chained acceptance command. Standard smoke
  reported 3 passed and 1 intentional skip; the skipped dependency-runtime spec
  ran and passed separately under its telemetry-enabled build.
- Complete `npm run verify:release` exited zero and ended with the dependency
  runtime browser test passing.
- The telemetry-enabled production-like bundle passed the existing budget at
  1,834,168 / 1,900,000 bytes and 484,809 / 500,000 gzip bytes. The narrow gzip
  margin is residual performance risk, not a security failure.
- The quality workflow now installs `server/package.json` before the expanded
  release gate runs the token-server correlation contract. Governance PR #25
  contains the same clean-checkout prerequisite; this is intentional overlap,
  not a governance merge. Whichever PR merges second must retain one copy during
  conflict reconciliation.

### Residual risk

- Two high advisories remain under the time-bounded exception because no patched
  `image-size` release exists. They are not in the browser bundle, and the tested
  AADB PPTX path supplies app-generated PNG data rather than crafted ICNS/JXL/HEIF.
- This does not prove arbitrary future PptxGenJS call sites are safe. The weekly
  and per-release audit must fail when the exception expires or a new severe
  advisory appears.
- ESLint 8 and several legacy helper packages are deprecated. They no longer
  carry a reported severe finding in this lockfile, and an ESLint 9 migration is
  intentionally outside this security remediation.

## Acceptance Review

An independent read-only AI review returned **Conformant with justified
divergence**. It found no implementation defect and passed AC1-AC9 against the
final execution evidence.

The justified divergences are:

- Two unpatched high `image-size` advisories remain under the named, expiring
  exception and tested bundle/input boundaries.
- TypeScript-ESLint 8's catch-binding behavior is explicitly configured to
  preserve the prior lint contract.
- The telemetry-enabled bundle is within budget but has only 15,191 gzip bytes
  of headroom.

This AI review does not satisfy R3 independent human review. Before merge, a
human reviewer must independently confirm:

1. The exception policy and expiry are acceptable.
2. The PPTX path supplies app-generated PNG data and `image-size` remains absent
   from the browser bundle.
3. The production-like bundle headroom is acceptable.
4. The seven direct upgrades and 136-entry lockfile change are acceptable.

Merge approval and production deployment approval remain separate decisions.
