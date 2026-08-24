# AADB Release Notes

This document summarizes the user-facing enhancements, reliability fixes, operational improvements, and verified release evidence shipped from AADB `v1.1.0` onward.

## Release Summary

| Release | Date | Focus | Production status |
| --- | --- | --- | --- |
| `v1.7.1` | 2026-08-24 | Telemetry privacy and readiness-probe noise correction | Release candidate |
| `v1.7.0` | 2026-08-24 | Authoritative server telemetry and retained logs | Deployed |
| `v1.6.0` | 2026-08-24 | Guided Chat minimal-diff refinement guard | Deployed |
| `v1.5.0` | 2026-08-24 | Human layout guidance | Deployed |
| `v1.4.1` | 2026-08-24 | GPT-5.6 Luna default-model correction | Deployed |
| `v1.4.0` | 2026-08-24 | Error containment, correlated diagnostics, maintainability | Deployed |
| `v1.3.0` | 2026-08-24 | Measured startup performance and bundle controls | Deployed |
| `v1.2.0` | 2026-08-23 | Runtime health and reversible Container Apps releases | Deployed |
| `v1.1.0` | 2026-08-23 | Product versioning, self-deployment, avatar synchronization | Deployed |

## v1.7.1: Telemetry Privacy and Noise Correction

Production verification of `v1.7.0` proved that authoritative events reached Log Analytics and custom spans reached dedicated Application Insights. It also found two collection paths outside the structured event contract:

- HTTP auto-instrumentation recorded every one-second readiness probe.
- Default nginx access/error records could include raw client or full request information.

The patch disables incoming HTTP auto-spans and console duplication, keeps custom model spans, replaces nginx combined access records with a privacy-safe method/path/status/bytes/duration/correlation format, and limits nginx error retention to critical process failures. Application and upstream errors remain represented by privacy-safe structured Node events.

The real production image was exercised with unique user-agent and query-string markers. Neither marker nor the container-network IP appeared in retained runtime logs, while the sanitized route/status record remained. Static contracts enforce these settings.

## v1.7.0: Authoritative Server Telemetry

### Dedicated Azure Monitor boundary

- The production Node proxy uses `aadb-usage-analytics-insights`, backed by `workspace-azurediagramsrgbuvF` with 30-day retention.
- Browser product analytics remain in `aq-app-insights-001`; server traffic is isolated from that shared historical resource.
- Azure Monitor OpenTelemetry initializes before Express and assigns the `aadb-token-server` service role; incoming HTTP auto-spans are disabled to prevent duplicate/probe telemetry and raw-client dimensions.
- The Container Apps environment rollout configures console/system log retention in the same workspace idempotently.

### Authoritative model and route records

- The server records successful upstream responses, upstream failures, and proxy transport failures.
- Fields include correlation ID, rotating client key, model, deployment, operation, API format, status, normalized error class, input/output/cached/total tokens, duration, concurrency at request start, and process peak concurrency.
- Current browser calls send model and operation identity; legacy direct callers remain supported and are classified as deployment/`unspecified`.
- Browser `AI_Model_Usage` events now retain the server correlation ID, enabling joins with server records.
- Image-analysis calls now emit the same model/token telemetry as generation, validation, guides, and chat follow-ups.

### Privacy and operational controls

- Client burst analysis uses a daily rotating HMAC key derived with a Container Apps secret.
- Raw IP addresses and user-agent strings are not retained; nginx uses a privacy-safe access format without IP, user-agent, referer, or query-string fields and retains only critical nginx process errors.
- Prompts, request bodies, model responses, feedback comments, credentials, connection strings, API keys, and access tokens are not logged.
- Health/readiness completion records are suppressed to avoid approximately one retained event per second per replica.
- Server connection strings and HMAC values are Container Apps secrets; candidate revisions contain secret references only.

### Cost and query support

- The LLM cost report maps Luna, Sol, Terra, MAI-Thinking, and Kimi K2.7 in addition to the existing models.
- Joined reports include sessions, workflows, cost per session, and cost per workflow.
- `DOCS/SERVER-TELEMETRY.md` contains KQL for model volume/tokens, concurrency, client bursts, and failure classification.

### Verification

- The authoritative contract validates token parsing, cached tokens, concurrency overlap, 429 classification, correlation, legacy callers, client hashing, probe suppression, and absence of body/raw-client markers.
- The real Alpine/nginx/Node production image built successfully with zero server-package vulnerabilities.
- The telemetry-enabled container returned root, health, and readiness successfully and reached readiness in 2 seconds, within the 48-second startup budget.
- Bicep, shell, candidate rendering, production exclusions, Python cost reporting, TypeScript, Node syntax, and lint checks passed.

## v1.6.0: Guided Chat Refinement Guard

### Minimal-diff contract

- For an existing diagram, the latest Guided Chat request is the only authorization to change topology.
- Existing services, groups, and connections remain the source of truth.
- New service types may be added only when the latest request names the service or a catalog alias.
- Optional security, reliability, observability, caching, and performance improvements remain follow-up suggestions rather than silent additions.
- The system prompt and modification prompt enforce the same refinement contract.

