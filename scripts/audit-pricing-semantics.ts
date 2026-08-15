import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FALLBACK_PRICING,
  SERVICE_NAME_MAPPING,
  USAGE_BASED_SERVICES,
  getDefaultTier,
  hasFallbackPricing,
} from '../src/data/azurePricing';

const regions = JSON.parse(readFileSync(new URL('./pricing-regions.json', import.meta.url), 'utf8')) as string[];
const root = 'src/data/pricing/regions';

const aiProductMap: Record<string, { file: string; productName: string }> = {
  'Azure OpenAI': { file: 'foundry_models', productName: 'Azure OpenAI' },
  'Azure AI Document Intelligence': { file: 'foundry_tools', productName: 'Azure Document Intelligence' },
  'Azure Document Intelligence': { file: 'foundry_tools', productName: 'Azure Document Intelligence' },
  'Document Intelligence': { file: 'foundry_tools', productName: 'Azure Document Intelligence' },
  'Form Recognizer': { file: 'foundry_tools', productName: 'Form Recognizer' },
  'Language': { file: 'foundry_tools', productName: 'Azure Language' },
  'Text Analytics': { file: 'foundry_tools', productName: 'Azure Language' },
  'Speech': { file: 'foundry_tools', productName: 'Azure Speech' },
  'Speech Services': { file: 'foundry_tools', productName: 'Azure Speech' },
  'Vision': { file: 'foundry_tools', productName: 'Azure Vision' },
  'Computer Vision': { file: 'foundry_tools', productName: 'Azure Vision' },
  'Face': { file: 'foundry_tools', productName: 'Azure Vision - Face' },
  'Translator': { file: 'foundry_tools', productName: 'Azure Translator' },
  'Custom Vision': { file: 'foundry_tools', productName: 'Azure Custom Vision' },
  'Content Safety': { file: 'foundry_tools', productName: 'Content Safety' },
};

type RawItem = {
  type?: string; serviceName?: string; productName?: string; skuName?: string; armSkuName?: string;
  retailPrice?: number; unitPrice?: number; unitOfMeasure?: string;
  meterName?: string; savingsPlan?: Array<{ term?: string; retailPrice?: number; unitPrice?: number }>;
};

type Tier = { name: string; monthlyPrice: number; meterName: string; oneYear?: number; unit: string };

function readItems(region: string, serviceName: string): { items: RawItem[]; ai: boolean } {
  const ai = aiProductMap[serviceName];
  const stem = ai?.file || serviceName.toLowerCase().replace(/\s+/g, '_');
  try {
    const data = JSON.parse(readFileSync(join(root, region, `${stem}.json`), 'utf8'));
    const items = (data.Items || []) as RawItem[];
    return { items: ai ? items.filter((item) => item.productName === ai.productName) : items, ai: Boolean(ai) };
  } catch {
    return { items: [], ai: Boolean(ai) };
  }
}

function monthly(rate: number, unit: string): number {
  if (unit.includes('/Month') || unit.includes('1/Month')) return rate;
  if (unit.includes('/Day') || unit.includes('1/Day')) return rate * 30;
  if (unit === '1K' || unit.includes('1000')) return rate * 100;
  return rate * 730;
}

function parseTiers(items: RawItem[], serviceName: string, ai: boolean): Tier[] {
  const tierMap = new Map<string, Tier>();
  const consumption = items.filter((item) => item.type === 'Consumption' && (ai || item.serviceName?.toLowerCase() === serviceName.toLowerCase()));
  for (const item of consumption) {
    const name = item.skuName || item.armSkuName;
    if (!name) continue;
    const meterIdentity = `${name} ${item.armSkuName || ''} ${item.meterName || ''} ${item.productName || ''}`;
    if (/spot|low priority|secondary|failover|passive/i.test(meterIdentity)) continue;
    const unit = item.unitOfMeasure || '1 Hour';
    const rate = item.retailPrice || item.unitPrice || 0;
    const payg = monthly(rate, unit);
    const plan = item.savingsPlan?.find((candidate) => /1\s*year/i.test(candidate.term || ''));
    const planRate = plan ? (plan.retailPrice || plan.unitPrice || 0) : 0;
    const tier = { name, monthlyPrice: payg, meterName: item.meterName || '', oneYear: planRate > 0 ? monthly(planRate, unit) : undefined, unit };
    if (!tierMap.has(name) || (tierMap.get(name)?.monthlyPrice ?? Infinity) > payg) tierMap.set(name, tier);
  }
  return [...tierMap.values()].sort((left, right) => left.monthlyPrice - right.monthlyPrice);
}

