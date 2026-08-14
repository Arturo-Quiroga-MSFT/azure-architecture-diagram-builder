# Regional Pricing Implementation

**Last validated:** August 13, 2026

## Scope

AADB bundles an Azure Retail Prices API snapshot for these eight regions:

- East US 2
- Australia East
- Canada Central
- Brazil South
- Mexico Central
- West Europe
- Sweden Central
- Southeast Asia

The UI loads the selected region's bundled files and recalculates node estimates when the region changes. These are snapshot-derived estimates, not live quotes. `PRICING_DATA_AS_OF` is the snapshot fetch date; individual meters can have earlier effective dates.

## Snapshot Integrity

The August 13 snapshot was fetched from Azure Retail Prices API preview `2023-01-01-preview` with pagination enabled and staged before atomic replacement.

| Check | Measured result |
|---|---:|
| Regions | 8 |
| Files per region | 80 |
| Total files | 640 |
| API pages fetched | 672 |
| Items returned across unique queries | 97,756 |
| Files with unresolved continuation links | 0 |

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

The August 13 semantic audit evaluated 1,472 service-label/region combinations:

| PAYG source | Combinations |
|---|---:|
| Retail API meter | 732 |
| Static fallback | 716 |
| No supported estimate | 24 |

The 24 unsupported combinations are Batch and Bot Service in all eight regions, Content Safety in four regions, Custom Vision in three regions, and Face in Mexico Central. AADB does not fabricate a zero-dollar price for these cases.

## One-Year Mode

The `1yr estimate` mode is intentionally labeled as mixed provenance. It is not a claim that every service has a reserved or Savings Plan offer.

Selection order:

1. Use the selected SKU's embedded real 1-year Savings Plan rate when present.
2. Otherwise apply the documented representative percentage only to configured reservation-eligible services.
3. Leave usage-based services, services without an offer, and custom prices unchanged.

| One-year source | Combinations |
|---|---:|
| Real SKU-specific Savings Plan meter | 32 |
| Representative percentage estimate | 168 |
| Usage-based estimate unchanged at PAYG | 616 |
| No offer; unchanged at PAYG | 656 |

The 32 real-meter combinations are duplicate display labels for two underlying defaults available across all eight regions: Virtual Machines/VM Scale Sets using D2s v3, and MySQL using Standard_B2ms2. Tooltips and exports expose provenance per node.

## MCP Pricing

The MCP server uses a distilled sidecar generated from the same snapshot. It stores one-year values per selected low/expected/high SKU and never applies one SKU's discount ratio to another SKU. In one-year mode, a tier uses its real SKU-specific meter when available; unavailable tiers remain PAYG and `reservedApplied` reports the selected tier's actual behavior.

## Refresh and Validation

```bash
npm run pricing:refresh
npm run pricing:audit
npm run pricing:audit-semantics -- --json=/tmp/aadb-pricing-semantics.json
npm run test:pricing-mode
npm run build
npm run mcp:build
```

`pricing:refresh` writes to a staging directory, validates all regional inventories and continuation links, then replaces the checked-in snapshot and updates `PRICING_DATA_AS_OF`. A failed refresh leaves the previous snapshot intact.

## Limitations

- Estimates exclude negotiated agreements, taxes, support, free grants, and architecture-specific utilization unless represented by a custom price.
- Static and percentage fallbacks are estimates, not Azure quotes.
- A snapshot being complete does not mean every Azure service publishes every meter in every region.
- Savings Plan availability is SKU-specific. The mixed one-year total must not be described as universally reserved pricing.