#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Build-time helper: distill the web app's raw Azure Retail Prices JSON
 * (src/data/pricing/regions/<region>/<service>.json — ~25 MB across 8 regions)
 * into a compact per-region sidecar the MCP server can bundle and query at
 * runtime WITHOUT shipping the full dataset.
 *
 * This mirrors sync-icon-map.mjs: the source of truth stays in the web app;
 * we generate a small derived artifact (src/pricing.generated.json, a few KB).
 *
 * Parity note: the monthly-cost derivation replicates the web app's
 * regionalPricingService.parsePricingTiers() unit-of-measure handling
 * (/Month as-is, /Day ×30, per-1K ×100, else hourly ×730) so numbers line up.
 *
 * AI (foundry_*) and Microsoft Fabric files need special per-product / F-SKU
 * handling and are intentionally skipped in this first cut — those services
 * fall back to the catalog costRange in estimate_costs. (Tracked for P0-1b.)
 *
 * Run: node mcp-server/scripts/sync-pricing-data.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const regionsRoot = resolve(repoRoot, 'src', 'data', 'pricing', 'regions');
const outPath = resolve(here, '..', 'src', 'pricing.generated.json');

// Files that require special parsing (AI per-product filtering, Fabric F-SKU).
// Skipped for now; those services keep their catalog costRange fallback.
const SKIP_FILES = new Set(['foundry_models', 'foundry_tools', 'microsoft_fabric']);

const HOURS_PER_MONTH = 730;

/** Compute a monthly price from a single retail-price item (parity with web app). */
function monthlyFromItem(item) {
  const unit = (item.unitOfMeasure || '1 Hour');
  const rate = item.retailPrice || item.unitPrice || 0;
  if (unit.includes('/Month') || unit.includes('1/Month')) return rate;
  if (unit.includes('/Day') || unit.includes('1/Day')) return rate * 30;
  if (unit === '1K' || unit.includes('1000')) return rate * 100;
  return rate * HOURS_PER_MONTH;
}

/** Median of a numeric array (sorted copy). */
function median(nums) {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Distill one service JSON file into representative monthly costs.
 * Returns null when there is no usable Consumption pricing.
 */
function distillFile(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
  const items = Array.isArray(parsed.Items) ? parsed.Items : [];
  const currency = parsed.BillingCurrency || 'USD';

  // Consumption meters only (exclude reservations/spot rows; those are handled
  // via each item's savingsPlan for the reserved-term estimate).
  const consumption = items.filter((i) => i.type === 'Consumption');
  if (consumption.length === 0) return null;

  // Dedupe to the cheapest monthly per SKU (matches web app tier parsing).
  const perSku = new Map();
  const savingsRatios = [];
  let newestDate = '';

  for (const item of consumption) {
    const sku = item.skuName || item.armSkuName;
    if (!sku) continue;
    const monthly = monthlyFromItem(item);
    if (!perSku.has(sku) || monthly < perSku.get(sku)) perSku.set(sku, monthly);

    if (item.effectiveStartDate && item.effectiveStartDate > newestDate) {
      newestDate = item.effectiveStartDate;
    }

    // 1-Year savings-plan ratio (reserved-term discount) when present.
    const plans = Array.isArray(item.savingsPlan) ? item.savingsPlan : [];
    const oneYear = plans.find((p) => /1\s*year/i.test(p.term || ''));
    const retail = item.retailPrice || item.unitPrice || 0;
    if (oneYear && retail > 0) {
      const rp = oneYear.unitPrice || oneYear.retailPrice || 0;
      if (rp > 0) savingsRatios.push(rp / retail);
    }
  }

  const monthlies = [...perSku.values()].filter((n) => Number.isFinite(n));
  if (monthlies.length === 0) return null;

  const sorted = [...monthlies].sort((a, b) => a - b);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const expected = median(sorted);

  // Representative SKU = the one whose monthly is closest to the median.
  let sampleSku = '';
  let bestDelta = Infinity;
  for (const [sku, m] of perSku.entries()) {
    const d = Math.abs(m - expected);
    if (d < bestDelta) { bestDelta = d; sampleSku = sku; }
  }

  const reservedRatio = savingsRatios.length ? median(savingsRatios) : null;

  return {
    low: round2(low),
    expected: round2(expected),
    high: round2(high),
    reservedExpected: reservedRatio != null ? round2(expected * reservedRatio) : null,
    reservedRatio: reservedRatio != null ? round2(reservedRatio) : null,
    currency,
    sampleSku,
    tierCount: monthlies.length,
    pricesAsOf: newestDate ? newestDate.slice(0, 10) : null,
  };
}

function main() {
  if (!existsSync(regionsRoot)) {
    console.error(`[sync-pricing] regions dir not found: ${regionsRoot}`);
    process.exit(1);
  }

  const regions = readdirSync(regionsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'src/data/pricing/regions (Azure Retail Prices snapshot)',
    hoursPerMonth: HOURS_PER_MONTH,
    currency: 'USD',
    regions: {},
  };

  let totalEntries = 0;
  for (const region of regions) {
    const dir = resolve(regionsRoot, region);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    const regionMap = {};
    for (const file of files) {
      const stem = basename(file, '.json');
      if (SKIP_FILES.has(stem)) continue;
      const distilled = distillFile(resolve(dir, file));
      if (distilled) {
        regionMap[stem] = distilled;
        totalEntries++;
      }
    }
    out.regions[region] = regionMap;
  }

  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(
    `[sync-pricing] wrote ${outPath} — ${regions.length} regions, ${totalEntries} service entries`,
  );
}

main();
