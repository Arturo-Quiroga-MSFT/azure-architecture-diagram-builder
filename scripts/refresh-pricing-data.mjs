#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const pricingParent = join(repoRoot, 'src', 'data', 'pricing');
const currentRoot = join(pricingParent, 'regions');
const stageRoot = join(pricingParent, `.regions-refresh-${process.pid}`);
const backupRoot = join(pricingParent, `.regions-backup-${process.pid}`);
const manifestPath = join(pricingParent, 'snapshot-manifest.json');
const pricingSourcePath = join(repoRoot, 'src', 'data', 'azurePricing.ts');

const regions = ['eastus2', 'australiaeast', 'canadacentral', 'brazilsouth', 'mexicocentral', 'westeurope', 'swedencentral', 'southeastasia'];
const globalStems = new Set(['azure_front_door_service', 'content_delivery_network', 'cdn', 'static_web_apps', 'azure_devops']);
const emptyServiceNames = {
  azure_ai_document_intelligence: 'Azure AI Document Intelligence',
  azure_ai_language: 'Azure AI Language',
  azure_ai_speech: 'Azure AI Speech',
  azure_ai_translator: 'Azure AI Translator',
  azure_ai_vision: 'Azure AI Vision',
  azure_automation: 'Azure Automation',
  azure_backup: 'Azure Backup',
  azure_cache_for_redis: 'Azure Cache for Redis',
  azure_cdn: 'Azure CDN',
  azure_data_lake_storage: 'Azure Data Lake Storage',
  azure_event_grid: 'Azure Event Grid',
  azure_event_hubs: 'Azure Event Hubs',
  azure_iot_central: 'Azure IoT Central',
  azure_iot_hub: 'Azure IoT Hub',
  azure_key_vault: 'Azure Key Vault',
  azure_load_balancer: 'Azure Load Balancer',
  azure_openai_service: 'Azure OpenAI Service',
  azure_sentinel: 'Azure Sentinel',
  azure_service_bus: 'Azure Service Bus',
  azure_signalr_service: 'Azure SignalR Service',
  azure_traffic_manager: 'Azure Traffic Manager',
  cdn: 'CDN',
  cognitive_services: 'Cognitive Services',
  computer_vision: 'Computer Vision',
  form_recognizer: 'Form Recognizer',
  load_balancer: 'Load Balancer',
  site_recovery: 'Site Recovery',
  speech_services: 'Speech Services',
  static_web_apps: 'Static Web Apps',
  text_analytics: 'Text Analytics',
  traffic_manager: 'Traffic Manager',
  translator: 'Translator',
};
const apiVersion = '2023-01-01-preview';
const maxPages = 100;
const maxRetries = 5;
const concurrency = Math.max(1, Math.min(Number(process.env.PRICING_REFRESH_CONCURRENCY || 4), 8));

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

function discoverCatalog() {
  const stems = new Set();
  for (const region of regions) {
    const dir = join(currentRoot, region);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) if (file.endsWith('.json')) stems.add(basename(file, '.json'));
  }

  const catalog = [];
  for (const stem of [...stems].sort()) {
    const serviceNames = new Set();
    for (const region of regions) {
      const data = readJson(join(currentRoot, region, `${stem}.json`));
      for (const item of data?.Items || []) if (item.serviceName) serviceNames.add(item.serviceName);
    }
    const serviceName = serviceNames.size === 1 ? [...serviceNames][0] : emptyServiceNames[stem];
    if (!serviceName) {
      throw new Error(`Cannot resolve one Azure Retail Prices serviceName for ${stem}: ${[...serviceNames].join(', ') || 'no existing items'}`);
    }
    catalog.push({ stem, serviceName, global: globalStems.has(stem) });
  }
  return catalog;
}

