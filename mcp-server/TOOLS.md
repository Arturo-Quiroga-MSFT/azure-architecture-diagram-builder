# Azure Architecture Diagram Builder — MCP Server Tools

This is the running reference for every tool the MCP server exposes
([`src/index.ts`](src/index.ts)). Endpoint: `POST /mcp` (streamable-HTTP) with
`Authorization: Bearer <token from .env.mcp>`. Health: `GET /healthz`.

All tool design logic is deterministic (no LLM), read-only, and closed-world.
Artifact metadata such as creation timestamps can differ between otherwise
equivalent calls.
Each exposes a human-readable MCP title plus
`readOnlyHint: true`, `idempotentHint: true`, and `openWorldHint: false`.
They are design-time only — nothing deploys Azure resources.

## Tool inventory

| # | Tool | Purpose | Stage |
|---|------|---------|-------|
| 1 | `list_services` | Browse the Azure service catalog (names, categories, aliases, pricing availability, cost ranges) | Discovery |
| 2 | `validate_architecture` | WAF score (0–100) + findings by pillar, deterministic rule engine | Analyze |
| 3 | `estimate_costs` | Numeric monthly costs (low/expected/high) from distilled Azure Retail Prices | Cost |
| 4 | `generate_manifest` | `az prototype` interchange manifest (JSON) | Export |
| 5 | `generate_bicep` | Deployable Bicep with WAF secure defaults pre-set; maps each setting to the finding it resolves | IaC |
| 6 | `harden_architecture` | Deterministically clear pattern-level WAF anti-patterns (topology remediation) | Remediate |
| 7 | `get_waf_rules` | Query the WAF rule knowledge base by pillar / service | Discovery |
| 8 | `render_diagram` | Azure-branded SVG or interactive HTML diagram | Visualize |
| 9 | `export_reactflow_scene` | React Flow scene JSON importable into the web app | Export |
| 10 | `import_architecture` | Inverse of the export tools; parse a manifest / React Flow scene back to canonical shape | Import |
| 11 | `generate_terraform` | Deployable Terraform (azurerm) with the same WAF secure defaults as the Bicep tool | IaC |
| 12 | `generate_deployment_guide` | Step-by-step Markdown deploy runbook (Bicep or Terraform) with a post-deploy hardening checklist | Deploy |

---

## 1. `list_services`

**Module:** [`src/serviceCatalog.ts`](src/serviceCatalog.ts)

Browse the Azure service catalog the builder understands. Optionally filter by
`category`. Use it first to resolve human names/aliases to canonical service
types before calling the other tools.

**Input:** `{ category?: string }` (valid categories are echoed in the response)

**Output:** `{ totalServices, categories[], services[] }` — each service carries
`{ key, displayName, category, aliases, hasPricingData, isUsageBased, costRange }`.
Also available as the `azure://catalog/services` resource.

---

## 2. `validate_architecture`

**Module:** [`src/wafDetector.ts`](src/wafDetector.ts)

Deterministic Well-Architected Framework analysis (no LLM). Runs two rule
classes — **pattern** rules (architecture-wide anti-patterns) and **service**
rules (per-service best practices) — and returns a 0–100 score.

**Input:** `{ services[], connections?[] }`

**Output (`structuredContent`):**
```jsonc
{
  "score": 55,
  "totalFindings": 7,
  "patternsDetected": ["single-region"],
  "rulesApplied": { "pattern": N, "service": M },
  "regionalTopology": {
    "explicitServingRegions": ["eastus2"],
    "redundantServingTypes": [],
    "hasMultiRegionServingTier": false,
    "redundantDatabaseTypes": [],
    "hasMultiRegionDatabaseTier": false
  },
  "findingsByPillar": { "Security": { "count": 3, "findings": [ { "severity", "category", "issue", "recommendation", "resources" } ] } }
}
```

Regional and WAF findings require explicit topology evidence. Global routing
does not count as a second serving region, and a WAF policy must be associated
by an edge with Front Door or Application Gateway.

> The score is capped at the diagram layer. Topology findings are cleared by
> `harden_architecture` (§6); config-level findings are resolved by
> `generate_bicep` (§5) / `generate_terraform` (§11).

---

## 3. `estimate_costs`

**Module:** [`src/pricing.ts`](src/pricing.ts)

