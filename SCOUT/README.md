# AADB ↔ Microsoft Scout

This folder holds artifacts from using the **Azure Architecture Diagram Builder
(AADB)** as a remote **MCP server** inside [Microsoft Scout](https://learn.microsoft.com/en-us/microsoft-scout/get-started).

Scout connects to AADB's MCP server and can design, validate, cost, and render
Azure architectures conversationally.

## How it's wired

- **Server:** the AADB MCP server (`mcp-server/`) deployed to Azure Container
  Apps, Streamable-HTTP transport.
- **Endpoint:** `https://azure-diagram-builder-mcp.victorioussmoke-95d145bd.eastus2.azurecontainerapps.io/mcp`
- **Auth:** Bearer token (`MCP_AUTH_TOKEN` on the container app). Scout stores it
  encrypted and sends `Authorization: Bearer <token>`.
- **Catalog entry:** registered in the `scout-m` repo at
  `common/extensions-catalog/items/mcp-servers.ts`
  (id `mcp-azure-architecture-diagram-builder`, `microsoftOnly`).

> Only `/mcp` speaks MCP on that host; `/healthz` falls through to the web-app
> SPA, so don't use it as the server URL.

## Tools exposed

| Tool | Purpose |
| --- | --- |
| `list_services` | Browse the Azure service catalog (categories, aliases, pricing, cost ranges). |
| `validate_architecture` | Score a design against Well-Architected Framework rules (deterministic, no LLM). |
| `estimate_costs` | **Numeric** monthly costs (low/expected/high) from a distilled Azure Retail Prices snapshot — region- and term-aware (PAYG / 1-year reserved), with by-category totals. Instance-priced services use a representative SKU; Microsoft Fabric uses F-SKU capacity; usage-based services (AI, per-GB storage, composite networking) report curated catalog ranges. |
| `generate_bicep` | Emit deployable Bicep with Well-Architected secure defaults pre-set (HTTPS-only + TLS 1.2, managed identity, Key Vault soft-delete/purge, health check, autoscale, staging slots, Storage/Cosmos/Redis hardening, KV role assignments) and a structured map of which WAF finding each setting resolves. Design-time only. |
| `generate_manifest` | Emit an `az prototype` interchange manifest. |
| `get_waf_rules` | Query WAF rules by pillar or service type. |
| `render_diagram` | Render an architecture diagram as SVG (static) or interactive HTML. Now supports a **light/dark theme**, **per-node cost badges**, a **total-cost/usage footer**, a **metadata panel** (author/date/provenance), and **filled group headers**. See [Output enhancements](#output-enhancements-july-2026). |
| `export_reactflow_scene` | Produce a React Flow scene for the web app. Now emits a per-node **`pricing`** object and edge **`pathStyle`** for near-full parity with app-generated scenes. |

**Structured outputs:** `validate_architecture`, `estimate_costs`, and `get_waf_rules` return typed `structuredContent` (validated against a declared `outputSchema`) alongside a concise human summary, and carry read-only/idempotent tool annotations — so agents can consume the data machine-readably instead of parsing prose.

### New `render_diagram` parameters

| Parameter | Values | Effect |
| --- | --- | --- |
| `theme` | `light` (default), `dark` | Canvas/card/text palette. Dark uses `#1E1E1E` canvas + `#2D2D30` cards. |
| `region` | Azure region (default `eastus2`), or `none` | Region used for best-effort cost badges. `none` disables cost enrichment. |
| `author` | string | Shown in the metadata panel (top-right). |
| `generatedBy` | string | Provenance label (e.g. the model that produced the design). |

The cost enrichment reuses the same `resolveServiceName → pricingServiceName → estimateServiceCost` path as `estimate_costs`, so **no extra input is required** — Scout gets badges automatically.

## Artifacts

- [`test-1.md`](test-1.md) — a sample Scout session: generate → validate (WAF
  52) → harden (WAF 65) → cost/IaC next steps.
- [`test-prompts.md`](test-prompts.md) — copy-paste prompts to exercise all 8
  tools individually, an end-to-end chain, and edge/negative cases.
- [`comparison/`](comparison/) — side-by-side artifacts (same prompt) from Scout
  vs. the AADB web app that drove the output-enhancement work:
  - `scout-generated/` — Scout's `render_diagram` SVGs + `export_reactflow_scene`
    scene JSON + the `chat.md` transcript.
  - `aadb-app-generated/` — the web app's SVG (a 1.9 MB `foreignObject` DOM
    snapshot), scene JSON, and PNG.

Generated diagram exports (`*.svg`, etc.) produced during Scout sessions are
ignored by git (see the repo `.gitignore`); only this README and the sample
`test-1.md` are tracked.

## Output enhancements (July 2026)

Scout's inline artifacts were visually thinner than the web app's because the
two use **different rendering paths**:

| | AADB web app | Scout MCP `render_diagram` |
| --- | --- | --- |
| Mechanism | `<foreignObject>` snapshot of the live React Flow HTML/CSS canvas | Native SVG hand-drawn by `mcp-server/src/svgRenderer.ts` |
| Size | ~1.9 MB | ~50–80 KB |
| Fidelity | Pixel-identical to the UI | Clean, lightweight re-draw |

To close the visual gap without bloating Scout's output, the **native SVG/HTML
renderers** were upgraded (they stay small — tens of KB):

- **Per-node cost badges.** Instance-priced services show a firm estimate
  (`~$145/mo`); usage-based services show the honest **catalog range**
  (`$11-6849/mo`) as a muted badge. No fabricated point estimates.
- **Total-cost / usage footer.** Sums firm estimates; when every service is
  usage-based it reads `Usage-based pricing — N of M services shown as catalog
  ranges` instead of a misleading `~$0/mo`.
- **Light/dark theme** (`theme` param) — dark matches the app's canvas look.
- **Metadata panel** (author / date / provenance) via `author` / `generatedBy`.
- **Filled group headers** (colored header bars) instead of thin dashed labels.
- **Scene-JSON parity:** `export_reactflow_scene` now emits a per-node
  `pricing` object (`estimatedCost` / `tier` / `isUsageBased` / `costRange`) and
  edge `pathStyle: "orthogonal"`, matching app-generated scenes.

### Design decision — honest usage-based pricing

The web app assigns representative point estimates to usage-based services
(e.g. Event Hubs `$27.60`, Cosmos DB `$0.02`), which can be misleading for
per-token / per-transaction / per-GB meters. The MCP server deliberately does
**not** invent these numbers: it shows the catalog **range** and flags the
service as usage-based, so agents and users see an honest band rather than a
false precision.

### Known limitation

Firm numeric badges only appear for **instance-priced** services present in the
distilled Azure Retail Prices snapshot (`mcp-server/src/pricing.generated.json`).
Usage-based services (Event Hubs, Service Bus, Functions, Cosmos DB, Blob, Log
Analytics, most AI services) show ranges, not point values. For an authoritative
quote at scale, use the Azure Pricing Calculator.

## Changelog

- **2026-07-06 — Output enhancement pass.** Added themes, per-node cost badges
  (firm + range), total/usage footer, metadata panel, and filled group headers
  to `render_diagram` (SVG + HTML). Added `pricing` + `pathStyle` to
  `export_reactflow_scene` for scene parity. Added an `Azure Functions` alias in
  the service catalog (was resolving to `null`, so Functions rendered no badge).
  Files: `mcp-server/src/{svgRenderer,htmlRenderer,layoutEngine,index,serviceCatalog}.ts`.
  Deployed via `scripts/deploy-mcp-instance.sh` (`az acr build` compiles the
  TypeScript in-cloud); endpoint and bearer token unchanged. Verified live
  end-to-end through the authenticated `/mcp` endpoint.

## Redeploying after MCP server changes

```sh
cd mcp-server && npm run build           # local type-check / sanity
cd .. && bash scripts/deploy-mcp-instance.sh
```

`deploy-mcp-instance.sh` is idempotent: it runs `az acr build` (which rebuilds
and recompiles from source in the cloud), rolls out a new Container App
revision, and reuses the existing `mcp-auth-token`. **The endpoint URL and
bearer token do not change**, so no reconfiguration is needed in Scout.




HOW TO CONFIGURE MCP SERVER IN SCOUT:


Ran terminal command: az containerapp secret show --name azure-diagram-builder-mcp --resource-group azure-diagrams-mcp-rg --secret-name mcp-auth-token --query value -o tsv

Everything's confirmed. Here are your exact **Add MCP Server** values for SCOUT:

| Dialog field | Value |
| --- | --- |
| **Server name** | `Azure Architecture Diagram Builder` (or `AADB`) |
| **Tab** | **Remote / Local URL** |
| **URL** | `https://azure-diagram-builder-mcp.victorioussmoke-95d145bd.eastus2.azurecontainerapps.io/mcp` |
| **Bearer token** | `2BpQ6gjvJFDRaw3fwipUoA0pH9J2dsdtPyThxb1O2zw=` |
| **Tool-call timeout** | Leave blank (default ~60), or `120` if renders time out |

Verification results:
- **App status:** `Running` ✅
- **FQDN:** matches the documented endpoint ✅ (remember the `/mcp` suffix — that's the only path that speaks MCP)
- **Token:** stored as secret `mcp-auth-token`, value retrieved above ✅



Once added, Scout should discover 8 tools. If it shows 0, re-check the `/mcp` suffix and that the token was pasted without trailing spaces.

> ⚠️ **Security:** the bearer token above is a **live credential** committed in
> plaintext. Treat it as compromised — rotate it and avoid committing the new
> value. To rotate:
> ```sh
> NEW=$(openssl rand -base64 32)
> az containerapp secret set --name azure-diagram-builder-mcp \
>   --resource-group azure-diagrams-mcp-rg \
>   --secrets mcp-auth-token="$NEW"
> # then update the token in Scout's Add-MCP dialog
> ```
> Prefer keeping the token only in `scripts/.env.mcp-instance` (git-ignored),
> not in tracked docs.