function buildInitialUrl(serviceName, region) {
  const clauses = [`serviceName eq '${serviceName.replaceAll("'", "''")}'`, "priceType eq 'Consumption'"];
  if (region) clauses.push(`armRegionName eq '${region}'`);
  const params = new URLSearchParams({ 'api-version': apiVersion, '$filter': clauses.join(' and '), '$top': '1000' });
  return `https://prices.azure.com/api/retail/prices?${params.toString()}`;
}

function normalizeNextPageLink(value) {
  if (!value) return null;
  const url = new URL(value);
  // The Retail Prices preview API currently emits `$top=0` on some large
  // result continuations (for example Virtual Machines). Following that URL
  // returns HTTP 400. Preserve the requested page size while keeping Azure's
  // server-provided filter and skip token unchanged.
  if (url.searchParams.get('$top') === '0') url.searchParams.set('$top', '1000');
  return url.toString();
}

async function fetchJson(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(120_000) });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 240)}`);
      const data = JSON.parse(text);
      if (!Array.isArray(data.Items)) throw new Error(`response has no Items array: ${text.slice(0, 240)}`);
      return data;
    } catch (error) {
      lastError = error;
      console.warn(`[pricing-refresh] ${label} attempt ${attempt}/${maxRetries} failed: ${error instanceof Error ? error.message : error}`);
      if (attempt < maxRetries) await sleep(750 * attempt);
    }
  }
  throw new Error(`${label} failed after ${maxRetries} attempts: ${lastError instanceof Error ? lastError.message : lastError}`);
}

async function fetchAllPages(serviceName, region) {
  const label = `${serviceName}${region ? ` / ${region}` : ' / global'}`;
  let nextUrl = buildInitialUrl(serviceName, region);
  let pages = 0;
  const items = [];
  let billingCurrency = 'USD';

  while (nextUrl) {
    if (pages >= maxPages) throw new Error(`${label} exceeded ${maxPages} pages`);
    const data = await fetchJson(nextUrl, label);
    billingCurrency = data.BillingCurrency || billingCurrency;
    items.push(...data.Items);
    nextUrl = normalizeNextPageLink(data.NextPageLink);
    pages++;
  }

  return { BillingCurrency: billingCurrency, Items: items, NextPageLink: null, Count: items.length, pages };
}

function writeSnapshotFile(root, region, stem, result) {
  const dir = join(root, region);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stem}.json`), `${JSON.stringify({
    BillingCurrency: result.BillingCurrency,
    Items: result.Items,
    NextPageLink: null,
    Count: result.Items.length,
  })}\n`);
}

async function runTasks(tasks, worker) {
  let index = 0;
  let firstError;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      if (firstError) return;
      const taskIndex = index++;
      if (taskIndex >= tasks.length) return;
      try {
        await worker(tasks[taskIndex], taskIndex + 1, tasks.length);
      } catch (error) {
        firstError = firstError || error;
      }
    }
  });
  await Promise.allSettled(runners);
  if (firstError) throw firstError;
}

function validateStage(expectedStems) {
  for (const region of regions) {
    const dir = join(stageRoot, region);
    const files = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.json')).sort() : [];
    const expected = [...expectedStems].map((stem) => `${stem}.json`).sort();
    if (JSON.stringify(files) !== JSON.stringify(expected)) throw new Error(`${region} inventory mismatch: expected ${expected.length}, found ${files.length}`);
    for (const file of files) {
      const data = readJson(join(dir, file));
      if (!data || !Array.isArray(data.Items)) throw new Error(`${region}/${file} is malformed`);
      if (data.NextPageLink) throw new Error(`${region}/${file} still has NextPageLink`);
      if (data.Count !== data.Items.length) throw new Error(`${region}/${file} Count does not match Items length`);
    }
  }
}

