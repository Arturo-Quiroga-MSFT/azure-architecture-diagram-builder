# AADB MCP Server — Deployment & Rendering Reference

> Reference for the **decoupled MCP server** deployment and the **diagram-rendering
> improvements** shipped on 2026-07-07/08. Companion to `ENHANCEMENT-BACKLOG.md`.

---

## 1. Architecture: decoupled MCP server

The Azure Architecture Diagram Builder MCP server now runs as **its own Azure
Container App with its own FQDN**, separate from the web app.

```
                         Azure Container Apps environment (shared)
   ┌──────────────────────────────────────┐   ┌──────────────────────────────┐
   │  Web app  (azure-diagram-builder)     │   │  MCP server (azure-diagram-  │
   │  nginx + Vite SPA + token server      │   │  mcp)                        │
   │  ingress :80                          │   │  node dist/index.js --http   │
   │  /            → SPA                    │   │  ingress :3030               │
   │  /api/*       → token/OpenAI proxy     │   │  /mcp     → MCP (Bearer auth) │
  │  /mcp         → not served             │   │  /healthz → health           │
   └──────────────────────────────────────┘   └──────────────────────────────┘
```

**Why decoupled:** independent scaling (agent vs human traffic), independent
release cadence (ship renderer changes without rebuilding the web app), isolated
blast radius, and separate agent-facing auth/ingress.

### Live endpoint (production)
```
https://azure-diagram-mcp.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io/mcp
```
- Auth: `Authorization: Bearer <token>` — token stored in `.env.mcp` (gitignored).
- Health: `.../healthz` (root, not `/mcp/healthz` — there is no nginx in this image).
- Resource group: `azure-diagrams-rg` · ACR: `acrazurediagrams1767583743`.

---

## 2. Deploy (script-based, no azd)

Preferred path — mirrors `deploy_aca.sh` / `deploy-mcp-instance.sh`:

```bash
./scripts/deploy-mcp.sh
```

What it does:
1. `az acr build` the **standalone** image from `mcp-server/Dockerfile` with the
   **repo root as build context** (the build's sync scripts read the web app's
   `src/data/serviceIconMapping.ts`, `src/data/pricing/regions/**`, and
   `Azure_Public_Service_Icons/Icons/**` as the single source of truth). No VITE
   build args — the MCP server is deterministic.
2. Derives the shared ACA environment from the web app (`ACA_APP_NAME`).
3. Creates/updates the `azure-diagram-mcp` Container App: external ingress on
   **3030**, min 1 / max 5 replicas, `MCP_AUTH_TOKEN` secret.
4. Generates/persists the bearer token to `.env.mcp` and prints the endpoint.

**Config** (from `.env`): `RESOURCE_GROUP`, `ACR_NAME`, `ACA_APP_NAME`. Optional
`MCP_ACA_APP_NAME` overrides the app name.

**Prereq:** ACR admin user enabled (script uses `az acr credential show`). Switch
to managed-identity registry auth if admin is disabled.

**Iterate:** after any renderer/tool change, just re-run `./scripts/deploy-mcp.sh`
— rebuilds and updates only the MCP app; the web app is untouched.

**Teardown:** `az containerapp delete -n azure-diagram-mcp -g azure-diagrams-rg --yes`

### Alternative: azd (also wired, not required)
`azure.yaml` has an `mcp` service and `infra/` provisions a second Container App:
```bash
azd env set MCP_AUTH_TOKEN "$(openssl rand -base64 32)"
azd up            # or: azd deploy mcp
```
Outputs `MCP_ENDPOINT` / `SERVICE_MCP_URL`.

### Verify
```bash
BASE="https://<mcp-fqdn>"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/healthz"          # 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/mcp" ...  # 401 (no token)
# authenticated initialize returns serverInfo + mcp-session-id header
```

---

## 3. Rendering improvements (2026-07-07)

Driven by two real Scout renders that showed diagonal "spaghetti" edges and
overlapping group boxes. Three fixes, verified on the reconstructed graphs.

### P1 — Orthogonal (Manhattan) edge routing
- **File:** `src/svgRenderer.ts` (+ ported to `src/htmlRenderer.ts` client JS).
- Replaced the diagonal quadratic-Bézier `smoothPath` with `orthogonalRoute` +
  `roundedOrthoPathD`: a mid-channel trunk producing clean horizontal/vertical
  segments with rounded corners. Edge labels anchor to the trunk midpoint.
- `LayoutResult.direction` is now threaded through so routing follows TB/LR.

### P2 — Two-level grouped layout (non-overlapping lanes)
- **File:** `src/layoutEngine.ts` — new `computeGroupedLayout`.
- Lays out each group's members independently (`subLayoutGroup`), then places the
  groups as **meta-nodes** so group boxes never overlap. Edges carry only
  border-anchor endpoints (`borderAnchor`); the orthogonal router draws them.
- Falls back to the original compound `computeFlatLayout` on any error / no groups.
- Group boxes size to fit both members **and** the header label.

### P3 — Node polish
- **File:** `src/svgRenderer.ts`.
- **Two-line name wrapping** (`wrapName`) so long service names fit the card
  (HTML uses CSS `-webkit-line-clamp: 2`).
- **Inline-SVG icon fallbacks** (`fallbackIcon`) — server/persona/cloud glyphs
  replace the `☁️`/`👤` emoji for services without an official Azure icon.
- **Smarter type-badge abbreviations** (e.g. `On-premises network` → `On-Prem`)
  with word-boundary truncation instead of mid-word ellipsis.

### Output-format parity
Both `render_diagram` formats now match: `svg` (static) and `html` (interactive)
share the orthogonal routing, grouped layout, and two-line names. Remaining HTML
gap: it still uses emoji category icons (never used the real glyphs).

### Known minor nits (future)
- Parallel edges between the same two groups can have overlapping trunk labels.
- Long titles can clip under the top-right metadata panel.
- HTML real-glyph icons (parity with SVG fallback).

### Test harness
`scripts/test-render-healthcare.mjs` reconstructs a real Scout graph and renders
SVG (TB/LR) + HTML for before/after checks. Convert SVG→PNG with
`rsvg-convert` (brew install librsvg).

---

## 4. Files changed (this effort)

| Area | Files |
| --- | --- |
| Rendering | `mcp-server/src/layoutEngine.ts`, `mcp-server/src/svgRenderer.ts`, `mcp-server/src/htmlRenderer.ts` |
| Standalone image | `mcp-server/Dockerfile` (new) |
| Script deploy | `scripts/deploy-mcp.sh` (new) |
| azd/IaC | `azure.yaml` (+`mcp` service), `infra/resources.bicep`, `infra/main.bicep`, `infra/main.parameters.json` |
| Test harness | `mcp-server/scripts/test-render-healthcare.mjs` (scratch) |

---

## 5. Web/MCP release boundary

The cutover is complete. The web image does not build, install, start, or route
the MCP server. Deploy MCP changes only with `./scripts/deploy-mcp.sh` (or
`azd deploy mcp`) to the standalone `azure-diagram-mcp` Container App.

Do not add `/mcp` fallback routing to the web app. Independent release cadence,
authentication, scaling, and failure isolation are part of the supported
architecture.
