#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const repoRoot = resolve(here, '..');
const pricingRoot = join(repoRoot, 'src', 'data', 'pricing', 'regions');
const manifestPath = join(repoRoot, 'src', 'data', 'pricing', 'snapshot-manifest.json');
const expectedRegions = JSON.parse(readFileSync(join(here, 'pricing-regions.json'), 'utf8'));
const canonicalRegion = 'eastus2';
const globalStems = new Set(['azure_front_door_service', 'content_delivery_network', 'cdn', 'static_web_apps', 'azure_devops']);

function readJson(file) {
  try {
    return { data: JSON.parse(readFileSync(file, 'utf8')), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

const canonicalFiles = new Set(
  readdirSync(join(pricingRoot, canonicalRegion)).filter((file) => file.endsWith('.json')),
);
const manifest = readJson(manifestPath).data;
const inventoryHash = createHash('sha256');
for (const region of [...expectedRegions].sort()) {
  for (const file of [...canonicalFiles].sort()) {
    inventoryHash.update(`${region}/${file}`);
    inventoryHash.update('\0');
    inventoryHash.update(readFileSync(join(pricingRoot, region, file)));
    inventoryHash.update('\0');
  }
}
const actualInventorySha256 = inventoryHash.digest('hex');

const report = {
  generatedAt: new Date().toISOString(),
  pricingRoot,
  canonicalRegion,
  expectedRegions,
  expectedInventorySha256: manifest?.snapshotInventorySha256 ?? null,
  actualInventorySha256,
  regions: {},
  totals: {
    files: 0,
    malformedFiles: 0,
    emptyFiles: 0,
    filesWithNextPageLink: 0,
    consumptionItems: 0,
    itemsWith1yrSavingsPlan: 0,
    regionalItemMismatches: 0,
  },
  verdicts: [],
};

for (const region of expectedRegions) {
  const regionDir = join(pricingRoot, region);
  const files = existsSync(regionDir)
    ? readdirSync(regionDir).filter((file) => file.endsWith('.json')).sort()
    : [];
  const fileSet = new Set(files);
  const missingFiles = [...canonicalFiles].filter((file) => !fileSet.has(file));
  const extraFiles = files.filter((file) => !canonicalFiles.has(file));
  const details = [];
  let malformedFiles = 0;
  let emptyFiles = 0;
  let filesWithNextPageLink = 0;
  let consumptionItems = 0;
  let itemsWith1yrSavingsPlan = 0;
  let regionalItemMismatches = 0;
  let oldestEffective = '';
  let newestEffective = '';
  let newestMtime = '';

  for (const file of files) {
    const filePath = join(regionDir, file);
    const { data, error } = readJson(filePath);
    const mtime = statSync(filePath).mtime.toISOString();
    if (!newestMtime || mtime > newestMtime) newestMtime = mtime;
    if (error || !data || !Array.isArray(data.Items)) {
      malformedFiles++;
      details.push({ file, status: 'malformed', error });
      continue;
    }
    const items = data.Items;
    if (items.length === 0) emptyFiles++;
    if (data.NextPageLink) filesWithNextPageLink++;
    let fileConsumption = 0;
    let fileSavings = 0;
    for (const item of items) {
      if (item.type === 'Consumption') fileConsumption++;
      if (Array.isArray(item.savingsPlan) && item.savingsPlan.some((plan) => /1\s*year/i.test(plan.term || ''))) fileSavings++;
      if (!globalStems.has(basename(file, '.json')) && String(item.armRegionName || '').toLowerCase() !== region) {
        regionalItemMismatches++;
      }
      const effective = String(item.effectiveStartDate || '').slice(0, 10);
      if (effective && (!oldestEffective || effective < oldestEffective)) oldestEffective = effective;
      if (effective && (!newestEffective || effective > newestEffective)) newestEffective = effective;
    }
    consumptionItems += fileConsumption;
    itemsWith1yrSavingsPlan += fileSavings;
    if (items.length === 0 || data.NextPageLink || fileSavings > 0) {
      details.push({ file, items: items.length, consumptionItems: fileConsumption, itemsWith1yrSavingsPlan: fileSavings, hasNextPageLink: Boolean(data.NextPageLink) });
    }
  }

  report.regions[region] = {
    fileCount: files.length,
    missingFiles,
    extraFiles,
    malformedFiles,
    emptyFiles,
    filesWithNextPageLink,
    consumptionItems,
    itemsWith1yrSavingsPlan,
    regionalItemMismatches,
    oneYearRawMeterCoveragePercent: consumptionItems ? Number((100 * itemsWith1yrSavingsPlan / consumptionItems).toFixed(1)) : 0,
    oldestEffective: oldestEffective || null,
    newestEffective: newestEffective || null,
    newestFileModifiedAt: newestMtime || null,
    noteworthyFiles: details,
  };

  report.totals.files += files.length;
  report.totals.malformedFiles += malformedFiles;
  report.totals.emptyFiles += emptyFiles;
  report.totals.filesWithNextPageLink += filesWithNextPageLink;
  report.totals.consumptionItems += consumptionItems;
  report.totals.itemsWith1yrSavingsPlan += itemsWith1yrSavingsPlan;
  report.totals.regionalItemMismatches += regionalItemMismatches;
}

report.totals.oneYearRawMeterCoveragePercent = report.totals.consumptionItems
  ? Number((100 * report.totals.itemsWith1yrSavingsPlan / report.totals.consumptionItems).toFixed(1))
  : 0;

if (report.totals.malformedFiles > 0) report.verdicts.push('FAIL: malformed pricing files exist.');
if (report.totals.filesWithNextPageLink > 0) report.verdicts.push('FAIL: snapshot contains unconsumed NextPageLink values and is truncated.');
if (report.totals.regionalItemMismatches > 0) report.verdicts.push('FAIL: non-global pricing files contain meters from the wrong Azure region.');
if (!report.expectedInventorySha256 || report.expectedInventorySha256 !== report.actualInventorySha256) report.verdicts.push('FAIL: snapshot inventory SHA-256 does not match the manifest.');
if (Object.values(report.regions).some((region) => region.missingFiles.length > 0)) report.verdicts.push('FAIL: regional file inventories are inconsistent.');
if (report.totals.itemsWith1yrSavingsPlan < report.totals.consumptionItems) report.verdicts.push('INFO: real one-year Savings Plan rates exist for only a subset of raw consumption meters.');
if (report.verdicts.length === 0) report.verdicts.push('PASS: structural snapshot checks passed.');

const outputArg = process.argv.find((arg) => arg.startsWith('--json='));
if (outputArg) {
  const output = outputArg.slice('--json='.length);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}

console.log('Azure pricing snapshot coverage');
console.log(`Regions: ${expectedRegions.length}; files: ${report.totals.files}; malformed: ${report.totals.malformedFiles}; empty: ${report.totals.emptyFiles}; paginated/truncated: ${report.totals.filesWithNextPageLink}; wrong-region items: ${report.totals.regionalItemMismatches}`);
console.log(`Raw Consumption meters: ${report.totals.consumptionItems}; with real 1-year Savings Plan: ${report.totals.itemsWith1yrSavingsPlan} (${report.totals.oneYearRawMeterCoveragePercent}%)`);
console.log(`Snapshot inventory SHA-256: ${report.actualInventorySha256} (${report.actualInventorySha256 === report.expectedInventorySha256 ? 'matches manifest' : 'MISMATCH'})`);
for (const region of expectedRegions) {
  const item = report.regions[region];
  console.log(`${region.padEnd(18)} files=${String(item.fileCount).padEnd(3)} missing=${String(item.missingFiles.length).padEnd(2)} empty=${String(item.emptyFiles).padEnd(2)} truncated=${item.filesWithNextPageLink} wrongRegion=${item.regionalItemMismatches} real1yrRaw=${item.oneYearRawMeterCoveragePercent}% newestMeter=${item.newestEffective || 'n/a'}`);
}
for (const verdict of report.verdicts) console.log(verdict);

if (report.totals.malformedFiles > 0 || report.totals.filesWithNextPageLink > 0 || report.totals.regionalItemMismatches > 0 || report.actualInventorySha256 !== report.expectedInventorySha256 || Object.values(report.regions).some((region) => region.missingFiles.length > 0)) {
  process.exitCode = 1;
}