Numeric monthly costs from a distilled snapshot of the **Azure Retail Prices**
API, region- and term-aware.

**Input:** `{ services[] (name, type, region?, tier?, quantity?), region?, term? }`
- `services[].region`: per-service Azure region; overrides the request-level region
- `tier`: `basic | standard | premium` → low/expected/high SKU band
- `region`: `eastus2` (default), `centralus`, `westus2`, `australiaeast`,
  `canadacentral`, `brazilsouth`, `mexicocentral`, `westeurope`,
  `northeurope`, `uksouth`, `swedencentral`, `southeastasia`, `japaneast`,
  `centralindia`
- `term`: `payg` (default) or `reserved1yr`

`reserved1yr` means exact, SKU-specific one-year Savings Plan pricing. Each
low/expected/high tier uses its own meter when one exists; a tier without one
stays PAYG. The tool never extrapolates one SKU's discount to another.

**Output (`structuredContent`):** includes the backward-compatible
`totalMonthlyCost`, plus explicit fixed-baseline coverage and regional
provenance:

- `serviceCount` (input rows) and quantity-aware `totalResourceCount`
- `numericallyPricedResourceCount / totalResourceCount` and `numericCoveragePercent`
- `isPartialBaseline`, `baselineLabel`, and categorized `excludedServices`
- per-estimate `requestedRegion`, `effectiveRegion`, and `regionProxyUsed`
- response-level `requestedRegions`, `effectiveRegions`, and proxy count

Services without distilled pricing fall back to a curated `catalogCostRange`
and are excluded from the numeric baseline. If a numeric estimate requests a
region outside the bundled snapshot, the fallback is explicit; the tool never
labels proxy rates as native rates for that region. Catalog/usage exclusions use
no regional meter and therefore retain the requested region without a proxy.

`pricingSource.generatedAt` is when the compact MCP sidecar was generated.
`pricesAsOf` is the newest contributing Azure Retail Prices meter effective
date among the returned estimates. The dates measure different things and may
differ.

---

## 4. `generate_manifest`

Emit an **`az prototype` interchange manifest** (schemaVersion 1.0) from the
architecture — importable into the web app or consumable by `az prototype build`.

**Input:** `{ projectName, location?, iacTool?, services[], connections?[], groups?[] }`

**Output:** the manifest JSON (`{ schemaVersion, architecture: { ... } }`).
Optional normalized `services[].region` values round-trip back via
`import_architecture` (§10).

---

## 5. `generate_bicep`

**Module:** [`src/bicepGenerator.ts`](src/bicepGenerator.ts)

Deployable **Bicep** with Well-Architected secure defaults pre-set, so the
config-level WAF findings a diagram can't express are resolved out of the gate.

### Coverage (secure defaults pre-set)

| Service | Hardening |
|---------|-----------|
| App Service | HTTPS-only, TLS 1.2, managed identity, health check, autoscale, staging slot |
| Key Vault | soft-delete 90d, purge protection, RBAC |
| Storage | HTTPS-only, TLS 1.2, no public blob access |
| Cosmos DB | automatic failover, continuous backup |
| SQL Database | server + DB, **TDE**, **auditing** (Azure Monitor), TLS 1.2, no public network, Entra-only admin |
| Redis | TLS 1.2 minimum |
| Front Door / WAF Policy | Premium profile + WAF policy (Prevention mode, Microsoft managed rule set) |
| AI Search / Container Apps | keyless / HTTPS-only ingress, managed identity |
| Monitoring | Log Analytics + Application Insights |

Managed identities are granted **Key Vault Secrets User**. Services without a
template emit a commented placeholder (reported in `servicesGeneric`).

**Input:** `{ projectName?, location?, iacTool?, services[], connections?[] }`
**Output:** `{ iacTool, servicesCovered[], servicesGeneric[], findingsResolved[], findingsResolvedCount, note, bicep }`

> Terraform counterpart: `generate_terraform` (§11).

---

## 6. `harden_architecture` (new)

**Module:** [`src/hardener.ts`](src/hardener.ts)

Collapses the manual *add-service → re-validate* loop (that agents like Scout
previously did by hand) into a single deterministic call. Given an
architecture, it detects the pattern-level WAF anti-patterns and adds the
remediating services + connections, iterating until the pattern set stops
shrinking, then re-validates.

### Patterns cleared (topology / diagram-addressable)