### Deterministic topology review

- The generated result is compared with the live canvas before any snapshot or canvas mutation.
- Services are canonicalized through the Azure service catalog, including keys, display names, and aliases.
- Newly introduced service types absent from the current diagram are classified as explicitly requested or AI-proposed.
- Additional instances of an existing service type remain allowed for replication and multi-region scenarios.
- Generic monitoring intent authorizes monitoring services; explicit aliases such as Redis, Cache, Key Vault, and WAF are recognized.

### User confirmation

When an unrequested service type is detected, Guided Chat pauses and shows a review dialog. The safe action receives initial keyboard focus. The user can:

- **Keep current architecture** — apply nothing.
- **Apply requested changes only** — remove unrequested services and their connections/workflow references, then apply the remaining refinement.
- **Apply all changes** — explicitly approve the complete AI proposal.

### Transparent summaries

- Every applied service addition and removal is listed with a reason.
- Explicit replacement requests are summarized as replacements rather than unrelated add/remove operations.
- AI-proposed additions are labeled as such only after the user approves them.
- Connection additions/removals and group additions/removals are counted.

### Verification

- Six deterministic scenarios cover SQL geo-replication with unsolicited Redis, requested-only sanitization, explicit Key Vault, generic monitoring, explicit Redis, cold-start behavior, and service replacement.
- Production-build Chromium coverage verifies that the canvas does not change before approval.
- Browser coverage exercises Keep Current, Apply Requested Only, and Apply All.
- The review dialog was visually checked in the desktop Guided Chat rail; Redis remained absent from the canvas while review was pending and focus landed on Keep Current.

## v1.5.0: Canvas Layout Guidance

### User experience

- After successful AI generation, regeneration, or refinement, the canvas displays:

  > **Make this layout yours**
  >
  > AI arranged the first draft, but visual grouping and spacing are subjective. Drag services and groups into the positions that best communicate your architecture.

- The message is a compact canvas notice, not a blocking modal.
- The first occurrence stays visible until the user dismisses it.
- Dismissal is remembered in local storage. Later AI updates display the reminder for 10 seconds.
- Start Fresh clears an active notice without erasing the user's seen preference.
- Focus mode suppresses the notice to preserve a diagram-only view.

### Canvas guidance verification

- Release smoke asserts the exact title and copy after deterministic diagram generation.
- The same test verifies dismissal and the persisted seen marker.
- Deployed browser verification covered first-use dismissal and a later 10-second reminder using a mocked model response; it did not consume Azure model capacity.

## v1.4.1: GPT-5.6 Luna Default Fix

### Fixed

- Fresh sessions previously selected the first configured model when several deployments were available. In production, that made GPT-5.1 appear instead of the intended default.
- Startup now prefers GPT-5.6 Luna whenever its deployment is configured.
- Medium reasoning remains the default.
- If Luna is unavailable, the app safely falls back to the first configured model.

### Default-model verification

- Release smoke configures GPT-5.1 and GPT-5.6 Luna together and asserts that the Generate modal starts on Luna.
- Fresh deployed-browser verification confirmed Luna and medium reasoning in both the toolbar and Generate modal.

## v1.4.0: Error Containment and Correlated Diagnostics

### Error containment

- A root React error boundary contains unexpected render failures.
- The fallback explains that saved diagrams remain available and provides a Reload application action.
- Exceptions are sent through the existing Application Insights instance when telemetry is configured.
- A build-time-gated browser harness exercises the real failure path only in release smoke builds; no production crash trigger is exposed.

### Request correlation and structured logs

- Frontend OpenAI proxy calls generate and send an `x-correlation-id` UUID.
- The token server preserves valid incoming IDs, replaces malformed IDs, and returns the effective ID in the response.
- Failed OpenAI diagnostics include the request ID so a user report can be matched to backend logs.
- Structured request-completion records include timestamp, level, service, event, application version, revision, correlation ID, method, path, status, and duration.
- Named structured error events were added for Speech and OpenAI proxy failures.

### Privacy boundary

Structured request logs do not include request bodies, prompts, feedback comments, model responses, API keys, credentials, or tokens. A deterministic regression sends a unique body marker and verifies that it does not appear in logs.

### Maintainability

- Generation prompt lineage, workflow state, model metadata, reference/blueprint artifacts, and begin/reset/restore operations moved from the large root component into `useGenerationSession`.
- The extraction preserves existing behavior and call-site compatibility while establishing a boundary for later incremental cleanup.

## v1.3.0: Performance Foundation

### Deferred feature loading

The initial bundle no longer includes feature-only code until the user invokes it. Deferred features include:

- ELK layout
- PowerPoint export
- ZIP generation
- Canvas capture
- Visio and Draw.io export
- Interactive HTML export
- Blueprint and reference PNG export
- Deployment-guide generation

### Measured result