function normalizeTierName(value: string): string {
  return String(value || '').toLowerCase().replace(/^standard[_\s-]*/, '').replace(/[^a-z0-9]/g, '');
}

function findTier(tiers: Tier[], requested: string): Tier | undefined {
  return tiers.find((tier) => tier.name === requested)
    || tiers.find((tier) => normalizeTierName(tier.name) === normalizeTierName(requested));
}

const serviceTypes = [...new Set([...Object.keys(FALLBACK_PRICING), ...Object.keys(SERVICE_NAME_MAPPING)])].sort();
const rows = [] as Array<Record<string, unknown>>;

for (const region of regions) {
  for (const serviceType of serviceTypes) {
    const serviceName = SERVICE_NAME_MAPPING[serviceType] || serviceType;
    const defaultTier = getDefaultTier(serviceType);
    const usageBased = USAGE_BASED_SERVICES.includes(serviceType);
    const { items, ai } = readItems(region, serviceName);
    const tiers = parseTiers(items, serviceName, ai);
    const selected = findTier(tiers, defaultTier);
    const fallbackAvailable = hasFallbackPricing(serviceType);
    const paygSource = selected ? 'retail-api' : fallbackAvailable ? 'static-fallback' : 'none';
    let oneYearSource = 'payg-unchanged';
    if (paygSource === 'none') {
      oneYearSource = 'unsupported-no-payg';
    } else if (!usageBased) {
      if (selected?.oneYear && selected.oneYear > 0) oneYearSource = 'real-savings-plan';
      else oneYearSource = 'payg-unchanged-no-offer';
    } else {
      oneYearSource = 'payg-unchanged-usage';
    }
    rows.push({ region, serviceType, serviceName, defaultTier, selectedTier: selected?.name || null, selectedMeter: selected?.meterName || null, paygSource, oneYearSource, tierCount: tiers.length, aiParserPath: ai });
  }
}

const summarize = (field: string) => Object.fromEntries([...new Set(rows.map((row) => String(row[field])))].sort().map((value) => [value, rows.filter((row) => String(row[field]) === value).length]));
const byRegion = Object.fromEntries(regions.map((region) => {
  const regionRows = rows.filter((row) => row.region === region);
  const counts = (field: string) => Object.fromEntries([...new Set(regionRows.map((row) => String(row[field])))].sort().map((value) => [value, regionRows.filter((row) => String(row[field]) === value).length]));
  return [region, { payg: counts('paygSource'), oneYear: counts('oneYearSource') }];
}));

const suspiciousSelections = rows.filter((row) => /spot|low priority|secondary|failover|passive/i.test(String(row.selectedTier || '') + ' ' + String(row.selectedMeter || '')));
const report = {
  generatedAt: new Date().toISOString(),
  regionCount: regions.length,
  serviceTypeCount: serviceTypes.length,
  evaluatedCombinations: rows.length,
  paygSources: summarize('paygSource'),
  oneYearSources: summarize('oneYearSource'),
  byRegion,
  suspiciousDisallowedSelections: suspiciousSelections,
  rows,
};

const outputArg = process.argv.find((arg) => arg.startsWith('--json='));
if (outputArg) {
  const output = outputArg.slice('--json='.length);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}

const jsonArg = process.argv.find((arg) => arg.startsWith('--json='));
if (jsonArg) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(jsonArg.slice(7), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`Pricing semantics: ${rows.length} service-type/region combinations (${serviceTypes.length} service labels x ${regions.length} regions)`);
console.log('PAYG source:', report.paygSources);
console.log('1-year mode source:', report.oneYearSources);
console.log(`Suspicious default selections (Spot/Low Priority/secondary/failover/passive): ${suspiciousSelections.length}`);
for (const region of regions) console.log(region, JSON.stringify(byRegion[region]));