function stampPricingDate(date) {
  const source = readFileSync(pricingSourcePath, 'utf8');
  const updated = source.replace(/export const PRICING_DATA_AS_OF = '[0-9-]+';/, `export const PRICING_DATA_AS_OF = '${date}';`);
  if (updated === source) throw new Error('Could not update PRICING_DATA_AS_OF');
  writeFileSync(pricingSourcePath, updated);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function main() {
  if (!existsSync(currentRoot)) throw new Error(`Current pricing root not found: ${currentRoot}`);
  const startedAt = new Date().toISOString();
  const catalog = discoverCatalog();
  const stems = new Set(catalog.map((item) => item.stem));
  const groups = new Map();
  for (const item of catalog) {
    const key = `${item.global ? 'global' : 'regional'}|${item.serviceName}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });
  const tasks = [];
  for (const [key, entries] of groups) {
    if (entries[0].global) tasks.push({ key, entries, region: null });
    else for (const region of regions) tasks.push({ key, entries, region });
  }

  if (process.argv.includes('--catalog-only')) {
    console.log(JSON.stringify({
      regions,
      filesPerRegion: stems.size,
      uniqueServiceQueries: groups.size,
      downloadTasks: tasks.length,
      catalog,
    }, null, 2));
    return;
  }

  const records = [];
  console.log(`[pricing-refresh] ${catalog.length} files/region, ${groups.size} unique service queries, ${tasks.length} paginated downloads, concurrency ${concurrency}`);
  await runTasks(tasks, async (task, number, total) => {
    const serviceName = task.entries[0].serviceName;
    const result = await fetchAllPages(serviceName, task.region);
    const targetRegions = task.region ? [task.region] : regions;
    for (const region of targetRegions) {
      for (const entry of task.entries) writeSnapshotFile(stageRoot, region, entry.stem, result);
    }
    records.push({ serviceName, scope: task.region || 'global', stems: task.entries.map((entry) => entry.stem), pages: result.pages, items: result.Items.length });
    console.log(`[pricing-refresh] ${number}/${total} ${serviceName} ${task.region || 'global'}: ${result.Items.length} items, ${result.pages} page(s)`);
  });

  validateStage(stems);
  const completedAt = new Date().toISOString();
  const snapshotDate = completedAt.slice(0, 10);
  const manifest = {
    schemaVersion: 1,
    startedAt,
    completedAt,
    snapshotDate,
    source: 'Azure Retail Prices API',
    apiVersion,
    currency: 'USD',
    regions,
    filesPerRegion: stems.size,
    uniqueServiceQueries: groups.size,
    downloadTasks: tasks.length,
    totalPages: records.reduce((sum, item) => sum + item.pages, 0),
    totalItemsAcrossQueries: records.reduce((sum, item) => sum + item.items, 0),
    emptyDownloads: records.filter((item) => item.items === 0).map((item) => ({ serviceName: item.serviceName, scope: item.scope })),
    downloads: records.sort((a, b) => `${a.serviceName}|${a.scope}`.localeCompare(`${b.serviceName}|${b.scope}`)),
  };
  writeFileSync(join(stageRoot, '..', `.snapshot-manifest-${process.pid}.json`), `${JSON.stringify(manifest, null, 2)}\n`);

  let swapped = false;
  try {
    renameSync(currentRoot, backupRoot);
    renameSync(stageRoot, currentRoot);
    swapped = true;
    stampPricingDate(snapshotDate);
    const tempManifest = join(pricingParent, `.snapshot-manifest-${process.pid}.json`);
    renameSync(tempManifest, manifestPath);
    manifest.manifestSha256 = sha256(manifestPath);
    rmSync(backupRoot, { recursive: true, force: true });
  } catch (error) {
    if (swapped) {
      rmSync(currentRoot, { recursive: true, force: true });
      renameSync(backupRoot, currentRoot);
    }
    throw error;
  }

  console.log(`[pricing-refresh] complete: ${snapshotDate}; ${stems.size} files in each of ${regions.length} regions; manifest ${manifestPath}`);
}

main().catch((error) => {
  console.error(`[pricing-refresh] FAILED: ${error instanceof Error ? error.stack || error.message : error}`);
  rmSync(stageRoot, { recursive: true, force: true });
  process.exit(1);
});
