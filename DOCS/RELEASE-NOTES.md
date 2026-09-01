# AADB Release Notes

This document summarizes the user-facing enhancements, reliability fixes, operational improvements, and verified release evidence shipped from AADB `v1.1.0` onward.

## Release Summary

| Release | Date | Focus | Production status |
| --- | --- | --- | --- |
| `v2.0.4` | 2026-09-01 | Right-click no longer discards the diagram; diagram autosave and restore | Deployed |
| `v2.0.3` | 2026-09-01 | Private Connectivity group replaces per-resource Private Endpoint nodes | Deployed |
| `v2.0.2` | 2026-09-01 | Fixed blank exports triggered from the Reports pane | Deployed |
| `v1.9.0` | 2026-08-25 | Prompt refresh and pricing accuracy | Deployed |
| `v1.8.0` | 2026-08-25 | Semantic relationships and private connectivity | Deployed |
| `v1.7.2` | 2026-08-24 | Guided Chat helper model correction | Deployed |
| `v1.7.1` | 2026-08-24 | Telemetry privacy and readiness-probe noise correction | Deployed |
| `v1.7.0` | 2026-08-24 | Authoritative server telemetry and retained logs | Deployed |
| `v1.6.0` | 2026-08-24 | Guided Chat minimal-diff refinement guard | Deployed |
| `v1.5.0` | 2026-08-24 | Human layout guidance | Deployed |
| `v1.4.1` | 2026-08-24 | GPT-5.6 Luna default-model correction | Deployed |
| `v1.4.0` | 2026-08-24 | Error containment, correlated diagnostics, maintainability | Deployed |
| `v1.3.0` | 2026-08-24 | Measured startup performance and bundle controls | Deployed |
| `v1.2.0` | 2026-08-23 | Runtime health and reversible Container Apps releases | Deployed |
| `v1.1.0` | 2026-08-23 | Product versioning, self-deployment, avatar synchronization | Deployed |

## v2.0.4: Right-Click Data Loss and Diagram Autosave

Reported symptom: generate a diagram, make edits, right-click, let go, and the diagram is gone as though the app had refreshed, losing all work.

### The trigger

The canvas hint actively teaches "Right-click + drag to pan". Dispatching a real right-click and reading whether the app suppressed the resulting native menu showed the guard was incomplete:

| Right-click target | Native browser menu suppressed |
| --- | --- |
| Empty pane | Yes, but only incidentally, as a side effect of right-drag panning |
| Edge | Yes, explicitly, so the app's own Edge Direction menu can open |
| Group box | **No** |
| Service node | **No** |

On a node or group the browser's own menu opened instead. Its top entries in Chrome and Edge are Back, Forward and Reload, and a press-drag-release gesture activates whatever sits under the cursor on release. Group boxes are large — in a small four-service diagram they covered 15% of the visible canvas, and far more when zoomed in to edit — so aiming at empty canvas frequently landed on one. Nodes, groups and multi-selections now suppress the native menu; the intentional Edge Direction menu is unaffected.

This was not a recent regression. Right-drag panning dates to the first commit, and the hint teaching the gesture shipped on 2026-07-02.

### Why it destroyed the work

Separately from the trigger, nothing about a diagram was persisted. Only preferences were written to browser storage — dark mode, export history, hints, model settings. Services and connections were saved nowhere, and there was no unsaved-work prompt, so any reload discarded everything silently. Suppressing one menu removes one trigger; keyboard reload, a trackpad back-swipe, closing the tab and a crash all remained.

### Autosave and restore

The working diagram is now written to a dedicated IndexedDB database a second after the last change, debounced so dragging a node writes once on release rather than once per frame. IndexedDB rather than local storage because a diagram carrying pricing metadata on every node is large, and a 5MB ceiling would fail on exactly the diagrams most worth recovering. A dedicated database rather than a new store inside version history, so a record overwritten constantly can never put deliberately saved snapshots at risk.

Restore is offered rather than applied. Reloading to obtain a clean canvas is a legitimate intent, so the canvas opens empty and a banner offers the autosaved diagram by name and save time. Clearing the diagram clears the autosaved copy with it, so a deliberate discard is never undone, and the banner is suppressed when a diagram arrives from a shared version link. Restore returns services, connections, groups, title block, workflow and the originating prompt; validation results and Guided Chat history are not restored.

### Verification