Using the same standard Vite build method:

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Initial JavaScript, raw | 3,749,390 bytes | 1,785,494 bytes | 52.4% smaller |
| Initial JavaScript, gzip | 1,070,051 bytes | 455,477 bytes | 57.4% smaller |

Production cold-cache measurement found decoded JavaScript decreased from 3,716,675 to 1,753,011 bytes and transfer bytes decreased from 1,253,242 to 545,966 bytes using the same measurement method.

These are measured bundle/transfer results, not a claim about population-level page-load latency. One-shot browser timing varied between releases, so no generalized timing improvement is claimed.

### Guardrails

- The release gate rejects an initial JavaScript chunk above 1,900,000 raw bytes or 500,000 gzip bytes.
- An opt-in Rollup report records chunk and module composition.
- The browser measurement script captures DCL, load, FCP, LCP, CLS, request counts, and JavaScript transfer/decoded bytes.
- Release smoke exercises lazy ELK and interactive HTML export.
- Icon metadata initializes synchronously while SVG files load asynchronously, removing the observed category-list insertion shift.

## v1.2.0: Production Foundation

### Runtime health

- Added shallow `/api/health` and `/api/ready` endpoints that report application version without calling external Azure dependencies.
- Added startup, readiness, and liveness probes for web and MCP Container Apps.
- Probe access logging is disabled for health/readiness routes to avoid high-volume operational noise while ordinary request logging remains enabled.

### Reversible releases

- Images use immutable `v<version>-<git-sha>` tags.
- The Container App uses managed identity and resource-scoped `AcrPull` instead of stored registry credentials.
- Runtime OpenAI credentials use a Container Apps secret reference rather than a plaintext environment value.
- Production remains on the previous revision until the candidate passes direct readiness, health, and version checks.
- The prior healthy revision remains active at 0% traffic as an explicit rollback target.
- The deployment script avoids redundant secret and registry writes, reducing Container Apps app-scope update conflicts.
- Probe thresholds were corrected to the target Container Apps API limit.

### Release confidence

- `npm run verify:release` became the unified local and CI gate.
- The gate covers TypeScript, full ESLint, production build, deterministic regressions, version consistency, production exclusions, bundle budget, and Playwright smoke.
- Pull requests, pushes to `main`, and the manual Azure workflow use the same release gate.
- Browser smoke uses synthetic model configuration and intercepts `/api/openai`; it does not consume Azure model capacity.

## v1.1.0: Versioning, Self-Deployment, and Narration

### Product and deployment versioning

- The application header displays the running version.
- `/version.json`, telemetry, deployment registration, and Container Apps `APP_VERSION` derive from the root package version.
- Supported deployment paths reject an equal or older live version unless an explicit same-version override is supplied.

### Self-contained destination-subscription deployment

- The default Azure Developer CLI path can provision Microsoft Foundry, GPT-5.6 Luna, managed-identity inference access, Speech, ACR, Container Apps, Log Analytics, and Application Insights in the destination subscription.
- GPT-5.6 Luna with medium reasoning is the default model behavior.
- Greenfield Foundry inference is keyless; the generated application receives the endpoint and deployment name without an API-key output.
- Model catalog and quota checks fail before provisioning when the selected model/SKU/capacity is unavailable.
- Bring-your-own-AI remains available as an advanced deployment mode.

### Build-configuration fix

- The greenfield pre-package hook now fails closed when required endpoint/model values are missing or malformed.
- Packaging no longer silently produces an AI-disabled browser image.
- Browser verification confirmed a destination-owned deployment can generate a diagram through the UI.

### Avatar synchronization

- Workflow narration waits for the WebRTC media clock before advancing.
- Spoken workflow steps, captions, and highlighted services remain synchronized instead of the visual highlight running ahead.

## Current Release Validation

For `v1.7.1`, the verified release gate includes:

- Application and Vite TypeScript checks
- Full ESLint with zero warnings
- Production build
- Initial-bundle budget
- 13 deterministic regression checks
- Version contract
- Two Chromium smoke tests, including deterministic generation, canvas guidance, refinement review decisions, lazy features, and root error containment
- Subscription-scope Bicep validation and isolated what-if
- Candidate-revision health and version checks before production traffic moves

Production remains on `v1.7.0` until `v1.7.1` completes validation and staged rollout.

## Remaining Boundaries

- The root error boundary is shipped; feature-level recovery boundaries for generation, validation, and export remain future incremental work.
- `App.tsx` is still large. `useGenerationSession` is the first extraction, not a completed root-component decomposition.
- Public-demo request, token, concurrency, throttling, and authenticated-partner policies still require an explicit product and cost decision.
- WAF validation remains a diagram-only design-time signal, not an audit of deployed Azure resources.
- Browser performance timing samples are environment-specific; bundle-size reductions are measured, but one-shot timing samples are not generalized to all users.

For deployment commands and resource-level proof, see [`.azure/deployment-plan.md`](../.azure/deployment-plan.md).