| Anti-pattern | Remediation added |
|--------------|-------------------|
| `no-identity` | Microsoft Entra ID (+ authN/authZ edge) |
| `no-waf` | Azure Front Door + WAF Policy on the edge |
| `single-region` | With `secondaryRegion`: duplicate an explicit serving type in that region and route Front Door to both instances. Without it: unresolved. |
| `no-api-gateway` | API Management (unified gateway) |
| `direct-db-access` | Reroutes frontend→DB through the API layer |
| `single-database` | With `secondaryRegion`: add same-type `<db> Replica` in that explicit region. Without it: unresolved. |
| `no-cache` | Azure Cache for Redis |
| `no-key-vault` | Key Vault |
| `no-backup` | Azure Backup |
| `no-monitoring` | Application Insights + Azure Monitor |

> **Scope:** only *topology* is fixed here. Config-level findings (HTTPS-only,
> TDE, Key Vault soft-delete, autoscale, …) are **not** diagram-addressable and
> are resolved by `generate_bicep`. So the WAF score rises but is still capped
> at the diagram layer — that's expected and intentional.

### Input

```jsonc
{
  "secondaryRegion?": "centralus",
  "services":   [{ "name": "...", "type": "...", "description?": "...", "groupId?": "..." }],
  "connections?": [{ "from": "...", "to": "...", "label?": "...", "type?": "sync|async|optional" }],
  "groups?":    [{ "id": "...", "label": "..." }]
}
```

Regional evidence is conservative:

- Front Door, Traffic Manager, WAF, CDN, and Entra ID do not count as a second region.
- WAF protection requires an explicit association edge between a WAF policy and
  Front Door or Application Gateway; detached policy nodes do not qualify.
- Unlocated services do not prove or disprove regional redundancy.
- `single-region` clears only when the same serving type is explicitly present
  in at least two regions.
- `single-database` clears only when every database type is explicitly present
  in at least two regions.
- The hardener never invents a target region. Pass `secondaryRegion` when
  deterministic regional remediation is intended.

### Output

```jsonc
{
  "summary":   "Hardened: WAF score 10 → 18. Patterns 7 → 0 (all cleared). 7 change(s) applied.",
  "before":    { "score": 10, "patternsDetected": [...], "totalFindings": N },
  "after":     { "score": 18, "patternsDetected": [], "totalFindings": M },
  "changes":   [{ "pattern": "no-identity", "action": "...", "addedServices": [...], "addedConnections": ["A → B"] }],
  "unresolved":[],          // topology patterns that couldn't be auto-fixed
  "note":      "Regional findings remain unresolved without secondaryRegion; otherwise all remediated pattern findings are revalidated.",
  "services":  [...],       // hardened architecture — pass straight to render_diagram / generate_bicep / export_reactflow_scene
  "connections":[...],
  "groups":    [...]        // new groups (Global Edge & Security, API Gateway, Security & Ops) appended
}
```

### Typical flow

`validate_architecture` → `harden_architecture` → `render_diagram` (show the
hardened topology) → `generate_bicep` (resolve config-level findings) →
`export_reactflow_scene` (hand to the web app).

Idempotent: hardening an already-hardened architecture is a no-op. This is
exercised through the public Streamable HTTP contract by `npm run test:contracts`.

---

## 7. `get_waf_rules`

**Module:** [`src/wafDetector.ts`](src/wafDetector.ts)

Query the WAF rule knowledge base that powers `validate_architecture`. Filter by
`pillar` and/or `serviceType`.

**Input:** `{ pillar?, serviceType? }` — pillar ∈ Reliability, Security, Cost Optimization, Operational Excellence, Performance Efficiency

**Output (`structuredContent`):** `{ totalRules, filters, rulesByPillar{}, rules[] }`
where each rule has `{ id, pillar, severity, category, issue, recommendation, appliesTo[], pattern? }`. Also exposed as the `azure://waf/rules` resource.

---

## 8. `render_diagram`

**Modules:** [`src/layoutEngine.ts`](src/layoutEngine.ts), [`src/svgRenderer.ts`](src/svgRenderer.ts), [`src/htmlRenderer.ts`](src/htmlRenderer.ts)

