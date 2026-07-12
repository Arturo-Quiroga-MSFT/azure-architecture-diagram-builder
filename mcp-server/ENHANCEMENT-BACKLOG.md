# AADB MCP Server — Prioritized Enhancement Backlog

> **For:** the implementing coding agent (GHCP / Opus 4.8) working in the `AZURE-DIAGRAMS` repo.
> **Scope:** `mcp-server/` (the Azure Architecture Diagram Builder MCP server).
> **Goal:** evolve AADB from a working-but-basic MCP server into a hardened, structured, agent-callable capability that Microsoft Scout (and other MCP clients) can rely on for the full **design → validate → harden → cost → IaC** loop.
> **Created:** 2026-07-02 · Author context: Sr PSA (EPS), FY27 agentic-AI alignment.

---

## ✅ Status (updated 2026-07-04)

**The entire P0 tier is shipped, deployed to the Scout MCP endpoint, and verified live.**

| Item | Status | Notes |
| --- | --- | --- |
| **P0-1** `estimate_costs` live-pricing parity | ✅ Shipped | Distilled Azure Retail Prices sidecar (build-time `sync-pricing-data.mjs`), numeric low/expected/high, region + PAYG/reserved term, by-category totals |
| **P0-1a** representative-SKU (trustworthy `expected`) | ✅ Shipped | `expected` = a typical-deployment SKU (App Service P1v3, Redis C1, SQL S3, VM D2s v4, AKS Standard, APIM Basic, AI Search S1) — not a median-of-all-SKUs |
| **P0-1b** Microsoft Fabric F-SKU capacity | ✅ Shipped | Numeric monthly reservation (F2/F8/F64). AI (Foundry) + per-GB storage intentionally remain catalog ranges (usage-dominated → a fixed monthly would mislead) |
| **P0-2** `generate_bicep` | ✅ Shipped | Deployable Bicep with WAF secure defaults pre-set + structured `findingsResolved`; `az bicep build` verified |
| **P0-3** structured outputs | ✅ Shipped | `validate_architecture`, `estimate_costs`, `get_waf_rules` return typed `structuredContent` (+ `outputSchema`) with a human summary |
| **P1-5** tool annotations | ✅ Shipped (early) | read-only/idempotent/openWorld annotations added to the P0-3 tools |

**Next up:** P1 tier — `suggest_remediations`, `harden_architecture`, `import_arm`/`import_diagram_image`, portable `render_diagram` output, remaining annotations.

---

## ✅ Update (2026-07-08)

- **Diagram rendering overhauled** (P1 orthogonal edge routing, P2 non-overlapping
  two-level grouped layout, P3 node polish: two-line names, inline-SVG icon
  fallbacks, smarter badges). SVG + HTML output are now at parity.
- **MCP server decoupled** into its own Azure Container App / FQDN, deployed via
  `scripts/deploy-mcp.sh` (no azd). Verified live: `/healthz` 200, `/mcp` Bearer-auth
  enforced, authenticated `initialize` round-trip OK.
- See **`DEPLOYMENT.md`** for the full deployment + rendering reference.

---

## ▶️ START HERE (do this first)

**Work in this exact order: `P0-1` → `P0-2` → `P0-3`.**
1. **`P0-1`** — `estimate_costs` live-pricing parity.
2. **`P0-2`** — new `generate_bicep` tool (WAF config fixes pre-set).
3. **`P0-3`** — structured outputs (`outputSchema` / `structuredContent`).

**After *each* item:** `npm run build`, then **run the MCP Inspector locally** and exercise the changed tool before moving to the next item. Do not batch all three and test once — validate incrementally so regressions are caught early. Only proceed to P1 once P0-1→P0-3 pass in the Inspector (and, if possible, a Scout smoke test).

