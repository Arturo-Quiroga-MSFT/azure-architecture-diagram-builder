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

## Capabilities

The current server exposes **12 tools, 3 resources, and 3 prompts**.

### Tools

| Tool | Purpose |
| --- | --- |
| `list_services` | Browse the Azure service catalog (categories, aliases, pricing, cost ranges). |
| `validate_architecture` | Score a design against Well-Architected Framework rules (deterministic, no LLM). |
| `estimate_costs` | **Numeric** monthly costs (low/expected/high) from a distilled Azure Retail Prices snapshot — region- and term-aware (PAYG / 1-year reserved), with by-category totals. Instance-priced services use a representative SKU; Microsoft Fabric uses F-SKU capacity; usage-based services (AI, per-GB storage, composite networking) report curated catalog ranges. |
| `generate_manifest` | Emit an `az prototype` interchange manifest. |
| `generate_bicep` | Emit deployable Bicep with Well-Architected secure defaults and a map of which finding each setting resolves. Design-time only. |
| `generate_terraform` | Emit Terraform for the architecture with secure defaults. Design-time only. |
| `generate_deployment_guide` | Generate a deployment runbook with prerequisites, IaC commands, hardening checks, smoke tests, and teardown. |
| `harden_architecture` | Add topology-level safeguards that address recurring WAF findings, then return the hardened architecture. |
| `import_architecture` | Normalize a saved AADB or React Flow architecture for use by the other tools. |
| `get_waf_rules` | Query WAF rules by pillar or service type. |
| `render_diagram` | Render an architecture diagram as SVG (static) or interactive HTML. Now supports a **light/dark theme**, **per-node cost badges**, a **total-cost/usage footer**, a **metadata panel** (author/date/provenance), and **filled group headers**. See [Output enhancements](#output-enhancements-july-2026). |
| `export_reactflow_scene` | Produce a React Flow scene for the web app. Now emits a per-node **`pricing`** object and edge **`pathStyle`** for near-full parity with app-generated scenes. |

**Structured outputs:** `validate_architecture`, `estimate_costs`, and `get_waf_rules` return typed `structuredContent` (validated against a declared `outputSchema`) alongside a concise human summary, and carry read-only/idempotent tool annotations — so agents can consume the data machine-readably instead of parsing prose.

### Resources

| Resource | URI | Purpose |
| --- | --- | --- |
| `service-catalog` | `azure://catalog/services` | Azure services, aliases, categories, and pricing metadata. |
| `waf-rules` | `azure://waf/rules` | Architecture and service-level Well-Architected rules. |
| `pricing-meta` | `azure://pricing/meta` | Regions and service entries available to cost estimation. |

### Prompts

| Prompt | Purpose |
| --- | --- |
| `design-secure-web-app` | Design, validate, harden, cost, render, and generate IaC for a secure web app. |
| `design-event-driven-platform` | Run the full workflow for an event-driven or streaming architecture. |
| `harden-and-cost` | Harden and cost an existing or imported architecture. |

### `render_diagram` parameters

| Parameter | Values | Effect |
| --- | --- | --- |
| `theme` | `light` (default), `dark` | Canvas/card/text palette. Dark uses `#1E1E1E` canvas + `#2D2D30` cards. |
| `region` | Azure region (default `eastus2`), or `none` | Region used for best-effort cost badges. `none` disables cost enrichment. |
| `author` | string | Shown in the metadata panel (top-right). |
| `generatedBy` | string | Provenance label (e.g. the model that produced the design). |

The cost enrichment reuses the same `resolveServiceName → pricingServiceName → estimateServiceCost` path as `estimate_costs`, so **no extra input is required** — Scout gets badges automatically.

## Artifacts

Generated Scout outputs are intentionally local and ignored by Git. Dated
folders can contain diagrams, IaC, and deployment guides from an evaluation
session. For example, the local `17-july-2026/` session contains:

- `vineguard-architecture.svg` and `vineguard-architecture.html`
- `vineguard-main.bicep` and `vineguard-main.tf`
- `vineguard-deployment-guide.md`

Only this integration guide is tracked under `SCOUT/`. Do not commit generated
exports, local transcripts, or credentials.

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
revision, and reuses the configured `mcp-auth-token`. The endpoint URL remains
stable.

## Configure the server in Scout

In Scout's **Add MCP Server** dialog, use:

| Dialog field | Value |
| --- | --- |
| **Server name** | `Azure Architecture Diagram Builder` (or `AADB`) |
| **Tab** | **Remote / Local URL** |
| **URL** | `https://azure-diagram-builder-mcp.victorioussmoke-95d145bd.eastus2.azurecontainerapps.io/mcp` |
| **Bearer token** | Obtain the current value from the app owner through an approved secret channel. |
| **Tool-call timeout** | Leave blank (default ~60), or `120` if renders time out |

Scout should discover 12 tools, 3 resources, and 3 prompts. If discovery returns
zero capabilities, verify the `/mcp` suffix, the bearer-token value, and that no
leading or trailing whitespace was included.

### Credential handling

- Never paste bearer tokens into tracked files, issue descriptions, screenshots,
  transcripts, or shell history.
- Keep local deployment values in `scripts/.env.mcp-instance`, which is ignored
  by Git.
- Rotate a token immediately if it is disclosed, then update Scout through the
  same approved secret channel.