Render the architecture as **SVG** (for markdown/SpecKit embedding) or a
self-contained interactive **HTML** viewer (pan, zoom, hover tooltips). Uses
official Azure icons, category colors, dagre-based tiered layout, orthogonal
edges with 2-line collision-avoided labels, distinct per-group header colors,
and a footer band (wrapped legend + cost total). Best-effort per-node cost
badges come from the same pricing resolution as `estimate_costs`.

**Input:** `{ services[], connections?[], groups?[], title?, format? (svg|html), direction? (TB|LR), theme? (light|dark), profile? (presentation|technical|cost), region?, author?, generatedBy? }`

`services[].region` overrides the render-level `region` for cost enrichment.

**Output:** the SVG or HTML markup (text).

- `presentation` (default): semantic reflow for ultra-wide capability groups and global/primary/secondary regional architectures, graph-derived request paths, WAF policy associations, quieter supporting edges, representative labels, larger text, and no pricing.
- `technical`: natural layout with every connection label and no pricing.
- `cost`: presentation composition and edge hierarchy plus per-node cost badges/ranges and a fixed-priced-baseline footer. Variable and ranged items are explicitly excluded from that baseline. `region` applies only to this profile; set it to `none` to suppress pricing enrichment.

---

## 9. `export_reactflow_scene`

Export a **React Flow scene JSON** compatible with the web app (Open / Import
Architecture). Reuses the dagre layout for positions and the web app icon
catalog for icon paths.

**Input:** `{ services[], connections?[], groups?[], architectureName?, architecturePrompt?, author?, direction? (TB|LR|auto), region?, workflow?[] }`
- `direction: auto` (default) picks **LR** for 4+ groups or dense graphs, else **TB**.

**Output:** the React Flow scene JSON. Round-trips back via `import_architecture` (§10).
Per-service regions are preserved in node data and embedded pricing provenance.

---

## 10. `import_architecture` (new)

**Module:** [`src/importer.ts`](src/importer.ts)

The inverse of `generate_manifest` and `export_reactflow_scene` — closes the
round-trip so an agent can reload a previously saved design and keep working.

### Accepts

| Format | Detection | Type recovery |
|--------|-----------|---------------|
| az prototype **manifest** | has `architecture` | explicit `services[].type` (lossless) |
| React Flow **scene** | has `nodes` | `data.azureServiceType` → icon-path reverse-lookup → `data.label` |

### Input

```jsonc
{
  "content": "<JSON string — a manifest or a React Flow scene>",
  "format?": "auto | manifest | reactflow"   // auto-detected when omitted
}
```

### Output

```jsonc
{
  "summary": "Imported reactflow: 3 service(s), 1 connection(s), 1 group(s).",
  "format": "manifest | reactflow",
  "projectName?": "...",
  "location?": "...",
  "warnings": [ ... ],          // non-fatal parse notes (e.g. unresolved type)
  "services": [ ... ],          // canonical shape — feed straight into any tool
  "connections": [ ... ],
  "groups": [ ... ]
}
```

For manifests, `services[].region` is preserved. For React Flow scenes, region
is recovered from `data.region` or `data.pricing.region`.

### Typical flow

`import_architecture` → `validate_architecture` / `harden_architecture` /
`render_diagram`. Edges that touch group nodes are dropped; service types are
reverse-resolved from the icon map (`ICON_FILE_TO_TYPE` in `index.ts`) when a
scene has no explicit type field.

---

## 11. `generate_terraform` (new)

**Module:** [`src/terraformGenerator.ts`](src/terraformGenerator.ts)

Terraform (azurerm provider `~> 4.0`) counterpart to `generate_bicep`. Emits a
provider block + resource group, then the same secure-default resources so the
config-level WAF findings resolve out of the gate.

### Coverage (secure defaults pre-set)

