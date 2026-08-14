# Azure Services Pricing Coverage

**Snapshot fetched:** August 13, 2026

This page is a short coverage index. See `REGIONAL_PRICING_IMPLEMENTATION.md` for selection rules, provenance, limitations, and validation commands.

## Regions

The same 80-query inventory is bundled for East US 2, Australia East, Canada Central, Brazil South, Mexico Central, West Europe, Sweden Central, and Southeast Asia.

Each regional folder contains 80 JSON files. Files can be empty when the Retail Prices API publishes no matching regional records. Empty files are retained as explicit evidence of the query result and are never treated as a zero-dollar price.

## Data Sources

- Azure Retail Prices API Consumption meters.
- Product-filtered Foundry model and AI tool records.
- Documented static fallback estimates in `src/data/azurePricing.ts`.
- Optional user-provided custom prices.

The app does not query Azure pricing at user runtime. It lazy-loads files from the bundled snapshot.

## Measured Semantic Coverage

Across 184 recognized service labels and eight regions:

| Outcome | Combinations |
|---|---:|
| Retail API PAYG meter | 732 |
| Static PAYG fallback | 716 |
| No supported PAYG estimate | 24 |
| Real one-year Savings Plan meter for the default SKU | 32 |
| Representative one-year percentage estimate | 168 |
| One-year mode unchanged from PAYG | 1,272 |

The 184 labels include aliases, so these counts measure UI label/region behavior rather than 184 distinct Azure products.

## Unsupported Regional Combinations

- Batch: all eight regions.
- Bot Service: all eight regions.
- Content Safety: Canada Central, Brazil South, Mexico Central, Southeast Asia.
- Custom Vision: Canada Central, Brazil South, Mexico Central.
- Face: Mexico Central.

These combinations show no estimate unless the user supplies a custom price.

## Proven Default Corrections

- Virtual Machine aliases and VM Scale Sets use the Virtual Machines D2s v3 default in all eight regions.
- MySQL uses Standard_B2ms2, present exactly once in each regional snapshot.
- Custom Vision uses S0 where the regional product records exist.
- Active Directory resolves to the Microsoft Entra ID pricing configuration.
- Spot and Low Priority meters are excluded from default selection.

## Audit

```bash
npm run pricing:audit
npm run pricing:audit-semantics -- --json=/tmp/aadb-pricing-semantics.json
```

The structural audit verifies files, inventories, JSON shape, and pagination completion. The semantic audit verifies the actual default-selection and provenance outcomes used by the UI.