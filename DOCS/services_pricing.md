# Azure Services Pricing Coverage

**Snapshot fetched:** August 15, 2026

This page is a short coverage index. See `REGIONAL_PRICING_IMPLEMENTATION.md` for selection rules, provenance, limitations, and validation commands.

## Regions

The same 80-query inventory is bundled for East US 2, Central US, West US 2,
Australia East, Canada Central, Brazil South, Mexico Central, West Europe,
North Europe, UK South, Sweden Central, Southeast Asia, Japan East, and Central
India.

Each regional folder contains 80 JSON files. Files can be empty when the Retail Prices API publishes no matching regional records. Empty files are retained as explicit evidence of the query result and are never treated as a zero-dollar price.

## Data Sources

- Azure Retail Prices API Consumption meters.
- Product-filtered Foundry model and AI tool records.
- Documented static fallback estimates in `src/data/azurePricing.ts`.
- Optional user-provided custom prices.

The app does not query Azure pricing at user runtime. It lazy-loads files from the bundled snapshot.

## Measured Semantic Coverage

Across 184 recognized service labels and 14 regions:

| Outcome | Combinations |
|---|---:|
| Retail API PAYG meter | 1,295 |
| Static PAYG fallback | 1,243 |
| No supported PAYG estimate | 38 |
| Real one-year Savings Plan meter for the default SKU | 56 |
| Usage-based one-year mode unchanged from PAYG | 1,068 |
| No one-year offer; unchanged from PAYG | 1,414 |
| Unsupported in one-year mode because no PAYG value exists | 38 |

The 184 labels include aliases, so these counts measure UI label/region behavior rather than 184 distinct Azure products.

## Unsupported Regional Combinations

- Batch: all 14 regions.
- Bot Service: all 14 regions.
- Content Safety: Canada Central, Brazil South, Mexico Central, North Europe,
  Southeast Asia, and Central India.
- Custom Vision: Canada Central, Brazil South, Mexico Central.
- Face: Mexico Central.

These combinations show no estimate unless the user supplies a custom price.

## Proven Default Corrections

- Virtual Machine aliases and VM Scale Sets use the Virtual Machines D2s v3 default in all 14 regions.
- MySQL uses Standard_B2ms2, present exactly once in each regional snapshot.
- Custom Vision uses S0 where the regional product records exist.
- Active Directory resolves to the Microsoft Entra ID pricing configuration.
- Spot, Low Priority, secondary, failover, and passive meters are excluded from default selection.

## Audit

```bash
npm run pricing:audit
npx tsx scripts/audit-pricing-semantics.ts --json=/tmp/aadb-pricing-semantics.json
```

The structural audit verifies files, inventories, JSON shape, and pagination completion. The semantic audit verifies the actual default-selection and provenance outcomes used by the UI.