| Service | azurerm resource(s) | Hardening |
|---------|---------------------|-----------|
| App Service | `azurerm_service_plan` + `azurerm_linux_web_app` (+ slot, autoscale) | `https_only`, TLS 1.2, `identity`, health check, autoscale, staging slot |
| Key Vault | `azurerm_key_vault` | soft-delete 90d, purge protection, RBAC, no public network |
| Storage | `azurerm_storage_account` | HTTPS-only, TLS 1.2, no public/nested access, ZRS |
| Cosmos DB | `azurerm_cosmosdb_account` | automatic failover, continuous backup, Session consistency |
| SQL Database | `azurerm_mssql_server` + `azurerm_mssql_database` + `azurerm_mssql_server_extended_auditing_policy` | TDE, auditing, TLS 1.2, no public network, Entra-only admin |
| Redis | `azurerm_redis_cache` | TLS 1.2 min, non-SSL port disabled |
| Front Door / WAF | `azurerm_cdn_frontdoor_profile` + `azurerm_cdn_frontdoor_firewall_policy` | Premium profile + WAF (Prevention mode, Microsoft managed rules) |
| AI Search | `azurerm_search_service` | keyless (`local_authentication_enabled = false`), identity |
| Container Apps | `azurerm_container_app*` | HTTPS-only ingress, managed identity, LA-backed env |
| Monitoring | `azurerm_log_analytics_workspace` + `azurerm_application_insights` | workspace-based |

Managed identities are granted **Key Vault Secrets User** via
`azurerm_role_assignment` (keyless auth). Services without a template emit a
commented placeholder and are listed in `servicesGeneric`.

### Output

```jsonc
{
  "iacTool": "terraform",
  "servicesCovered": [ ... ],
  "servicesGeneric": [ ... ],
  "findingsResolved": [ { "ruleId", "pillar", "service", "setting", "terraformAttribute" } ],
  "findingsResolvedCount": 12,
  "note": "...",
  "terraform": "terraform { ... }"   // full HCL
}
```

> Use `generate_bicep` for Bicep and `generate_terraform` for Terraform — they
> share coverage and secure-default semantics so agents can offer either format.

---

## 12. `generate_deployment_guide` (new)

**Module:** [`src/deploymentGuide.ts`](src/deploymentGuide.ts)

Produces a Markdown deployment **runbook** for the architecture, tailored to the
chosen IaC tool. Pairs with `generate_bicep` / `generate_terraform` (which emit
the IaC the guide deploys).

### Sections (7 steps)

1. Prerequisites (Azure CLI, role, Bicep/Terraform, quota)
2. `az login` + subscription select
3. Region & naming
4. Resource group create
5. **Deploy** — `az deployment group create` (Bicep) or `terraform init/plan/apply`
6. **Post-deploy hardening checklist** — derived from the WAF *service-level*
   findings (`detectWafPatterns`), so operators verify the settings the IaC
   pre-sets (HTTPS-only, TLS, TDE, soft-delete, …)
7. **Smoke tests** — per-service verification hints (deduped by resolved type)
8. Teardown (`az group delete` or `terraform destroy`)

### Input / output

Input mirrors the IaC tools: `{ services, connections?, projectName?, location?, iacTool? }`
(`iacTool`: `bicep` default, or `terraform`).

```jsonc
{
  "iacTool": "bicep | terraform",
  "steps": 7,
  "checklistItems": 8,       // config findings turned into checklist items
  "markdown": "# Deployment Guide — ..."
}
```

> Design-time only — the guide documents the steps, it never deploys.

---

## Resources

Beyond tools, the server exposes read-only MCP **resources** so clients can
browse reference data without a tool round-trip (they're cacheable):

| URI | Title | Contents |
|-----|-------|----------|
| `azure://catalog/services` | Azure service catalog | Every known service: category, aliases, pricing availability, cost range |
| `azure://waf/rules` | WAF rules | Pattern rules + per-service best practices used by `validate_architecture` |
| `azure://pricing/meta` | Pricing metadata | Regions and priced service entries available to `estimate_costs` |

All return `application/json`.

## Contract verification

Run `npm run test:contracts` from `mcp-server/`. The test builds the standalone
server, starts its Streamable HTTP transport with a temporary bearer token, and
verifies unauthenticated rejection, the exact 12-tool / 3-resource / 3-prompt
inventory, every tool title and safety annotation, a smoke call to every tool
handler, direct requests with missing and stale session IDs, structured PAYG
pricing, forced-format import, hardening idempotency, and both Bicep and
Terraform deployment-guide paths.

## Prompts

Reusable MCP **prompt templates** that guide any client through the full
design workflow:

| Name | Argument | What it drives |
|------|----------|----------------|
| `design-secure-web-app` | `workload` | Propose → validate → harden → cost → render → bicep for a secure web app |
| `design-event-driven-platform` | `workload` | Same flow for an ingest→process→store→analytics platform |
| `harden-and-cost` | `region?` | Import (if needed) → validate → harden → cost → render → bicep on an existing design |
