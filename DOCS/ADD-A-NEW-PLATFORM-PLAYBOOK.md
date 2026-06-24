# Add a New Platform Playbook

A repeatable recipe for adding a new product family (Microsoft Fabric, Power
Platform, Dynamics 365, Microsoft 365, etc.) to the diagram builder so its
services appear in the icon palette, resolve to branded icons in AI‑generated
diagrams, and estimate cost consistently with the rest of the app.

Microsoft Fabric is used throughout as the worked example (see commit history on
`feat/fabric-support`).

## Integration points

A platform touches five places. Only the first three are required; the last two
improve quality and parity.

| # | File / location | Purpose |
|---|---|---|
| 1 | `Azure_Public_Service_Icons/Icons/<category>/*.svg` | The branded SVG icons |
| 2 | `src/utils/iconLoader.ts` (`iconCategories`) | Adds the palette category |
| 3 | `src/data/serviceIconMapping.ts` (`SERVICE_ICON_MAP` + category union) | Maps service names/aliases → icon + pricing flags |
| 4 | `src/data/azurePricing.ts` (`FALLBACK_PRICING`, `USAGE_BASED_SERVICES`) | Cost estimates |
| 5 | `src/services/azureOpenAI.ts` (generation prompt) + `mcp-server` icon map | AI hints + MCP parity |

## Step 1 — Get the official icons

Microsoft publishes architecture icon sets per platform (all share the same
terms of use). Find the right one — make sure it is the **architecture/product**
set, not a developer/UI icon library:

- Azure: <https://learn.microsoft.com/azure/architecture/icons>
- Microsoft Fabric: <https://learn.microsoft.com/fabric/fundamentals/icons>
- Power Platform: <https://learn.microsoft.com/power-platform/guidance/icons>
- Dynamics 365: <https://learn.microsoft.com/dynamics365/get-started/icons>
- Microsoft Entra: <https://learn.microsoft.com/entra/architecture/architecture-icons>

> Worked example pitfall: the Fabric `@fabric-msft/svg-icons` npm package is a
> Fluent **UI** icon library. The branded product icons are the `*_item` /
> `*_color` variants — confirm you are using the architecture icons.

## Step 2 — Curate and place the SVGs

Pick ~12–20 core services. Copy the chosen SVGs into a new category folder using
kebab‑case filenames that you will reference as `iconFile`:

```bash
# Example for Fabric (run from repo root)
mkdir -p "Azure_Public_Service_Icons/Icons/fabric"
cp "<source>/lakehouse_32_item.svg" "Azure_Public_Service_Icons/Icons/fabric/fabric-lakehouse.svg"
# ...repeat per service
```

Icons resolve at runtime as
`/Azure_Public_Service_Icons/Icons/${category}/${iconFile}.svg`, and the palette
loads them via `import.meta.glob('/Azure_Public_Service_Icons/Icons/**/*.svg')` —
no path wiring needed, just the folder and filenames.

## Step 3 — Register the category

Add the new category to the palette list in `src/utils/iconLoader.ts`:

```ts
export const iconCategories = [
  // ...
  'fabric',
  // ...
];
```

…and to the `category` union type in `src/data/serviceIconMapping.ts`:

```ts
category: '...' | 'fabric' | 'other';
```

## Step 4 — Map services to icons and pricing

Add an entry to `SERVICE_ICON_MAP` for each service. Include `aliases` for the
name variants the AI might emit:

```ts
'Lakehouse': {
  displayName: 'Lakehouse',
  aliases: ['Fabric Lakehouse', 'Lakehouse (Bronze)', 'Lakehouse (Silver)', 'Lakehouse (Gold)'],
  iconFile: 'fabric-lakehouse',
  category: 'fabric',
  hasPricingData: false,
  costRange: '$0 (consumes Fabric capacity)'
},
```

`SERVICE_ICON_MAP` is injected into the generation prompt automatically, so new
entries become known services for the AI with no extra wiring.

> Avoid key collisions: `SERVICE_ICON_MAP` is keyed by display name. If a name
> already exists (e.g. `SQL Database`), prefix the new one (`Fabric SQL Database`)
> and capture the short form as an alias.

## Step 5 — Model the cost (fixed vs usage)

Match the platform's real billing model to the app's two cost types:

- **Fixed** (provisioned/hourly/reserved): add to `FALLBACK_PRICING` with
  `basic`/`standard`/`premium` monthly amounts. Leave it out of
  `USAGE_BASED_SERVICES`.
- **Usage‑based** (per‑GB, per‑transaction, per‑token): add to `FALLBACK_PRICING`
  with flat monthly estimates **and** to `USAGE_BASED_SERVICES`.
- **Rolls up to a parent** (consumes a shared capacity/plan): set
  `hasPricingData: false` so the node shows **$0** — the parent carries the cost.
  This mirrors the AML "endpoint = $0, compute has cost" pattern.

Fabric example (`src/data/azurePricing.ts`):

```ts
// Capacity is provisioned (fixed): CU * $0.18/hr * 730 hrs.
'Microsoft Fabric Capacity': { basic: 262.80 /*F2*/, standard: 1051.20 /*F8*/, premium: 8409.60 /*F64*/, unit: 'per capacity/month (F SKU, PAYG)' },
// OneLake is usage-based (per GB/mo).
'OneLake Storage':           { basic: 4.71, standard: 23.55, premium: 235.52, unit: 'per month (storage, ~$0.023/GB)' },
```

Ground the numbers in the official pricing page and cite the source in a code
comment. All other platform items stay `hasPricingData: false` ($0).

## Step 6 — Add a generation prompt hint (optional, recommended)

Add the category to the icon‑categories line and a short rule in the generation
system prompt (`src/services/azureOpenAI.ts`) so the AI groups the platform and
applies the cost model, e.g.:

> MICROSOFT FABRIC: put Fabric items in a group named "Microsoft Fabric", set
> their category to "fabric", and include "Microsoft Fabric Capacity" (the billed
> F SKU) and "OneLake" — items consume the shared capacity, which carries the cost.

## Step 7 — Refresh MCP parity (optional)

If the repo's MCP server is used, regenerate its icon map so it resolves the new
icons too:

```bash
cd mcp-server && npm run sync:icons
```

## Step 8 — Verify

```bash
npm run build            # tsc + vite must pass
npm run dev:avatar       # restart so new SVG files are picked up by Vite
```

Then in the UI:

1. The new category appears in the **icon palette** with branded icons.
2. A prompt that names the services produces a diagram where each resolves to its
   icon (no generic fallback).
3. The **cost panel** shows the fixed cost on the capacity/plan, usage‑based items
   estimated, and rolled‑up items at $0.

## Checklist

- [ ] Official **architecture** icons obtained (not a UI icon library)
- [ ] SVGs placed in `Icons/<category>/` with kebab‑case `iconFile` names
- [ ] Category added to `iconLoader.ts` and the `serviceIconMapping.ts` union
- [ ] `SERVICE_ICON_MAP` entries with aliases, no key collisions
- [ ] Pricing modeled (fixed / usage / $0‑rolls‑up) with sourced numbers
- [ ] Generation prompt hint added
- [ ] MCP icon map regenerated (if applicable)
- [ ] `npm run build` passes; verified in the UI