```
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## How to work this backlog

- Items are grouped **P0 → P2** by value/effort. Do P0 first; each item is independently shippable.
- Each item lists: **Problem → Change → Acceptance criteria → Likely files → Test**.
- **Preserve the two things that make this server good:** (1) `validate_architecture` stays **deterministic (no LLM)**; (2) the server stays **ground truth**, not an orchestrator (Scout does the reasoning).
- After each item: `npm run build`, run the MCP Inspector locally, and (where possible) a Scout smoke test against the deployed ACA endpoint.
- Keep both transports working: **stdio** (local) and **Streamable-HTTP** (remote/ACA).

### Current state
8 tools in `src/index.ts`: `list_services`, `validate_architecture`, `estimate_costs`, `generate_bicep`, `generate_manifest`, `get_waf_rules`, `render_diagram`, `export_reactflow_scene`.
The observations below drove this backlog (most are now addressed — see the Status table above):
- **Costs are catalog *ranges*, not live prices.** `estimate_costs` returns `info.costRange` strings (e.g. "$24–$29,185/mo"); several services report "no catalog data." The **web app already has a live per-region Azure Retail Prices engine** (`npm run pricing:refresh`, PAYG/Reserved, Fabric) — the MCP tool should reach parity.
- **No IaC/Bicep tool.** `generate_manifest` emits an `az prototype` interchange manifest, but there is no tool that emits deployable **Bicep** with WAF config fixes pre-set. Scout sessions repeatedly *promise* Bicep and stop.
- **"Harden" is not a tool.** The 52→65 improvement in `SCOUT/test-1.md` was Scout's LLM reasoning + re-validate. There's no deterministic remediation/harden tool.
- **Outputs are `type: 'text'` JSON strings.** No MCP `outputSchema` / `structuredContent`, no **tool annotations**, no **resources**, no **prompts**.
- **`render_diagram` returns SVG/HTML text**; Scout writes local files. For portability, also return **image content / a hosted URL**.
- **Auth is a single Bearer token.** Fine for pilot; not enough for enterprise multi-user Scout.

---

## P0 — Close the end-to-end loop (highest value)

### P0-1 · `estimate_costs` → live pricing parity
- **Problem:** Range strings are too vague for real decisions; "no catalog data" for Redis, AI Search, etc.
- **Change:** Back `estimate_costs` with the web app's live pricing source (pre-fetched Azure Retail Prices JSON or shared module). Add params: `term` (`payg` | `reserved1yr`), keep `region`, honor `tier`/`quantity`. Return **numeric** per-service `monthlyCost` (low/expected/high), currency, `pricesAsOf`, and a real total + by-category totals. Support **Microsoft Fabric** capacity (F-SKU) and OneLake usage as the web app does. Flag services still lacking data explicitly.
- **Acceptance:**
  - Returns numeric costs (not just strings) for catalog services with pricing.
  - `region` + `term` change the numbers; `pricesAsOf` present.
  - No regression when pricing data is missing (graceful `hasPricingData: false`).
- **Likely files:** `src/index.ts` (tool), `src/serviceCatalog.ts`, new `src/pricing.ts` (or import web-app pricing data), `scripts/` (pricing refresh reuse).
- **Test:** call with a RAG stack in `eastus2` PAYG vs `reserved1yr`; verify deltas and totals.

### P0-2 · New tool `generate_bicep` (deployable IaC with WAF fixes pre-set)
- **Problem:** The design→deploy loop dead-ends; the 6 "config-level" WAF findings (`SCOUT/test-1.md`) can't be drawn and are never emitted as code.
- **Change:** Add `generate_bicep` that takes the same `{services, connections, groups}` shape and emits **Bicep** with secure defaults pre-set: `httpsOnly: true`, `minTlsVersion: '1.2'`, system-assigned **managed identity**, Key Vault `enableSoftDelete` + `enablePurgeProtection`, App Service health check path, autoscale rules, and geo/backup where applicable. Return the Bicep as text **and** a structured list of which WAF findings each setting resolves.
- **Acceptance:**
  - Produces `main.bicep` (or modules) that `az bicep build` parses without error.
  - Each of the 6 config-level findings maps to a concrete property in the output.
  - Optional `iacTool: terraform` stub acceptable but Bicep is the priority.
- **Likely files:** new `src/bicepGenerator.ts`, `src/index.ts`, reuse `serviceCatalog.ts` mappings.
- **Test:** feed the hardened RAG design; `az bicep build` the output; confirm the 6 settings present.

### P0-3 · Structured outputs (`outputSchema` + `structuredContent`)
- **Problem:** Everything is `type: 'text'` JSON — agents parse prose. Fragile and non-composable.
- **Change:** Add MCP **`outputSchema`** to each tool and return **`structuredContent`** alongside a short human summary. Start with `validate_architecture` (score, findings[], patternsDetected), `estimate_costs` (line items, totals), `get_waf_rules`.
- **Acceptance:** MCP Inspector shows typed structured output; existing text summary retained for chat UX.
- **Likely files:** `src/index.ts` (all tools), shared zod output schemas.
- **Test:** Inspector validates output against schema; Scout still renders summaries.

---

## P1 — Deterministic hardening + brownfield inputs

### P1-1 · New tool `suggest_remediations`
- **Problem:** Remediation today relies on the LLM re-interpreting findings.
- **Change:** Deterministic tool: input `{services, connections}` (or a prior validation result) → output **structured, ranked remediations** (ruleId, pillar, severity, concrete fix, whether it's *topology* vs *config*, and the estimated score delta if applied).
- **Acceptance:** For the sample RAG design, returns the same fixes seen in `test-1.md`, tagged topology vs config.
- **Likely files:** `src/wafDetector.ts` (expose remediation mapping), `src/index.ts`.
- **Test:** compare output to `SCOUT/test-1.md` findings table.

### P1-2 · New tool `harden_architecture`
- **Problem:** No one-call "improve + re-score."
- **Change:** Apply the *topology-level* remediations (add cache, backup, geo-replica, managed-identity edges) → return the **new `{services, connections}` + before/after score + change log**. Leave config-level fixes to `generate_bicep`.
- **Acceptance:** Reproduces the 52→65 movement deterministically on the sample; clears `no-cache`, `no-backup`, `single-database` patterns.
- **Likely files:** `src/wafDetector.ts`, new `src/hardener.ts`, `src/index.ts`.
- **Test:** validate → harden → validate; assert score increase + patterns cleared.

### P1-3 · New tools `import_arm` and `import_diagram_image`
- **Problem:** Scout conversations are greenfield-only; the web app already imports ARM + images.
- **Change:** `import_arm` (ARM/Bicep JSON → `{services, connections, groups}`); `import_diagram_image` (image → same shape, reusing the app's vision mapping). Enables **brownfield** "analyze what I have → validate → harden."
- **Acceptance:** A sample ARM template round-trips into a diagram that validates.
- **Likely files:** new `src/importArm.ts`, `src/index.ts` (image tool may proxy the web-app service).
- **Test:** import a known ARM export; verify service/connection extraction.

### P1-4 · `render_diagram` portable output
- **Problem:** Returns SVG/HTML text; Scout writes local files — breaks for other clients.
- **Change:** Add option to return an **MCP image content block** (base64 PNG/SVG) and/or a **hosted URL** (persist to Blob and return the link). Keep raw SVG/HTML for markdown embedding.
- **Acceptance:** A non-Scout MCP client receives a viewable image without local file access.
- **Likely files:** `src/svgRenderer.ts`, `src/htmlRenderer.ts`, `src/index.ts`.
- **Test:** call via Inspector; confirm image renders inline.

### P1-5 · Tool annotations
- **Problem:** Agents can't reason about tool safety.
- **Change:** Add MCP annotations — all current tools are `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`. `generate_bicep`/`generate_manifest` are read-only (produce artifacts, don't deploy).
- **Acceptance:** Annotations visible in Inspector; no destructive tools mislabeled.
- **Likely files:** `src/index.ts`.

---

## P2 — Trust, surfacing, and quality

### P2-1 · MCP resources (saved diagrams/scenes)
- **Change:** Expose saved diagrams / React Flow scenes / manifests as MCP **resources** (the web app has version history + cloud sync). Lets agents *reference* a design by URI instead of re-sending full JSON each turn.
- **Acceptance:** `resources/list` + `resources/read` return a saved scene.

### P2-2 · MCP prompt template for the golden path
- **Change:** Ship a **prompt** ("Design → validate → harden → cost → Bicep") so Scout/clients get a one-click guided flow.
- **Acceptance:** Prompt appears in `prompts/list` and drives the full sequence.

### P2-3 · `ground_with_learn` (or compose existing Learn grounding)
- **Change:** Expose the web app's Microsoft Learn MCP grounding so `generate_bicep` reflects current API versions/schemas; return cited pages.
- **Acceptance:** Generated Bicep includes a "grounded with Microsoft Learn" citation list; degrades gracefully if docs unavailable.

### P2-4 · Auth evolution → Entra ID / OAuth (+ path to Entra Agent ID)
- **Problem:** Single Bearer token caps enterprise adoption.
- **Change:** Add **Entra ID / OAuth** per the MCP auth spec (keep Bearer as fallback for the pilot). Design for **on-behalf-of (OBO)** so AADB can later act with a proper **Entra Agent ID** identity when called via Scout.
- **Acceptance:** Server validates Entra-issued tokens; documented migration path from Bearer.
- **Note:** Coordinate with the Scout catalog entry (`scout-m` → `mcp-servers.ts`).

### P2-5 · Telemetry + eval harness
- **Change:** Emit **App Insights** telemetry per tool call (name, latency, success, which sequences Scout uses). Add a small **eval set** (prompts → expected tool calls / score ranges) runnable in CI across the web app's 12 models.
- **Acceptance:** Telemetry visible in App Insights; `npm run eval` reports pass/fail on the sample suite.

---

## Cross-cutting cleanups
- **Doc nit:** `src/index.ts` header says "Transport: stdio" but ACA runs Streamable-HTTP — update the comment.
- **Version bump** the server (`name: 'azure-diagram-builder', version`) when tool surface changes; note breaking changes.
- Keep tool **descriptions** tight and example-rich (they're the agent's only guidance).

## Non-goals (explicitly out of scope for now)
- **No live deployment / `az deploy` / what-if** from the server — stay **design-time**. (Deploying is a separate, higher-risk decision.)
- **No moving reasoning/orchestration into the server** — Scout/agents orchestrate; the server stays deterministic ground truth.
- **No new model inference in the server** — model calls belong to the web app / calling agent.

## Suggested order
`P0-1` (cost parity) → `P0-2` (generate_bicep) → `P0-3` (structured outputs) → `P1-1`/`P1-2` (remediate + harden) → `P1-4`/`P1-5` (portable render + annotations) → `P1-3` (imports) → `P2-*`.

> If only three things ship: **P0-1, P0-2, P0-3.** Those make the design→validate→harden→cost→**deploy** loop real and machine-consumable end-to-end.

---
_Source of gaps: `mcp-server/src/index.ts`, `SCOUT/README.md`, `SCOUT/test-1.md`. Aligns with FY27 "Intelligence + Trust" and the four customer questions (make it real · govern it · manage cost · prove ROI)._