`npm run verify:release` passed with type checks, full lint, production build, bundle budget, 15 deterministic checks, version contract, and three Chromium tests. Both fixes were measured in a browser rather than reviewed from the diff. After the context-menu change, group, service node and pane all reported the native menu suppressed while the Edge Direction menu still opened. Autosave was exercised end to end: a six-node diagram produced a stored record of six nodes and two edges under the correct name, a reload presented the restore banner, restoring returned all six nodes, two edges and the title block, and clearing the diagram removed the record so a later reload offered nothing. The user separately confirmed both behaviors by hand across the right-click and autosave cases.

## v2.0.3: Private Connectivity Group

The v1.8.0 semantic-relationships work correctly modeled each protected resource with its own `Private Endpoint - <resource>` node and association edges. At scale — 4 to 8 or more protected resources behind private endpoints, the shape of the app's own "Private endpoints for PaaS" and "Zero trust enterprise network" example prompts — this produced enough nodes and edges to dominate the diagram.

### What changed

When a model's raw output still contains the old per-resource `Azure Private Link` connector pattern, the deterministic post-processing repair now folds it into one shared group instead of N nodes:

- One Virtual Network and one Private DNS Zone, in a single group, annotated with a `note` listing every protected resource by name.
- One named `Private Link - <resource>` node per protected resource, for at-a-glance identification, placed in the same group.
- Zero edges from the group to anything — group membership plus the note already convey the relationship, so nothing fans out across the canvas.
- The group is reused rather than always freshly created: if the Virtual Network already belongs to a group, that group gains the note rather than a duplicate box being created.

This is enforced at the main generation contract, the modification/refinement prompt, and the App.tsx "Apply Recommendations" prompt, plus the deterministic repair as a backstop — the same prompt-plus-repair pattern established for the Front Door WAF fix in v1.8.0, because models do not reliably comply with prompt instructions alone.

### Known trade-off, disclosed not hidden

Removing edges into the group removes the layout engine's rank signal for it, so the group can land in a less obviously related position than the old edge-connected version. And while node/edge count is now flat regardless of N, the group's own height still grows with the number of protected resources — measured 1003px tall at 6 resources versus 768px for a same-size normal group, the tallest element in the diagram at that scale. This trades scattered canvas clutter for one taller box; it does not eliminate growth outright. "Collapse Groups" only shrink-wraps a box to fit its content today; it does not hide children, so there is no existing escape hatch if this box's height becomes a problem at larger scale.

### Verification

`npm run verify:release` passed (type checks, full lint, production build, bundle budget, 15 deterministic checks, version contract, three Chromium e2e tests). The deterministic suite exercises the fold at 2 and 6 protected resources against fixtures matching the previously reported clutter, asserting exactly the expected node/edge counts and zero orphan-service false positives. Live-verified against the deployed v2.0.3 production app using its own "Private endpoints for PaaS" and "Zero trust enterprise network" example prompts: both generations produced clean diagrams with direct, clearly-labeled private-access edges and no per-resource Private Endpoint clutter.

## v1.9.0: Prompt Refresh and Pricing Accuracy

### Guided Chat sample prompts

The chat prompts had not been reviewed against the current catalog. Microsoft Fabric accounted for 20 of 95 supported services and Microsoft Foundry was in the catalog, yet no prompt mentioned either, and IoT had no coverage at all.

Starters now include a Fabric analytics pipeline and a private Foundry assistant that exercises VNet Integration with per-resource private endpoints. Advanced patterns add a zero-trust data platform, a connected-factory IoT pipeline, and a Fabric medallion lakehouse. Every service named in a prompt was verified to resolve in the icon catalog.

Refinement chips were corrected where they taught Azure behavior the app now models properly: a WAF is offered as a policy for the application tier rather than a hop in front of it. Context-aware suggestions gained VNet Integration when endpoints exist without a virtual network, Azure DNS private zones when endpoints cannot resolve, and Azure Backup for data tiers.

### Icon resolution

The generation prompt advertises catalog display names, but six entries did not resolve through their own lookup because their catalog key and aliases differed: Azure Functions, Azure Kubernetes Service, Azure Cache for Redis, Content Delivery Network, Azure Data Factory, and Azure Data Lake Storage. Those names skipped exact icon mapping and fell through to fuzzy category search. Lookup now accepts display names, and a regression asserts all 95 entries resolve by key and display name without shadowing.

### Pricing service names

Pricing snapshots are stored under the Azure Retail Prices `serviceName`. Six services pointed at a name the API does not publish, so they loaded an empty snapshot and silently degraded to a documented estimate. The Retail API returns zero items for `Azure Cache for Redis` and 89 for `Redis Cache`; the same mismatch affected Functions, Stream Analytics, Event Hubs, Service Bus, and Event Grid.

