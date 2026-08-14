# AADB ↔ Microsoft Scout

This folder holds artifacts from using the **Azure Architecture Diagram Builder
(AADB)** as a remote **MCP server** inside [Microsoft Scout](https://learn.microsoft.com/en-us/microsoft-scout/get-started).

Scout connects to AADB's MCP server and can design, validate, cost, and render
Azure architectures conversationally.

## How it's wired

- **Server:** the AADB MCP server (`mcp-server/`) deployed to Azure Container
  Apps, Streamable-HTTP transport.
- **Endpoint:** `https://azure-diagram-mcp.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io/mcp`
- **Auth:** Bearer token (`MCP_AUTH_TOKEN` on the container app). Scout stores it
  encrypted and sends `Authorization: Bearer <token>`.
- **Catalog entry:** registered in the `scout-m` repo at
  `common/extensions-catalog/items/mcp-servers.ts`
  (id `mcp-azure-architecture-diagram-builder`, `microsoftOnly`).

> Only `/mcp` speaks MCP. `GET /healthz` is the standalone server's unauthenticated
> health probe; use `/mcp`, not `/healthz`, as Scout's server URL.

## Capabilities

The production endpoint has been verified to expose **12 tools, 3 resources,
and 3 prompts**. The title/annotation contract described below is validated in
the current source branch by `npm run test:contracts`; it is not a production
claim until that branch is reviewed and deployed to the standalone MCP app.

### Tools

| Tool | Purpose |
| --- | --- |
| `list_services` | Browse the Azure service catalog (categories, aliases, pricing, cost ranges). |
| `validate_architecture` | Score a design against Well-Architected Framework rules (deterministic, no LLM). |
| `estimate_costs` | **Numeric** monthly costs (low/expected/high) from a distilled Azure Retail Prices snapshot, with regional and by-category totals. PAYG is the default. In `reserved1yr` mode each tier uses its own exact one-year Savings Plan meter when available; unavailable tiers remain PAYG. Instance-priced services use configured representative SKUs, Microsoft Fabric uses F-SKU capacity bands, and services without a trusted fixed monthly value report curated catalog ranges. |
| `generate_manifest` | Emit an `az prototype` interchange manifest. |
| `generate_bicep` | Emit deployable Bicep with Well-Architected secure defaults and a map of which finding each setting resolves. Design-time only. |
| `generate_terraform` | Emit Terraform for the architecture with secure defaults. Design-time only. |
| `generate_deployment_guide` | Generate a deployment runbook with prerequisites, IaC commands, hardening checks, smoke tests, and teardown. |
| `harden_architecture` | Add topology-level safeguards that address recurring WAF findings, then return the hardened architecture. |
| `import_architecture` | Normalize a saved AADB or React Flow architecture for use by the other tools. |
| `get_waf_rules` | Query WAF rules by pillar or service type. |
| `render_diagram` | Render an architecture diagram as SVG (static) or interactive HTML. Now supports a **light/dark theme**, **per-node cost badges**, a **total-cost/usage footer**, a **metadata panel** (author/date/provenance), and **filled group headers**. See [Output enhancements](#output-enhancements-july-2026). |
| `export_reactflow_scene` | Produce a React Flow scene for the web app. Now emits a per-node **`pricing`** object and edge **`pathStyle`** for near-full parity with app-generated scenes. |

**Current source contract:** all 12 tools expose a human-readable title and
`readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: false`.
`validate_architecture`, `estimate_costs`, and `get_waf_rules` additionally
return typed `structuredContent` validated against declared output schemas.

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
| `title` | string | Diagram title shown in the rendered artifact. |
| `region` | Azure region (default `eastus2`), or `none` | Region used for best-effort cost badges. `none` disables cost enrichment. |
| `author` | string | Shown in the metadata panel (top-right). |
| `generatedBy` | string | Provenance label (e.g. the model that produced the design). |
| `profile` | `presentation` (default), `technical`, `cost` | Presentation reflows capability and multi-region layouts and emphasizes graph-derived request paths; technical preserves the natural layout and every label; cost reuses presentation focus while adding pricing. |

The cost enrichment reuses the same `resolveServiceName → pricingServiceName → estimateServiceCost` path as `estimate_costs`. It runs only for `profile: "cost"`, so presentation diagrams do not imply false pricing precision. Cost totals are labeled as fixed priced baselines and explicitly exclude usage-based or ranged items.

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
- **Fixed-baseline cost footer.** Sums firm estimates and states how many
  usage-based or ranged items are excluded. When every service is usage-based,
  it reports that no fixed priced baseline is available instead of implying
  `~$0/mo`.
- **Purpose-built render profiles.** Presentation and cost use semantic
  capability or multi-region composition, graph-derived primary request paths,
  WAF policy associations, and representative labels. Technical preserves the
  natural layout and every connection label for zoomed inspection.
- **Light/dark theme** (`theme` param) — dark matches the app's canvas look.
- **Metadata panel** (author / date / provenance) via `author` / `generatedBy`.
- **Filled group headers** (colored header bars) instead of thin dashed labels.
- **Scene-JSON parity:** `export_reactflow_scene` emits a per-node `pricing`
  object (`estimatedCost`, `tier`, `skuName`, `quantity`, `region`,
  `isUsageBased`) and edge `data.pathStyle: "orthogonal"`.

### Design decision — pricing without invented precision

The MCP server emits a point estimate only when the distillation has a trusted
representative deployable SKU or a fixed Fabric capacity band. Per-token,
per-transaction, per-GB, and composite-billed services without that basis use
the catalog range and are flagged as missing distilled numeric data.

### Known limitation

Firm numeric badges only appear for services present in the distilled Azure
Retail Prices sidecar (`mcp-server/src/pricing.generated.json`). Other services
show catalog ranges. `pricingSource.generatedAt` records sidecar generation;
per-estimate `pricesAsOf` records the newest contributing meter effective date.
Those dates are intentionally distinct. For an authoritative workload quote,
use the Azure Pricing Calculator.

## Changelog

- **2026-08-14 — Tool contract hardening (source validated; deployment pending).** All 12 tools now use
  `registerTool`, expose titles and safety annotations, and have their handlers
  smoke-tested by a standalone authenticated HTTP contract test. Pricing guidance
  now distinguishes PAYG, exact per-tier one-year Savings Plan coverage,
  sidecar generation time, and meter effective dates.

- **2026-08-06 — Multi-region profile iteration.** Added deterministic
  regression coverage for a 29-node, 46-connection global/primary/secondary
  architecture. Presentation and cost now reflow that pattern into aligned
  regional tiers, derive the primary request path from service roles, render
  WAF as a policy association, and use representative labels. Cost uses a
  fixed-priced-baseline footer with explicit variable-cost exclusions. SVG and
  interactive HTML consume the same edge semantics.
- **2026-07-06 — Output enhancement pass.** Added themes, per-node cost badges
  (firm + range), total/usage footer, metadata panel, and filled group headers
  to `render_diagram` (SVG + HTML). Added `pricing` + `pathStyle` to
  `export_reactflow_scene` for scene parity. Added an `Azure Functions` alias in
  the service catalog (was resolving to `null`, so Functions rendered no badge).
  Files: `mcp-server/src/{svgRenderer,htmlRenderer,layoutEngine,index,serviceCatalog}.ts`.
  The current standalone deployment path is `scripts/deploy-mcp.sh`; the
  endpoint and bearer-token contract remain stable.

## Redeploying after MCP server changes

```sh
cd mcp-server && npm run test:contracts  # build + authenticated HTTP contract
cd .. && bash scripts/deploy-mcp.sh      # standalone MCP ACA only
```

`deploy-mcp.sh` runs `az acr build`, rolls out a uniquely tagged revision of the
standalone `azure-diagram-mcp` Container App, and preserves its configured
bearer-token secret. It does not build or update the web Container App. The MCP
endpoint URL remains stable.

## Configure the server in Scout

In Scout's **Add MCP Server** dialog, use:

| Dialog field | Value |
| --- | --- |
| **Server name** | `Azure Architecture Diagram Builder` (or `AADB`) |
| **Tab** | **Remote / Local URL** |
| **URL** | `https://azure-diagram-mcp.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io/mcp` |
| **Bearer token** | Obtain the current value from the app owner through an approved secret channel. |
| **Tool-call timeout** | Leave blank (default ~60), or `120` if renders time out |

Scout should discover 12 tools, 3 resources, and 3 prompts. If discovery returns
zero capabilities, verify the `/mcp` suffix, the bearer-token value, and that no
leading or trailing whitespace was included.

## macOS sign-in troubleshooting

Scout uses the Microsoft Enterprise SSO broker on managed Macs. Its selected
MSAL account is stored under `~/.scout/m-auth`, outside the Electron profile at
`~/Library/Application Support/Microsoft Scout`. Resetting only the Electron
profile therefore does not clear a broker account that Scout keeps restoring.

### Symptom

- Scout repeatedly prefills the wrong organizational account.
- Choosing **Sign in with another account** still sends authentication through
  the previously selected tenant.
- The sign-in window may report an incorrect password even when the selected
  account belongs to a different tenant.

### Scout-scoped reset

Quit Scout, back up only its native auth directory, and create Scout's supported
signed-out sentinel:

```sh
osascript -e 'tell application "Microsoft Scout" to quit' 2>/dev/null || true

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$HOME/Library/Application Support/Microsoft Scout Backups/${stamp}-native-auth"
mkdir -p "$backup"

if [ -d "$HOME/.scout/m-auth" ]; then
  mv "$HOME/.scout/m-auth" "$backup/m-auth"
fi

mkdir -m 700 "$HOME/.scout/m-auth"
touch "$HOME/.scout/m-auth/signed-out"
chmod 600 "$HOME/.scout/m-auth/signed-out"

open -a "/Applications/Microsoft Scout.app"
```

On the next sign-in, Scout skips automatic account restoration and asks the
native broker to select an account. After a successful sign-in, Scout removes
`signed-out` and writes a new encrypted `msal-last-account.enc` selection.

Verify without reading credentials:

```sh
find "$HOME/.scout/m-auth" -maxdepth 1 -type f -print
```

Expected after success: `msal-last-account.enc` exists and `signed-out` does
not.

### Safety boundary

- Do **not** delete Company Portal, macOS Platform SSO registration, or shared
  `com.microsoft.oneauth.*` Keychain records. They are used by other Microsoft
  applications and device management.
- Do **not** print or copy token-cache contents. File names and existence are
  sufficient for diagnosis.
- If a password appears in a screenshot or transcript, rotate it immediately,
  remove the stale saved-browser credential, and use passwordless/MFA sign-in
  where available.
- Keep the backup until the intended account signs in successfully, then remove
  it according to local security and retention policy.

### Credential handling

- Never paste bearer tokens into tracked files, issue descriptions, screenshots,
  transcripts, or shell history.
- Keep the standalone server token in the repo-root `.env.mcp`, which is ignored
  by Git and should be mode `0600`. It belongs only to the standalone
  `azure-diagram-mcp` Container App. The web app is not an MCP deployment target.
- Rotate a token immediately if it is disclosed, then update Scout through the
  same approved secret channel.
