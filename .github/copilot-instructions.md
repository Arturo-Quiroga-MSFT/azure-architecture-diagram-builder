# Copilot Instructions

## Build & Run

```bash
npm install           # Install dependencies
npm run dev           # Start dev server on http://localhost:3000
npm run build         # TypeScript check + Vite production build (tsc && vite build)
npm run lint          # ESLint (zero warnings policy: --max-warnings 0)
npm run preview       # Preview production build locally
```

There is no test framework configured. No unit or integration tests exist.

## Architecture Overview

Single-page React 18 + TypeScript application built with Vite. The app lets users design Azure architecture diagrams via AI generation (natural language → diagram) or manual drag-and-drop, then validate, cost-estimate, and export them.

### Core Layers

- **`src/App.tsx`** — Monolithic main component (~2700 lines). All top-level state, React Flow canvas setup, toolbar actions, and modal orchestration live here. Most new features involve touching this file.
- **`src/components/`** — Each component has a co-located `.css` file (e.g., `Legend.tsx` + `Legend.css`). No CSS-in-JS or CSS modules — plain CSS with component-scoped class names.
- **`src/services/`** — Business logic separated from UI. Key services:
  - `azureOpenAI.ts` — All Azure OpenAI API calls using the **Responses API** (not Chat Completions). Includes architecture generation, image analysis, ARM template parsing.
  - `architectureValidator.ts` — WAF (Well-Architected Framework) validation via AI.
  - `deploymentGuideGenerator.ts` — Generates deployment docs + Bicep templates via AI.
  - `costEstimationService.ts` / `regionalPricingService.ts` — Real-time pricing from Azure Retail Prices API across 5 regions.
  - `drawioExporter.ts` — Export diagrams to Draw.io XML format.
- **`src/stores/modelSettingsStore.ts`** — Custom hook-based state store (not Redux/Zustand). Manages multi-model selection (GPT-5.2, GPT-4.1, GPT-4.1 Mini, Codex variants) with per-feature overrides. Persists to `localStorage`.
- **`src/data/`** — Static data registries:
  - `serviceIconMapping.ts` — Central registry mapping ~68 Azure services to icons, categories, aliases, and pricing availability. This is the source of truth for what services the app recognizes.
  - `azurePricing.ts` — Pricing tier definitions per service.
  - `pricing/` — 235 cached regional pricing JSON files.
- **`src/utils/`** — Layout engines and helpers:
  - `layoutEngine.ts` — Primary Dagre-based auto-layout with group overlap resolution.
  - `elkLayoutEngine.ts` — Alternative ELK.js layout (togglable in UI).
  - `iconLoader.ts` — Resolves Azure service names to SVG icon paths from `Azure_Public_Service_Icons/`.

### Key Patterns

- **Azure OpenAI integration** uses the Responses API (`/openai/v1/responses`), not Chat Completions. The code has automatic fallback for models that don't support it. All AI calls go through `callAzureOpenAI()` in `azureOpenAI.ts`.
- **Model selection** supports per-feature overrides (e.g., use GPT-5.2 for generation but GPT-4.1 for validation). Model types and deployment names are resolved via env vars (`VITE_AZURE_OPENAI_DEPLOYMENT_GPT52`, etc.).
- **React Flow** (`reactflow` v11) is the canvas library. Custom node types: `azureNode` (service icons) and `groupNode` (logical containers). Custom edge type: `editableEdge`.
- **No router** — the entire app is a single view with modal overlays for features.

## Environment Configuration

All client-side config uses `VITE_` prefixed env vars (Vite inlines them at build time). Copy `.env.example` to `.env`. Required:

- `VITE_AZURE_OPENAI_ENDPOINT` — Azure OpenAI resource URL
- `VITE_AZURE_OPENAI_API_KEY` — API key
- `VITE_AZURE_OPENAI_DEPLOYMENT_*` — Per-model deployment names

For Docker builds, these must be passed as `--build-arg` (not runtime env vars) since Vite bakes them into the static bundle.

## Conventions

- **Copyright headers**: Every source file starts with `// Copyright (c) Microsoft Corporation.` and `// Licensed under the MIT License.`
- **Component structure**: Each React component has a paired `.css` file in the same directory. Styles use plain CSS class names, not modules.
- **ESLint config**: `@typescript-eslint/no-explicit-any` is intentionally turned off. `no-unused-vars` allows underscore-prefixed args (`^_`). Hook rules are relaxed due to the custom store pattern.
- **Adding a new Azure service**: Update `SERVICE_ICON_MAP` in `src/data/serviceIconMapping.ts` with display name, aliases, icon file, category, and pricing availability. Then add pricing data in `src/data/azurePricing.ts` if applicable.
- **Icons**: 713 official Azure SVG icons live in `Azure_Public_Service_Icons/` organized by category. The icon loader fuzzy-matches service names to files.
- **Deployment**: Dockerfile uses multi-stage build (Node 20 → nginx:alpine). Production is served as static files via nginx. Deploy script: `scripts/deploy_aca.sh` reads config from `.env`.

## MCP Server

`mcp-server/` is a standalone MCP server that exposes `generate_architecture` as a tool for other AI agents.

```bash
cd mcp-server
npm install && npm run build    # First time setup
npm start                       # Run the server (stdio transport)
```

The server reads Azure OpenAI credentials from the project root `.env` file (same vars as the frontend). It supports both `VITE_*` prefixed and plain env var names.

### VS Code configuration

Add to `.vscode/mcp.json` (or user settings) to use as a Copilot tool:

```json
{
  "servers": {
    "azure-architecture": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"]
    }
  }
}
```