Load Balancer and Traffic Manager publish only Global and edge-zone meters, so the per-region refresh filter returned nothing for them; both are now fetched as global services. AML Managed Compute had no mapping to `Azure Machine Learning`, and Power BI Embedded had no snapshot stem at all.

### Meter selection

Two meter families produced confidently wrong prices. Redis prices one SKU as both `C1 Cache` and `C1 Cache Instance`, the latter being a single node at half the rate. Load Balancer, SignalR, SQL Database, Storage, and Foundry Tools each publish a promotional `- Free` meter beside a real one, and “cheapest wins” always selected the free variant.

Tier selection now demotes a meter that only restates another with an ` Instance` or ` - Free` suffix. The rule is confined to that exact shape, so Azure Backup, Key Vault, and Microsoft Defender keep their `Instance` meters, and standalone free SKUs such as PostgreSQL `Compute - Free` are unaffected. Power BI Embedded sells A-series capacity nodes rather than a `Standard` SKU, so its default tier is now `A1`. Traffic Manager publishes only per-query and per-endpoint rates, so it defers to its documented range like other services without a resource meter.

### Data and honesty

All 14 regional snapshots were re-fetched from the Azure Retail Prices API on 2026-08-25. Services resolving to real pricing rose from 35 to 45 with no remaining gaps. Azure Managed Grafana and Batch Compute Pool publish no Retail API meters under any name, so both now declare that they have no pricing data and display their documented range instead of implying a measured price.

### Verification

`npm run verify:release` passed with type checks, full lint, production build, bundle budget, 15 deterministic checks, version contract, and three Chromium tests. Live generations confirmed the Fabric starter renders seven official Fabric icons with capacity-consumption costs, the zero-trust starter produces three per-resource private endpoints with no invalid virtual-network endpoint, and Load Balancer, SignalR, SQL Database, App Service, and Storage all resolve to real meters with no zero-priced tiers.

## v1.8.0: Semantic Relationships and Private Connectivity

Microsoft documentation review confirmed that a Front Door WAF is a standalone policy associated with Front Door rather than an upstream traffic hop, and that a private endpoint is associated with one protected resource rather than acting as middleware. Generated diagrams previously modeled both as request-flow hops.

### Relationship model

Connections now distinguish three kinds of meaning:

- **Traffic** — `sync`, `async`, and `optional` remain directional and animated.
- **Association** — policies, private endpoints, and VNet Integration render as neutral dashed, arrowless, unanimated relationships.
- **Containment** — resource placement inside a network boundary renders as a teal dotted, arrowless relationship.

Semantic relationships are excluded from directional ranking in both the Dagre and ELK layout paths, so they cannot reorder the request path.

### Deterministic repairs

Post-processing repairs model output before layout:

- A WAF becomes `Front Door WAF Policy` associated with Azure Front Door, and any policy hop is redirected so Front Door → origin traffic is preserved.
- A generic `Azure Private Link` connector becomes one `Private Endpoint - <resource>` node per protected resource, each associated with its resource.
- When a Private Link connector previously sat between two services, the direct application traffic edge is reconstructed rather than dropped.
- Virtual networks, subnets, DNS, and Front Door are excluded as protected-endpoint targets, so `Private Endpoint - Virtual Network` can no longer be produced.
- Customer-owned endpoints receive Virtual Network containment; a Front Door-managed origin endpoint does not.
- An App Service that privately reaches a protected resource receives an explicit VNet Integration association.

### Generation and refinement contract

The generation prompt and the Guided Chat minimal-diff contract now state that associations and containment are not traffic hops, that a Virtual Network is never a private endpoint target, that App Service outbound private access uses VNet Integration rather than an inbound endpoint, and that a standalone Private Link node is reserved for a provider-side Private Link Service.

### Icon and interchange consistency

`Private Endpoint` is a distinct catalog entry using the official Private Endpoints icon, while `Azure Private Link` retains the Private Link icon for Private Link Service. Icon lookup resolves the asset folder independently of the semantic category. Association and containment are preserved across the canvas, HTML, Draw.io, Visio, az prototype interchange, and the MCP tool schemas, layout, SVG renderer, HTML renderer, and React Flow scene export.

### Layout refinement

Four human before/after repositioning samples were compared. In every sample the topology was unchanged and only geometry moved, which isolated the defect to group packing rather than group placement or label placement. The samples showed protected-resource groups widened and each endpoint separated into a second column.

Groups containing customer-owned endpoint associations now pack each protected resource and its endpoint as a horizontal pair, place shared network sources in a separate row, and leave a label corridor between columns. A Front Door-managed App Service endpoint keeps compact vertical packing. Containment edges fanning out from one Virtual Network receive distinct centered routing lanes.

