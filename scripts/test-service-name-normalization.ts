import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getAzureServiceName } from '../src/data/azurePricing';
import {
  getServiceCostRange,
  getServiceIconMapping,
  SERVICE_ICON_MAP,
} from '../src/data/serviceIconMapping';
import {
  getCurrentIconDisplayName,
  isSupersededIconFile,
  matchesIconSearch,
} from '../src/utils/iconLoader';
import {
  resolveServiceName,
  SERVICE_CATALOG,
} from '../mcp-server/src/serviceCatalog';

const cases = [
  {
    canonical: 'Foundry Tools',
    aliases: [
      'Foundry Tools',
      'Azure AI Services',
      'Azure Cognitive Services',
      'Cognitive Services',
    ],
  },
  {
    canonical: 'Azure AI Document Intelligence',
    aliases: [
      'Azure AI Document Intelligence',
      'Document Intelligence',
      'Azure Document Intelligence',
      'Form Recognizer',
      'Azure Form Recognizer',
    ],
  },
  {
    canonical: 'Azure AI Search',
    aliases: [
      'Azure AI Search',
      'AI Search',
      'Azure Cognitive Search',
      'Cognitive Search',
      'Azure Search',
    ],
  },
  {
    canonical: 'Azure Health Data Services FHIR service',
    aliases: [
      'Azure Health Data Services FHIR service',
      'Azure Health Data Services FHIR',
      'Azure API for FHIR',
      'FHIR Service',
      'FHIR',
    ],
  },
];

for (const { canonical, aliases } of cases) {
  assert.ok(SERVICE_ICON_MAP[canonical], `web catalog must contain ${canonical}`);
  assert.ok(SERVICE_CATALOG[canonical], `MCP catalog must contain ${canonical}`);

  for (const alias of aliases) {
    assert.equal(
      getServiceIconMapping(alias)?.displayName,
      canonical,
      `web catalog should normalize ${alias}`,
    );

    const mcpKey = resolveServiceName(alias);
    assert.ok(mcpKey, `MCP catalog should resolve ${alias}`);
    assert.equal(
      SERVICE_CATALOG[mcpKey].displayName,
      canonical,
      `MCP catalog should normalize ${alias}`,
    );
  }
}

assert.equal(SERVICE_ICON_MAP['Document Intelligence'], undefined);
assert.equal(SERVICE_ICON_MAP['Azure Cognitive Search'], undefined);
assert.equal(SERVICE_ICON_MAP['Cognitive Services'], undefined);
assert.equal(SERVICE_ICON_MAP['Azure API for FHIR'], undefined);
assert.equal(SERVICE_CATALOG['Document Intelligence'], undefined);
assert.equal(SERVICE_CATALOG['Azure Cognitive Search'], undefined);
assert.equal(SERVICE_CATALOG['Cognitive Services'], undefined);
assert.equal(SERVICE_CATALOG['Azure API for FHIR'], undefined);

assert.equal(getAzureServiceName('Foundry Tools'), 'Cognitive Services');
assert.equal(getAzureServiceName('Azure AI Document Intelligence'), 'Document Intelligence');
assert.equal(getAzureServiceName('Form Recognizer'), 'Document Intelligence');
assert.equal(getAzureServiceName('Azure AI Search'), 'Azure Cognitive Search');
assert.equal(getAzureServiceName('Azure Health Data Services FHIR service'), 'Azure API for FHIR');
assert.equal(getServiceCostRange('Azure Bastion'), '$138-876/mo');

assert.equal(
  getCurrentIconDisplayName('document-intelligence', 'Document Intelligence'),
  'Azure AI Document Intelligence',
);
assert.equal(
  getCurrentIconDisplayName('cognitive-services', 'Cognitive Services'),
  'Foundry Tools',
);
assert.equal(
  getCurrentIconDisplayName('azure-cognitive-search', 'Azure Cognitive Search'),
  'Azure AI Search',
);
assert.equal(isSupersededIconFile('00819-icon-service-Form-Recognizers'), true);
assert.equal(isSupersededIconFile('10044-icon-service-Cognitive-Search'), true);
assert.equal(isSupersededIconFile('10162-icon-service-Cognitive-Services'), true);
assert.equal(isSupersededIconFile('10212-icon-service-Azure-API-for-FHIR'), true);
assert.equal(
  getCurrentIconDisplayName('02658-icon-service-FHIR-Service', 'FHIR Service'),
  'Azure Health Data Services FHIR service',
);

const searchIcon = {
  id: 'azure-cognitive-search',
  name: 'Azure AI Search',
  category: 'ai + machine learning',
  path: '/icons/azure-cognitive-search.svg',
  searchTerms: ['Azure AI Search', 'Azure Cognitive Search', 'Cognitive Search'],
};
assert.equal(matchesIconSearch(searchIcon, 'Azure AI Search'), true);
assert.equal(matchesIconSearch(searchIcon, 'Cognitive Search'), true);
assert.equal(matchesIconSearch(searchIcon, 'Form Recognizer'), false);

// The generation prompt advertises display names, so each one must resolve to
// its own entry rather than falling through to fuzzy icon search.
for (const [key, mapping] of Object.entries(SERVICE_ICON_MAP)) {
  const byKey = getServiceIconMapping(key);
  const byDisplayName = getServiceIconMapping(mapping.displayName);
  assert.ok(byKey, `catalog key "${key}" should resolve`);
  assert.equal(byKey!.iconFile, mapping.iconFile, `catalog key "${key}" resolved to the wrong entry`);
  assert.ok(byDisplayName, `display name "${mapping.displayName}" should resolve`);
  assert.equal(
    byDisplayName!.iconFile,
    mapping.iconFile,
    `display name "${mapping.displayName}" resolved to a different service`,
  );
}

// Pricing snapshots are stored under the Azure Retail Prices `serviceName`, so a
// mismatched mapping silently drops the service to a documented estimate.
const pricingRegion = 'eastus2';
const remappedForPricing = [
  'Azure Cache for Redis',
  'Azure Functions',
  'Azure Stream Analytics',
  'Event Hubs',
  'Service Bus',
  'Azure Event Grid',
];
for (const displayName of remappedForPricing) {
  const apiServiceName = getAzureServiceName(displayName);
  const stem = apiServiceName.toLowerCase().replace(/\s+/g, '_');
  const snapshotPath = join('src/data/pricing/regions', pricingRegion, `${stem}.json`);
  assert.ok(existsSync(snapshotPath), `${displayName} maps to missing snapshot ${stem}.json`);
  const items = JSON.parse(readFileSync(snapshotPath, 'utf8')).Items ?? [];
  assert.ok(items.length > 0, `${displayName} maps to empty snapshot ${stem}.json`);
  assert.equal(
    items[0].serviceName,
    apiServiceName,
    `${displayName} maps to "${apiServiceName}" but ${stem}.json holds "${items[0].serviceName}"`,
  );
}

console.log('Service-name normalization checks passed.');