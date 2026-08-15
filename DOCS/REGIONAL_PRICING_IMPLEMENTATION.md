# Regional Pricing Implementation

**Last validated:** August 15, 2026

## Scope

AADB bundles an Azure Retail Prices API snapshot for these 14 regions:

- East US 2
- Central US
- West US 2
- Australia East
- Canada Central
- Brazil South
- Mexico Central
- West Europe
- North Europe
- UK South
- Sweden Central
- Southeast Asia
- Japan East
- Central India

The UI loads the selected region's bundled files and recalculates node estimates when the region changes. These are snapshot-derived estimates, not live quotes. `PRICING_DATA_AS_OF` is the snapshot fetch date; individual meters can have earlier effective dates.

## Snapshot Integrity

The August 15 snapshot was fetched from Azure Retail Prices API preview `2023-01-01-preview` with pagination enabled, throttle-aware retries, and staged atomic replacement.

| Check | Measured result |
|---|---:|
| Regions | 14 |
| Files per region | 80 |
| Total files | 1,120 |
| API pages fetched | 1,177 |
| Items returned across unique queries | 174,981 |
| Snapshot inventory SHA-256 | `0c06fd94da961a095b3a9f6084dac978fbcca37ca3c58849ac288c245257030a` |
| Raw Consumption meter records in regional files | 188,488 |
| Raw records carrying a real one-year Savings Plan | 27,307 (14.5%) |
| Empty regional inventory files retained | 460 |
| Files with unresolved continuation links | 0 |
| Wrong-region items in non-global files | 0 |
| Disallowed default selections (Spot/Low Priority/secondary/failover/passive) | 0 |

The manifest is stored at `src/data/pricing/snapshot-manifest.json`. Empty files are retained so every region has the same query inventory; an empty result is not presented as a price.

## Price Selection

For each service node, AADB:

1. Maps display-name aliases to an Azure pricing service.
2. Loads Consumption meters for the selected region.
3. Excludes Spot and Low Priority meters from defaults.
4. Selects the configured default SKU using normalized exact matching.
5. Uses a documented static fallback when that SKU is unavailable.
6. Shows no estimate when neither a matching meter nor a documented fallback exists.

The node badge, architecture total, cost breakdown, and exports use the same mode-aware calculator and quantity scaling.

## PAYG Provenance

The UI identifies each PAYG estimate as one of:

- `retail-payg`: selected Azure Retail Prices API meter.
- `static-payg`: documented fallback estimate, potentially region-adjusted.
- `custom`: user-provided monthly price.

The August 15 semantic audit evaluated 2,576 service-label/region combinations:

| PAYG source | Combinations |
|---|---:|
| Retail API meter | 1,295 |
| Static fallback | 1,243 |
| No supported estimate | 38 |

Unsupported combinations remain explicit; AADB does not fabricate a zero-dollar
price when neither a selected Retail API meter nor a documented static fallback
exists.

## One-Year Mode

The `1yr estimate` mode uses exact SKU-specific Savings Plan coverage only. It
is not a claim that every service has a reserved or Savings Plan offer.

Selection order:

1. Use the selected SKU's embedded real 1-year Savings Plan rate when present.
2. Leave usage-based services, services without an offer, and custom prices unchanged at PAYG/custom values.

| One-year source | Combinations |
|---|---:|
| Real SKU-specific Savings Plan meter | 56 |
| Usage-based estimate unchanged at PAYG | 1,068 |
| No offer; unchanged at PAYG | 1,414 |
| Unsupported because no PAYG value exists | 38 |

The 56 real-meter combinations are duplicate display labels for two underlying defaults available across all 14 regions: Virtual Machines/VM Scale Sets using D2s v3, and MySQL using Standard_B2ms2. Tooltips and exports expose provenance per node.

## MCP Pricing

The MCP server uses a distilled sidecar generated from the same snapshot. It stores one-year values per selected low/expected/high SKU and never applies one SKU's discount ratio to another SKU. In one-year mode, a tier uses its real SKU-specific meter when available; unavailable tiers remain PAYG and `reservedApplied` reports the selected tier's actual behavior.

## Refresh and Validation

```bash
npm run pricing:refresh
npm run pricing:audit
npx tsx scripts/audit-pricing-semantics.ts --json=/tmp/aadb-pricing-semantics.json
npm run test:pricing-mode
npm run build
npm run mcp:build
```

`pricing:refresh` writes to a staging directory, validates all regional inventories and continuation links, then replaces the checked-in snapshot and updates `PRICING_DATA_AS_OF`. A failed refresh leaves the previous snapshot intact.

## Limitations

- Estimates exclude negotiated agreements, taxes, support, free grants, and architecture-specific utilization unless represented by a custom price.
- Static PAYG fallbacks are estimates, not Azure quotes.
- A snapshot being complete does not mean every Azure service publishes every meter in every region.
- Savings Plan availability is SKU-specific. The mixed one-year total must not be described as universally reserved pricing.