### Verification

`npm run verify:release` passed with type checks, full lint, production build, bundle budget, 15 deterministic checks, version contract, and three Chromium tests. Deterministic coverage asserts WAF association, per-resource endpoints, containment, VNet Integration, preserved traffic, prompt contract text, pair packing, managed-endpoint packing, and containment lane separation. A live measured rerender of a three-endpoint fixture reported zero containment label overlaps.

## v1.7.2: Guided Chat Helper Model Correction

Commit `e1048df` introduced change-specific Guided Chat suggestions on 2026-07-14 and hard-coded Grok 4.1 Fast as the sole “cheap/fast” utility candidate. No model-quality evaluation or product decision was recorded with that choice. Because the call was automatic and independent of the user's selected architecture model, model dashboards made hidden helper traffic look like broad Grok adoption.

Verified 30-day browser telemetry from the workspace connected to `aq-app-insights-001` showed:

- 1,782 Grok `chat_followups` calls, 1,103,258 tokens, 466 anonymous browsers, and 628 sessions
- 7 Grok architecture-generation calls and 8 validation calls
- therefore 1,782 of 1,797 Grok calls (99.2%) were hidden utility traffic, not explicit model selection

The helper policy now explicitly selects GPT-5.6 Sol with low reasoning. If Sol is not configured, dynamic suggestions fail soft to the existing static rule-based chips; the app does not silently choose another model. Telemetry separates automatic post-change suggestions (`chat_followups_auto`) from user-triggered “What would you add?” calls (`chat_followups_best`).

Deterministic policy coverage asserts Sol/low, rejects Grok, and verifies both operation labels. Production-build Chromium asserts that follow-up requests use the Sol deployment, Responses API, and low reasoning body.

Production verification observed both paths after cutover. Authoritative telemetry recorded five `chat_followups_auto` calls and one `chat_followups_best` call, all using GPT-5.6 Sol via the Sol deployment and Responses API. Browser telemetry reported low reasoning for both operations. Production `v1.7.2` is Healthy and Provisioned at 100% traffic with `v1.7.1` retained at 0% as rollback.

## v1.7.1: Telemetry Privacy and Noise Correction

Production verification of `v1.7.0` proved that authoritative events reached Log Analytics and custom spans reached dedicated Application Insights. It also found two collection paths outside the structured event contract:

- HTTP auto-instrumentation recorded every one-second readiness probe.
- Default nginx access/error records could include raw client or full request information.

The patch disables incoming HTTP auto-spans and console duplication, keeps custom model spans, replaces nginx combined access records with a privacy-safe method/path/status/bytes/duration/correlation format, and limits nginx error retention to critical process failures. Application and upstream errors remain represented by privacy-safe structured Node events.

The real production image was exercised with unique user-agent and query-string markers. Neither marker nor the container-network IP appeared in retained runtime logs, while the sanitized route/status record remained. Static contracts enforce these settings.

Production verification sent one bounded Luna request. The retained event and custom Application Insights span agreed on 12 input, 7 output, and 19 total tokens and carried the same correlation ID. The new revision emitted zero incoming HTTP spans. The old `v1.7.0` rollback replica was the sole source of post-cutover readiness spans and was deactivated; healthy `v1.6.0` remains active at 0% as rollback.

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

### Server telemetry verification

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

### Refinement guard verification

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

For `v1.7.2`, the verified release gate includes:

- Application and Vite TypeScript checks
- Full ESLint with zero warnings
- Production build
- Initial-bundle budget
- 13 deterministic regression checks
- Version contract
- Two Chromium smoke tests, including deterministic generation, canvas guidance, refinement review decisions, lazy features, and root error containment
- Subscription-scope Bicep validation and isolated what-if
- Candidate-revision health and version checks before production traffic moves

Production `v1.7.2` is Healthy and Provisioned at 100% traffic. `v1.7.1` remains Healthy and Provisioned at 0% as rollback.

## Remaining Boundaries

- The root error boundary is shipped; feature-level recovery boundaries for generation, validation, and export remain future incremental work.
- `App.tsx` is still large. `useGenerationSession` is the first extraction, not a completed root-component decomposition.
- Public-demo request, token, concurrency, throttling, and authenticated-partner policies still require an explicit product and cost decision.
- WAF validation remains a diagram-only design-time signal, not an audit of deployed Azure resources.
- Browser performance timing samples are environment-specific; bundle-size reductions are measured, but one-shot timing samples are not generalized to all users.

For deployment commands and resource-level proof, see [`.azure/deployment-plan.md`](../.azure/deployment-plan.md).
