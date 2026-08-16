#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const EXPECTED_TOOLS = [
  'compare_region_costs',
  'estimate_costs',
  'export_reactflow_scene',
  'generate_bicep',
  'generate_deployment_guide',
  'generate_manifest',
  'generate_terraform',
  'get_waf_rules',
  'harden_architecture',
  'import_architecture',
  'list_services',
  'render_diagram',
  'validate_architecture',
];

const EXPECTED_RESOURCES = [
  'azure://catalog/services',
  'azure://pricing/meta',
  'azure://waf/rules',
];

const EXPECTED_PROMPTS = [
  'design-event-driven-platform',
  'design-secure-web-app',
  'harden-and-cost',
];

const TOKEN = 'local-contract-test-token';

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert(address && typeof address !== 'string');
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(url, child, stderr) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`MCP server exited before becoming healthy (${child.exitCode}).\n${stderr()}`);
    }
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`MCP server did not become healthy.\n${stderr()}`);
}

function textPayload(result) {
  const item = result.content?.find(content => content.type === 'text');
  assert(item && item.type === 'text', 'Expected a text tool result');
  return JSON.parse(item.text);
}

async function rawMcpRequest(baseUrl, method, params, sessionId) {
  const headers = {
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2025-06-18',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  if (response.headers.get('content-type')?.includes('application/json')) {
    return JSON.parse(text);
  }
  const dataLine = text.split('\n').find(line => line.startsWith('data: '));
  assert(dataLine, `Expected an SSE data line, received: ${text}`);
  return JSON.parse(dataLine.slice('data: '.length));
}

async function main() {
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['dist/index.js', '--http'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      MCP_HTTP_HOST: '127.0.0.1',
      MCP_HTTP_PORT: String(port),
      MCP_AUTH_TOKEN: TOKEN,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let serverStderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { serverStderr += chunk; });

  let client;
  try {
    await waitForHealth(`${baseUrl}/healthz`, child, () => serverStderr);

    const unauthorized = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'unauthorized-contract-test', version: '1.0.0' },
        },
      }),
    });
    assert.equal(unauthorized.status, 401);

    const getProbe = await fetch(`${baseUrl}/mcp`);
    assert.equal(getProbe.status, 200);
    assert((await getProbe.text()).includes('Streamable-HTTP endpoint'));

    const headProbe = await fetch(`${baseUrl}/mcp`, { method: 'HEAD' });
    assert.equal(headProbe.status, 200);
    assert.equal(await headProbe.text(), '');

    const preflight = await fetch(`${baseUrl}/mcp`, { method: 'OPTIONS' });
    assert.equal(preflight.status, 204);
    const allowedHeaders = preflight.headers.get('access-control-allow-headers')?.toLowerCase() ?? '';
    for (const header of ['authorization', 'mcp-session-id', 'mcp-protocol-version', 'last-event-id']) {
      assert(allowedHeaders.includes(header), `Preflight must allow ${header}`);
    }

    const deleteResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(deleteResponse.status, 405);

    const health = await fetch(`${baseUrl}/healthz`).then(response => response.json());
    assert.equal(health.sessionMode, 'stateless');

    const directList = await rawMcpRequest(baseUrl, 'tools/list', {}, undefined);
    assert.deepEqual(directList.result.tools.map(tool => tool.name).sort(), EXPECTED_TOOLS);

    const staleSessionCall = await rawMcpRequest(
      baseUrl,
      'tools/call',
      { name: 'list_services', arguments: { category: 'compute' } },
      'session-from-replaced-container-revision',
    );
    assert.equal(staleSessionCall.result.isError, undefined);
    assert(textPayload(staleSessionCall.result).totalServices > 0);

    client = new Client({ name: 'mcp-contract-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
    });
    await client.connect(transport);

    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), EXPECTED_TOOLS);
    for (const tool of tools) {
      assert(tool.title?.trim(), `${tool.name} must expose a title`);
      assert(tool.outputSchema, `${tool.name} must expose an output schema`);
      assert.deepEqual(tool.annotations, {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      }, `${tool.name} must expose the standard deterministic annotations`);
    }
    const { resources } = await client.listResources();
    assert.deepEqual(resources.map(resource => resource.uri).sort(), EXPECTED_RESOURCES);

    const { prompts } = await client.listPrompts();
    assert.deepEqual(prompts.map(prompt => prompt.name).sort(), EXPECTED_PROMPTS);

    const listedServices = textPayload(await client.callTool({
      name: 'list_services',
      arguments: { category: 'compute' },
    }));
    assert(listedServices.totalServices > 0);

    const fullCatalogResult = await client.callTool({
      name: 'list_services',
      arguments: {},
    });
    const fullCatalog = textPayload(fullCatalogResult);
    assert.deepEqual(fullCatalogResult.structuredContent, fullCatalog);
    assert.equal(fullCatalog.totalServices, 94);
    assert(fullCatalog.services.some(service => service.key === 'Microsoft Foundry'));
    assert(fullCatalog.services.some(service => service.key === 'Microsoft Fabric Capacity'));

    const initialArchitecture = {
      services: [
        { name: 'Web', type: 'App Service' },
        { name: 'Data', type: 'SQL Database' },
      ],
      connections: [{ from: 'Web', to: 'Data', label: 'Query application data' }],
      groups: [],
    };

    const regionalArchitecture = {
      services: [
        { name: 'Primary Web', type: 'App Service', region: 'East US 2' },
        { name: 'Secondary Data', type: 'SQL Database', region: 'Central US' },
      ],
      connections: [{ from: 'Primary Web', to: 'Secondary Data', label: 'Query replicated application data' }],
      groups: [],
    };

    const validation = await client.callTool({
      name: 'validate_architecture',
      arguments: initialArchitecture,
    });
    assert.equal(typeof validation.structuredContent?.score, 'number');

    const frontDoorOneRegion = await client.callTool({
      name: 'validate_architecture',
      arguments: {
        services: [
          { name: 'Front Door', type: 'Azure Front Door' },
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
          { name: 'Data East', type: 'SQL Database', region: 'eastus2' },
        ],
        connections: [
          { from: 'Front Door', to: 'Web East', label: 'Route requests to application' },
          { from: 'Web East', to: 'Data East', label: 'Query application data' },
        ],
      },
    });
    assert(frontDoorOneRegion.structuredContent?.patternsDetected.includes('single-region'));
    assert(frontDoorOneRegion.structuredContent?.patternsDetected.includes('no-waf'));
    assert.equal(frontDoorOneRegion.structuredContent?.regionalTopology.hasMultiRegionServingTier, false);

    const detachedWafValidation = await client.callTool({
      name: 'validate_architecture',
      arguments: {
        services: [
          { name: 'Front Door', type: 'Azure Front Door' },
          { name: 'WAF Policy', type: 'Web Application Firewall' },
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
        ],
        connections: [{ from: 'Front Door', to: 'Web East', label: 'Route application requests' }],
      },
    });
    assert(detachedWafValidation.structuredContent?.patternsDetected.includes('no-waf'));

    const detachedWafHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: [
          { name: 'Front Door', type: 'Azure Front Door' },
          { name: 'Corporate WAF', type: 'Web Application Firewall' },
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
        ],
        connections: [{ from: 'Front Door', to: 'Web East', label: 'Route application requests' }],
        groups: [],
      },
    }));
    assert.equal(detachedWafHarden.services.filter(service => service.type === 'Web Application Firewall').length, 1);
    assert(detachedWafHarden.connections.some(edge => edge.from === 'Front Door' && edge.to === 'Corporate WAF'));
    assert(detachedWafHarden.changes.some(change => change.action.includes('Associated the existing')));
    assert(!detachedWafHarden.after.patternsDetected.includes('no-waf'));

    const frontDoorWafHardenResult = await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: [
          { name: 'Front Door', type: 'Azure Front Door' },
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
        ],
        connections: [{ from: 'Front Door', to: 'Web East', label: 'Route application requests' }],
        groups: [],
      },
    });
    const frontDoorWafHarden = textPayload(frontDoorWafHardenResult);
    assert.deepEqual(frontDoorWafHardenResult.structuredContent, frontDoorWafHarden);
    assert.equal(frontDoorWafHarden.services.filter(service => service.type === 'Azure Front Door').length, 1);
    assert(frontDoorWafHarden.services.some(service => service.name === 'WAF Policy'));
    assert(frontDoorWafHarden.connections.some(edge => edge.from === 'Front Door' && edge.to === 'WAF Policy'));
    assert(!frontDoorWafHarden.after.patternsDetected.includes('no-waf'));

    const appGatewayWafHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: [
          { name: 'Application Gateway', type: 'Application Gateway', region: 'eastus2' },
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
        ],
        connections: [{ from: 'Application Gateway', to: 'Web East', label: 'Route application requests' }],
        groups: [],
      },
    }));
    assert.equal(appGatewayWafHarden.services.some(service => service.type === 'Azure Front Door'), false);
    assert(appGatewayWafHarden.connections.some(edge => edge.from === 'Application Gateway' && edge.to === 'WAF Policy'));

    const splitRegionalValidation = await client.callTool({
      name: 'validate_architecture',
      arguments: regionalArchitecture,
    });
    assert(splitRegionalValidation.structuredContent?.patternsDetected.includes('single-region'));
    assert(splitRegionalValidation.structuredContent?.patternsDetected.includes('single-database'));
    assert.deepEqual(splitRegionalValidation.structuredContent?.regionalTopology.explicitServingRegions, ['eastus2']);

    const duplicatedServingValidation = await client.callTool({
      name: 'validate_architecture',
      arguments: {
        services: [
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
          { name: 'Web Central', type: 'App Service', region: 'centralus' },
          { name: 'Data East', type: 'SQL Database', region: 'eastus2' },
        ],
        connections: [
          { from: 'Web East', to: 'Data East', label: 'Query application data' },
          { from: 'Web Central', to: 'Data East', label: 'Fail over application reads' },
        ],
      },
    });
    assert(!duplicatedServingValidation.structuredContent?.patternsDetected.includes('single-region'));
    assert(duplicatedServingValidation.structuredContent?.patternsDetected.includes('single-database'));
    assert.deepEqual(duplicatedServingValidation.structuredContent?.regionalTopology.redundantServingTypes, ['app service']);

    assert(!validation.structuredContent?.patternsDetected.includes('single-region'));
    assert.equal(validation.structuredContent?.regionalTopology.hasServingRegionEvidence, false);

    const apimDirectValidation = await client.callTool({
      name: 'validate_architecture',
      arguments: {
        services: [
          { name: 'Public API', type: 'API Management', region: 'eastus2' },
          { name: 'API Data', type: 'SQL Database', region: 'eastus2' },
        ],
        connections: [{ from: 'Public API', to: 'API Data', label: 'Query database directly' }],
      },
    });
    assert(apimDirectValidation.structuredContent?.patternsDetected.includes('no-waf'));
    assert(apimDirectValidation.structuredContent?.patternsDetected.includes('direct-db-access'));

    const manifestResult = await client.callTool({
      name: 'generate_manifest',
      arguments: {
        projectName: 'contract-test',
        location: 'eastus2',
        iacTool: 'bicep',
        ...initialArchitecture,
      },
    });
    const manifest = textPayload(manifestResult);
    assert.deepEqual(manifestResult.structuredContent, manifest);
    assert.equal(manifest.project.name, 'contract-test');
    assert.equal('groupId' in manifest.architecture.services[0], false);

    const regionalManifest = textPayload(await client.callTool({
      name: 'generate_manifest',
      arguments: {
        projectName: 'regional-contract-test',
        location: 'eastus2',
        iacTool: 'bicep',
        ...regionalArchitecture,
      },
    }));
    assert.deepEqual(regionalManifest.architecture.services.map(service => service.region), ['eastus2', 'centralus']);

    const importedRegionalManifestResult = await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(regionalManifest), format: 'manifest' },
    });
    const importedRegionalManifest = textPayload(importedRegionalManifestResult);
    assert.deepEqual(importedRegionalManifestResult.structuredContent, importedRegionalManifest);
    assert.deepEqual(importedRegionalManifest.services.map(service => service.region), ['eastus2', 'centralus']);

    const bicepResult = await client.callTool({
      name: 'generate_bicep',
      arguments: {
        projectName: 'contract-test',
        location: 'eastus2',
        ...initialArchitecture,
      },
    });
    const bicep = textPayload(bicepResult);
    assert.deepEqual(bicepResult.structuredContent, bicep);
    assert.equal(bicep.iacTool, 'bicep');
    assert(bicep.bicep.includes('resource'));

    const regionalBicep = textPayload(await client.callTool({
      name: 'generate_bicep',
      arguments: {
        projectName: 'regional-contract-test',
        location: 'eastus2',
        ...regionalArchitecture,
      },
    }));
    assert(regionalBicep.note.includes('is not yet emitted as multi-region IaC'));
    assert(regionalBicep.note.includes('centralus, eastus2'));

    const terraformResult = await client.callTool({
      name: 'generate_terraform',
      arguments: {
        projectName: 'contract-test',
        location: 'eastus2',
        ...initialArchitecture,
      },
    });
    const terraform = textPayload(terraformResult);
    assert.deepEqual(terraformResult.structuredContent, terraform);
    assert.equal(terraform.iacTool, 'terraform');
    assert(terraform.terraform.includes('terraform {'));

    const wafRules = await client.callTool({
      name: 'get_waf_rules',
      arguments: {},
    });
    assert(Number(wafRules.structuredContent?.totalRules) > 0);

    const estimate = await client.callTool({
      name: 'estimate_costs',
      arguments: {
        region: 'eastus2',
        term: 'payg',
        services: [{ name: 'API', type: 'App Service', tier: 'standard' }],
      },
    });
    assert.equal(estimate.structuredContent?.region, 'eastus2');
    assert.equal(estimate.structuredContent?.term, 'payg');
    assert.equal(estimate.structuredContent?.serviceCount, 1);
    assert.equal(estimate.structuredContent?.selectedMonthlyCost, estimate.structuredContent?.estimates[0]?.totalMonthlyCost);
    assert.deepEqual(estimate.structuredContent?.pricingSource.regions.sort(), [
      'australiaeast',
      'brazilsouth',
      'canadacentral',
      'centralindia',
      'centralus',
      'eastus2',
      'japaneast',
      'mexicocentral',
      'northeurope',
      'southeastasia',
      'swedencentral',
      'uksouth',
      'westeurope',
      'westus2',
    ]);

    const mixedRegionEstimate = await client.callTool({
      name: 'estimate_costs',
      arguments: {
        region: 'eastus2',
        term: 'payg',
        services: [
          { name: 'Primary API', type: 'API Management', tier: 'standard', region: 'eastus2' },
          { name: 'Secondary API', type: 'API Management', tier: 'standard', region: 'Central US' },
          { name: 'Shared Monitor', type: 'Azure Monitor', region: 'Central US' },
        ],
      },
    });
    const mixed = mixedRegionEstimate.structuredContent;
    assert.equal(mixed?.serviceCount, 3);
    assert.equal(mixed?.numericallyPricedResourceCount, 2);
    assert.equal(mixed?.excludedResourceCount, 1);
    assert.equal(mixed?.usageBasedResourceCount, 1);
    assert.equal(mixed?.numericCoveragePercent, 66.67);
    assert.equal(mixed?.isPartialBaseline, true);
    assert.equal(mixed?.baselineLabel, 'Partial fixed-price baseline covering 2/3 resources');
    assert.equal(mixed?.regionProxyUsed, false);
    assert.equal(mixed?.proxiedResourceCount, 0);
    assert.deepEqual(mixed?.requestedRegions, ['centralus', 'eastus2']);
    assert.deepEqual(mixed?.effectiveRegions, ['centralus', 'eastus2']);
    const secondary = mixed?.estimates.find(item => item.name === 'Secondary API');
    assert.equal(secondary?.requestedRegion, 'centralus');
    assert.equal(secondary?.effectiveRegion, 'centralus');
    assert.equal(secondary?.regionProxyUsed, false);
    const excludedMonitor = mixed?.excludedServices.find(item => item.name === 'Shared Monitor');
    assert.equal(excludedMonitor?.requestedRegion, 'centralus');
    assert.equal(excludedMonitor?.effectiveRegion, 'centralus');
    assert.equal(excludedMonitor?.regionProxyUsed, false);

    for (const nativeRegion of ['centralus', 'westus2', 'uksouth', 'northeurope', 'japaneast', 'centralindia']) {
      const nativeEstimate = await client.callTool({
        name: 'estimate_costs',
        arguments: {
          region: nativeRegion,
          services: [{ name: `${nativeRegion} API`, type: 'API Management', region: nativeRegion }],
        },
      });
      const nativeOutput = nativeEstimate.structuredContent;
      assert.equal(nativeOutput?.hasPricingData, true, `${nativeRegion} must have a native numeric estimate`);
      assert.equal(nativeOutput?.regionProxyUsed, false, `${nativeRegion} must not use a proxy`);
      assert.equal(nativeOutput?.estimates[0]?.requestedRegion, nativeRegion);
      assert.equal(nativeOutput?.estimates[0]?.effectiveRegion, nativeRegion);
      assert.equal(nativeOutput?.estimates[0]?.regionProxyUsed, false);
    }

    for (const nativeRegion of estimate.structuredContent?.pricingSource.regions ?? []) {
      const vmEstimate = await client.callTool({
        name: 'estimate_costs',
        arguments: {
          region: nativeRegion,
          services: [{ name: `${nativeRegion} VM`, type: 'Virtual Machines', region: nativeRegion }],
        },
      });
      const sampleSku = vmEstimate.structuredContent?.estimates[0]?.sampleSku ?? '';
      assert(!/spot|low priority/i.test(sampleSku), `${nativeRegion} VM sample must exclude Spot/Low Priority: ${sampleSku}`);
    }

    const quantityEstimate = await client.callTool({
      name: 'estimate_costs',
      arguments: {
        region: 'eastus2',
        services: [
          { name: 'Regional APIs', type: 'API Management', region: 'Central US', quantity: 10 },
          { name: 'Shared Monitors', type: 'Azure Monitor', region: 'eastus2', quantity: 2 },
        ],
      },
    });
    const quantityCoverage = quantityEstimate.structuredContent;
    assert.equal(quantityCoverage?.serviceCount, 2);
    assert.equal(quantityCoverage?.totalResourceCount, 12);
    assert.equal(quantityCoverage?.numericallyPricedResourceCount, 10);
    assert.equal(quantityCoverage?.excludedResourceCount, 2);
    assert.equal(quantityCoverage?.usageBasedResourceCount, 2);
    assert.equal(quantityCoverage?.proxiedResourceCount, 0);
    assert.equal(quantityCoverage?.numericCoveragePercent, 83.33);
    assert.equal(quantityCoverage?.baselineLabel, 'Partial fixed-price baseline covering 10/12 resources');
    assert.equal(quantityCoverage?.excludedServices[0]?.quantity, 2);

    const unsupportedRegionEstimate = await client.callTool({
      name: 'estimate_costs',
      arguments: {
        region: 'westus3',
        services: [{ name: 'Future API', type: 'API Management', region: 'westus3' }],
      },
    });
    const unsupportedRegion = unsupportedRegionEstimate.structuredContent;
    assert.equal(unsupportedRegion?.regionProxyUsed, true);
    assert.equal(unsupportedRegion?.proxiedResourceCount, 1);
    assert.deepEqual(unsupportedRegion?.requestedRegions, ['westus3']);
    assert.deepEqual(unsupportedRegion?.effectiveRegions, ['eastus2']);
    assert.equal(unsupportedRegion?.estimates[0]?.requestedRegion, 'westus3');
    assert.equal(unsupportedRegion?.estimates[0]?.effectiveRegion, 'eastus2');
    assert.equal(unsupportedRegion?.estimates[0]?.regionProxyUsed, true);

    const regionalComparison = await client.callTool({
      name: 'compare_region_costs',
      arguments: {
        baselineRegion: 'East US 2',
        term: 'payg',
        regions: ['East US 2', 'Central US', 'West Europe'],
        services: [
          { name: 'Web', type: 'App Service', quantity: 1 },
          { name: 'Gateway', type: 'API Management', quantity: 2 },
          { name: 'Monitor', type: 'Azure Monitor', quantity: 1 },
        ],
      },
    });
    const comparison = regionalComparison.structuredContent;
    assert.equal(comparison?.rankingEligible, true);
    assert.equal(comparison?.coverageConsistent, true);
    assert.equal(comparison?.currencyConsistent, true);
    assert.deepEqual(comparison?.requestedRegions, ['eastus2', 'centralus', 'westeurope']);
    assert.deepEqual(comparison?.comparedRegions, ['eastus2', 'centralus', 'westeurope']);
    assert.deepEqual(comparison?.unsupportedRegions, []);
    assert.equal(comparison?.baselineRegion, 'eastus2');
    assert.equal(comparison?.totalResourceCount, 4);
    assert.equal(comparison?.comparisons.length, 3);
    assert.equal(comparison?.ranking.length, 3);
    assert.equal(comparison?.comparisons.every(row => row.nativePricing && row.numericCoveragePercent === 75), true);
    assert.equal(comparison?.comparisons.every(row => row.numericallyPricedResourceCount === 3 && row.excludedResourceCount === 1), true);
    assert.equal(comparison?.comparisons.every(row => row.excludedServices[0]?.name === 'Monitor'), true);
    assert.equal(comparison?.comparisons.every(row => !row.excludedServices.some(service => service.regionProxyUsed)), true);
    assert.equal(comparison?.comparisons.find(row => row.region === 'eastus2')?.deltaFromBaseline?.amount, 0);
    const rankedSelected = comparison?.ranking.map(row => row.selectedMonthlyCost) ?? [];
    assert.deepEqual(rankedSelected, [...rankedSelected].sort((left, right) => left - right));
    assert.equal(comparison?.cheapest?.region, comparison?.ranking[0]?.region);
    assert.equal(comparison?.mostExpensive?.region, comparison?.ranking.at(-1)?.region);
    assert.equal(comparison?.potentialMonthlySavings?.amount, Math.round((rankedSelected.at(-1) - rankedSelected[0]) * 100) / 100);
    assert(new Set(rankedSelected).size > 1, 'Native regional comparison should measure at least two distinct totals for this fixture');
    assert.equal(comparison?.comparisons.every(row => row.pricesAsOf != null), true);

    const premiumComparison = await client.callTool({
      name: 'compare_region_costs',
      arguments: {
        term: 'reserved1yr',
        regions: ['eastus2', 'centralus'],
        services: [{ name: 'Premium Web', type: 'App Service', tier: 'premium' }],
      },
    });
    assert.equal(premiumComparison.structuredContent?.term, 'reserved1yr');
    assert.equal(premiumComparison.structuredContent?.rankingEligible, true);
    assert.equal(premiumComparison.structuredContent?.comparisons.every(row => row.selectedMonthlyCost === row.totalMonthlyCost.high), true);

    const unsupportedComparison = await client.callTool({
      name: 'compare_region_costs',
      arguments: {
        regions: ['eastus2', 'centralus', 'westus3'],
        services: [{ name: 'Gateway', type: 'API Management' }],
      },
    });
    const unsupportedComparisonOutput = unsupportedComparison.structuredContent;
    assert.equal(unsupportedComparisonOutput?.rankingEligible, false);
    assert.deepEqual(unsupportedComparisonOutput?.unsupportedRegions, ['westus3']);
    assert.deepEqual(unsupportedComparisonOutput?.comparedRegions, ['eastus2', 'centralus']);
    assert.deepEqual(unsupportedComparisonOutput?.ranking, []);
    assert.match(unsupportedComparisonOutput?.rankingReason ?? '', /no native bundled snapshot/i);
    assert.equal(unsupportedComparisonOutput?.comparisons.every(row => row.nativePricing), true);

    const allUnsupportedComparison = await client.callTool({
      name: 'compare_region_costs',
      arguments: {
        regions: ['westus3', 'francecentral'],
        services: [{ name: 'Gateways', type: 'API Management', quantity: 3 }],
      },
    });
    assert.equal(allUnsupportedComparison.structuredContent?.rankingEligible, false);
    assert.equal(allUnsupportedComparison.structuredContent?.totalResourceCount, 3);
    assert.deepEqual(allUnsupportedComparison.structuredContent?.comparedRegions, []);
    assert.deepEqual(allUnsupportedComparison.structuredContent?.unsupportedRegions, ['westus3', 'francecentral']);

    const usageOnlyComparison = await client.callTool({
      name: 'compare_region_costs',
      arguments: {
        regions: ['eastus2', 'centralus'],
        services: [{ name: 'Agent Platform', type: 'Azure AI Foundry' }],
      },
    });
    assert.equal(usageOnlyComparison.structuredContent?.rankingEligible, false);
    assert.equal(usageOnlyComparison.structuredContent?.comparisons.every(row => row.numericCoveragePercent === 0), true);
    assert.match(usageOnlyComparison.structuredContent?.rankingReason ?? '', /no numeric fixed-price baseline/i);

    const duplicateRegionComparison = await client.callTool({
      name: 'compare_region_costs',
      arguments: {
        regions: ['East US 2', 'east-us-2'],
        services: [{ name: 'Gateway', type: 'API Management' }],
      },
    });
    assert.equal(duplicateRegionComparison.isError, true);
    assert.match(duplicateRegionComparison.content.find(item => item.type === 'text')?.text ?? '', /distinct regions/i);

    const invalidBaselineComparison = await client.callTool({
      name: 'compare_region_costs',
      arguments: {
        baselineRegion: 'westus2',
        regions: ['eastus2', 'centralus'],
        services: [{ name: 'Gateway', type: 'API Management' }],
      },
    });
    assert.equal(invalidBaselineComparison.isError, true);
    assert.match(invalidBaselineComparison.content.find(item => item.type === 'text')?.text ?? '', /must be one of the requested regions/i);

    const firstHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: initialArchitecture,
    }));
    assert(firstHarden.changes.length > 0, 'First hardening pass must change the unsafe fixture');

    const secondHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: firstHarden.services,
        connections: firstHarden.connections,
        groups: firstHarden.groups,
      },
    }));
    assert.deepEqual(secondHarden.changes, []);
    assert.deepEqual(secondHarden.services, firstHarden.services);
    assert.deepEqual(secondHarden.connections, firstHarden.connections);
    assert.deepEqual(secondHarden.groups, firstHarden.groups);

    const regionalHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: regionalArchitecture,
    }));
    assert.equal(regionalHarden.services.find(service => service.name === 'Primary Web')?.region, 'East US 2');
    assert.equal(regionalHarden.services.find(service => service.name === 'Secondary Data')?.region, 'Central US');
    assert.equal(regionalHarden.services.find(service => service.name === 'Redis Cache')?.region, 'East US 2');
    assert.equal(regionalHarden.services.find(service => service.name === 'Azure Backup')?.region, 'Central US');
    assert(regionalHarden.after.patternsDetected.includes('single-region'));
    assert(regionalHarden.after.patternsDetected.includes('single-database'));
    assert(regionalHarden.unresolved.includes('single-region'));
    assert(regionalHarden.unresolved.includes('single-database'));
    assert.equal(regionalHarden.services.some(service => service.name.endsWith(' Replica')), false);
    assert.equal(regionalHarden.changes.some(change => change.pattern.includes('single-region')), false);

    const explicitlyRegionalInput = {
      services: [
        { name: 'Web East', type: 'App Service', region: 'eastus2' },
        { name: 'Data East', type: 'SQL Database', region: 'eastus2' },
      ],
      connections: [{ from: 'Web East', to: 'Data East', label: 'Query application data' }],
      groups: [],
      secondaryRegion: 'centralus',
    };
    const explicitlyRegionalHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: explicitlyRegionalInput,
    }));
    assert.equal(explicitlyRegionalHarden.services.find(service => service.name === 'Web East Secondary')?.region, 'centralus');
    assert.equal(explicitlyRegionalHarden.services.find(service => service.name === 'Data East Replica')?.region, 'centralus');
    assert(explicitlyRegionalHarden.services.some(service => service.name === 'Front Door' && service.type === 'Azure Front Door'));
    assert(explicitlyRegionalHarden.connections.some(edge => edge.from === 'Front Door' && edge.to === 'Web East'));
    assert(explicitlyRegionalHarden.connections.some(edge => edge.from === 'Front Door' && edge.to === 'Web East Secondary'));
    assert(!explicitlyRegionalHarden.after.patternsDetected.includes('single-region'));
    assert(!explicitlyRegionalHarden.after.patternsDetected.includes('single-database'));
    assert(!explicitlyRegionalHarden.unresolved.includes('single-region'));
    assert(!explicitlyRegionalHarden.unresolved.includes('single-database'));
    assert(!explicitlyRegionalHarden.changes.some(change => change.action.includes('Front Door as global edge (enables WAF + multi-region failover)')));

    const secondExplicitRegionalHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: explicitlyRegionalHarden.services,
        connections: explicitlyRegionalHarden.connections,
        groups: explicitlyRegionalHarden.groups,
        secondaryRegion: 'centralus',
      },
    }));
    assert.deepEqual(secondExplicitRegionalHarden.changes, []);

    const staticWebHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: [{ name: 'Portal', type: 'Static Web Apps', region: 'eastus2' }],
        connections: [],
        groups: [],
      },
    }));
    assert(staticWebHarden.services.some(service => service.name === 'Front Door'));
    assert(staticWebHarden.services.some(service => service.name === 'WAF Policy'));
    assert(staticWebHarden.connections.some(edge => edge.from === 'Front Door' && edge.to === 'Portal'));
    assert(staticWebHarden.connections.some(edge => edge.from === 'Front Door' && edge.to === 'WAF Policy'));
    assert(!staticWebHarden.after.patternsDetected.includes('no-waf'));
    assert(staticWebHarden.after.patternsDetected.includes('single-region'));

    const apimDirectHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: [
          { name: 'Public API', type: 'API Management', region: 'eastus2' },
          { name: 'API Data', type: 'SQL Database', region: 'eastus2' },
          { name: 'API Events', type: 'Azure Cosmos DB', region: 'eastus2' },
        ],
        connections: [
          { from: 'Public API', to: 'API Data', label: 'Query SQL directly' },
          { from: 'Public API', to: 'API Events', label: 'Query events directly' },
        ],
        groups: [],
      },
    }));
    const generatedBackends = apimDirectHarden.services.filter(service => service.name.startsWith('Public API Backend'));
    assert.equal(generatedBackends.length, 1);
    const generatedBackend = generatedBackends[0];
    assert.equal(generatedBackend?.type, 'App Service');
    assert.equal(generatedBackend?.region, 'eastus2');
    assert(!apimDirectHarden.connections.some(edge => edge.from === 'Public API' && edge.to === 'API Data'));
    assert(!apimDirectHarden.connections.some(edge => edge.from === 'Public API' && edge.to === 'API Events'));
    assert(apimDirectHarden.connections.some(edge => edge.from === 'Public API' && edge.to === 'Public API Backend'));
    assert(apimDirectHarden.connections.some(edge => edge.from === 'Public API Backend' && edge.to === 'API Data'));
    assert(apimDirectHarden.connections.some(edge => edge.from === 'Public API Backend' && edge.to === 'API Events'));
    assert(!apimDirectHarden.after.patternsDetected.includes('direct-db-access'));

    const equalRegionHarden = await client.callTool({
      name: 'harden_architecture',
      arguments: {
        ...explicitlyRegionalInput,
        secondaryRegion: 'eastus2',
      },
    });
    assert.equal(equalRegionHarden.isError, true);
    assert(equalRegionHarden.content.find(item => item.type === 'text')?.text.includes('must differ'));

    const collisionHarden = textPayload(await client.callTool({
      name: 'harden_architecture',
      arguments: {
        services: [
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
          { name: 'Web East Secondary', type: 'Key Vault', region: 'centralus' },
          { name: 'Data East', type: 'SQL Database', region: 'eastus2' },
          { name: 'Data East Replica', type: 'Key Vault', region: 'centralus' },
        ],
        connections: [{ from: 'Web East', to: 'Data East', label: 'Query application data' }],
        groups: [],
        secondaryRegion: 'centralus',
      },
    }));
    assert.equal(collisionHarden.services.find(service => service.name === 'Web East Secondary 2')?.region, 'centralus');
    assert.equal(collisionHarden.services.find(service => service.name === 'Data East Replica 2')?.region, 'centralus');
    assert(collisionHarden.connections.some(edge => edge.from === 'Front Door' && edge.to === 'Web East Secondary 2'));
    assert(collisionHarden.connections.some(edge => edge.from === 'Data East' && edge.to === 'Data East Replica 2'));

    const mixedDatabaseValidation = await client.callTool({
      name: 'validate_architecture',
      arguments: {
        services: [
          { name: 'Web East', type: 'App Service', region: 'eastus2' },
          { name: 'Web Central', type: 'App Service', region: 'centralus' },
          { name: 'SQL East', type: 'SQL Database', region: 'eastus2' },
          { name: 'SQL Central', type: 'SQL Database', region: 'centralus' },
          { name: 'Cosmos East', type: 'Azure Cosmos DB', region: 'eastus2' },
        ],
        connections: [],
      },
    });
    assert(mixedDatabaseValidation.structuredContent?.patternsDetected.includes('single-database'));
    assert.deepEqual(mixedDatabaseValidation.structuredContent?.regionalTopology.redundantDatabaseTypes, ['sql database']);

    const imported = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(manifest), format: 'manifest' },
    }));
    assert.equal(imported.format, 'manifest');
    assert.equal(imported.services.length, initialArchitecture.services.length);

    const rendered = await client.callTool({
      name: 'render_diagram',
      arguments: {
        title: 'Contract Test Architecture',
        format: 'svg',
        ...initialArchitecture,
      },
    });
    const renderedItem = rendered.content?.find(content => content.type === 'text');
    assert(renderedItem && renderedItem.type === 'text');
    assert(renderedItem.text.includes('<svg'));
    assert(renderedItem.text.includes('Contract Test Architecture'));
    assert.equal(rendered.structuredContent?.format, 'svg');
    assert.equal(rendered.structuredContent?.mimeType, 'image/svg+xml');
    assert.equal(rendered.structuredContent?.content, renderedItem.text);

    const sceneResult = await client.callTool({
      name: 'export_reactflow_scene',
      arguments: {
        architectureName: 'Contract Test Architecture',
        region: 'none',
        ...initialArchitecture,
      },
    });
    const scene = textPayload(sceneResult);
    assert.deepEqual(sceneResult.structuredContent, scene);
    assert.equal(scene.metadata.architectureName, 'Contract Test Architecture');
    assert.equal(scene.nodes.filter(node => node.type === 'azureNode').length, initialArchitecture.services.length);

    const regionalScene = textPayload(await client.callTool({
      name: 'export_reactflow_scene',
      arguments: {
        architectureName: 'Regional Contract Test',
        region: 'none',
        ...regionalArchitecture,
      },
    }));
    const regionalSceneServices = regionalScene.nodes.filter(node => node.type === 'azureNode');
    assert.deepEqual(regionalSceneServices.map(node => node.data.region), ['eastus2', 'centralus']);
    const importedRegionalScene = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(regionalScene), format: 'reactflow' },
    }));
    assert.deepEqual(importedRegionalScene.services.map(service => service.region), ['eastus2', 'centralus']);

    const roundTripArchitecture = {
      services: [
        { id: 'svc-web-primary', name: 'Primary Web', type: 'Azure App Service', region: 'East US 2', description: 'Primary API', groupId: 'serving-tier' },
        { id: 'svc-events', name: 'Events', type: 'Event Hubs', region: 'Central US', description: 'Event backbone', groupId: 'data-tier' },
      ],
      connections: [
        { id: 'conn-publish', from: 'Primary Web', to: 'Events', label: 'Publish domain events', type: 'async' },
      ],
      groups: [
        { id: 'serving-tier', label: 'Serving Tier' },
        { id: 'data-tier', label: 'Data Tier' },
      ],
      workflow: [
        { step: 1, description: 'Publish events', services: ['Primary Web', 'Events'] },
      ],
    };
    const roundTripSceneResult = await client.callTool({
      name: 'export_reactflow_scene',
      arguments: {
        architectureName: 'Round Trip Contract',
        architecturePrompt: 'Build a regional event platform',
        author: 'Contract Author',
        region: 'none',
        ...roundTripArchitecture,
      },
    });
    const roundTripScene = textPayload(roundTripSceneResult);
    assert.deepEqual(roundTripSceneResult.structuredContent, roundTripScene);
    assert.equal(roundTripScene.edges[0].id, 'conn-publish');
    const roundTripImportResult = await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(roundTripScene), format: 'reactflow' },
    });
    const roundTripImport = textPayload(roundTripImportResult);
    assert.deepEqual(roundTripImportResult.structuredContent, roundTripImport);
    assert.equal(roundTripImport.author, 'Contract Author');
    assert.equal(roundTripImport.architecturePrompt, 'Build a regional event platform');
    assert.deepEqual(roundTripImport.workflow, roundTripArchitecture.workflow);
    assert.deepEqual(roundTripImport.services, [
      { id: 'svc-web-primary', name: 'Primary Web', type: 'App Service', region: 'eastus2', description: 'Primary API', groupId: 'serving-tier' },
      { id: 'svc-events', name: 'Events', type: 'Event Hubs', region: 'centralus', description: 'Event backbone', groupId: 'data-tier' },
    ]);
    assert.deepEqual(roundTripImport.connections, roundTripArchitecture.connections);
    assert.deepEqual(roundTripImport.groups, roundTripArchitecture.groups);

    const hardenedRoundTripResult = await client.callTool({
      name: 'harden_architecture',
      arguments: roundTripImport,
    });
    const hardenedRoundTrip = textPayload(hardenedRoundTripResult);
    assert.equal(hardenedRoundTrip.services.find(service => service.name === 'Primary Web')?.id, 'svc-web-primary');
    assert.equal(hardenedRoundTrip.services.find(service => service.name === 'Events')?.id, 'svc-events');
    assert.equal(hardenedRoundTrip.connections.find(connection => connection.from === 'Primary Web' && connection.to === 'Events')?.id, 'conn-publish');
    const hardenedIds = hardenedRoundTrip.services.map(service => service.id).filter(Boolean);
    assert.equal(new Set(hardenedIds).size, hardenedIds.length, 'Hardening must not duplicate stable service IDs');
    const hardenedScene = textPayload(await client.callTool({
      name: 'export_reactflow_scene',
      arguments: {
        architectureName: 'Hardened Round Trip',
        region: 'none',
        services: hardenedRoundTrip.services,
        connections: hardenedRoundTrip.connections,
        groups: hardenedRoundTrip.groups,
      },
    }));
    const reimportedHardened = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(hardenedScene), format: 'reactflow' },
    }));
    assert.equal(reimportedHardened.services.find(service => service.name === 'Primary Web')?.id, 'svc-web-primary');
    assert.equal(reimportedHardened.services.find(service => service.name === 'Events')?.id, 'svc-events');
    assert.equal(reimportedHardened.connections.find(connection => connection.from === 'Primary Web' && connection.to === 'Events')?.id, 'conn-publish');

    const roundTripManifestResult = await client.callTool({
      name: 'generate_manifest',
      arguments: {
        projectName: 'round-trip-manifest',
        location: 'East US 2',
        iacTool: 'terraform',
        architecturePrompt: 'Build a regional event platform',
        author: 'Contract Author',
        ...roundTripArchitecture,
      },
    });
    const roundTripManifest = textPayload(roundTripManifestResult);
    assert.deepEqual(roundTripManifestResult.structuredContent, roundTripManifest);
    const importedRoundTripManifestResult = await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(roundTripManifest), format: 'manifest' },
    });
    const importedRoundTripManifest = textPayload(importedRoundTripManifestResult);
    assert.equal(importedRoundTripManifest.iacTool, 'terraform');
    assert.equal(importedRoundTripManifest.location, 'eastus2');
    assert.equal(importedRoundTripManifest.author, 'Contract Author');
    assert.equal(importedRoundTripManifest.architecturePrompt, 'Build a regional event platform');
    assert.deepEqual(importedRoundTripManifest.workflow, roundTripArchitecture.workflow);
    assert.deepEqual(importedRoundTripManifest.services, [
      { id: 'svc-web-primary', name: 'Primary Web', type: 'App Service', region: 'eastus2', description: 'Primary API', groupId: 'serving-tier' },
      { id: 'svc-events', name: 'Events', type: 'Event Hubs', region: 'centralus', description: 'Event backbone', groupId: 'data-tier' },
    ]);
    assert.deepEqual(importedRoundTripManifest.connections, roundTripArchitecture.connections);

    const legacyWebScene = {
      nodes: [
        {
          id: 'web-node',
          type: 'azureNode',
          parentNode: 'legacy-group-node',
          data: {
            label: 'Legacy Web',
            iconPath: '/Azure_Public_Service_Icons/Icons/app services/app-service.svg',
            region: 'East US 2',
          },
        },
        {
          id: 'legacy-group-node',
          type: 'groupNode',
          data: { label: 'Legacy Tier' },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: { architectureName: 'Legacy Scene' },
    };
    const importedLegacyScene = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(legacyWebScene), format: 'reactflow' },
    }));
    assert.deepEqual(importedLegacyScene.groups, [{ id: 'legacy-group-node', label: 'Legacy Tier' }]);
    assert.deepEqual(importedLegacyScene.services, [{
      name: 'Legacy Web',
      type: 'App Service',
      region: 'eastus2',
      groupId: 'legacy-group-node',
    }]);
    assert.deepEqual(importedLegacyScene.warnings, []);

    const importedCustomScene = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: {
        format: 'reactflow',
        content: JSON.stringify({
          nodes: [{ id: 'custom-node', type: 'azureNode', data: { label: 'Partner Appliance' } }],
          edges: [],
        }),
      },
    }));
    assert.equal(importedCustomScene.services[0].type, 'Partner Appliance');
    assert.match(importedCustomScene.warnings[0], /using its label as the service type/i);

    // ── ARM template import ──────────────────────────────────────────────
    const armTemplate = {
      $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
      contentVersion: '1.0.0.0',
      parameters: {
        sites_web_name: { type: 'String', defaultValue: 'contoso-web' },
        location: { type: 'String', defaultValue: 'West Europe' },
      },
      resources: [
        {
          type: 'Microsoft.Web/sites',
          name: "[parameters('sites_web_name')]",
          location: "[parameters('location')]",
          dependsOn: ["[resourceId('Microsoft.Sql/servers/databases', 'sqlsrv', 'appdb')]"],
          properties: {},
          resources: [{ type: 'Microsoft.Web/sites/config', name: 'web/appsettings', properties: {} }],
        },
        { type: 'Microsoft.Sql/servers/databases', name: 'sqlsrv/appdb', location: 'eastus2', properties: {} },
        { type: 'Microsoft.KeyVault/vaults', name: 'shared', location: 'eastus2', properties: {} },
        { type: 'Microsoft.Storage/storageAccounts', name: 'shared', location: 'eastus2', properties: {} },
        { type: 'Microsoft.Fabrikam/widgets', name: 'unmapped-thing', location: 'eastus2' },
      ],
    };

    const armResult = await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(armTemplate), format: 'arm' },
    });
    const armImport = textPayload(armResult);
    assert.deepEqual(armResult.structuredContent, armImport);
    assert.equal(armImport.format, 'arm');
    assert.deepEqual(armImport.services, [
      { name: 'contoso-web', type: 'App Service', region: 'westeurope', description: 'Microsoft.Web/sites', groupId: 'zone-application' },
      { name: 'sqlsrv', type: 'SQL Database', region: 'eastus2', description: 'Microsoft.Sql/servers/databases', groupId: 'zone-data' },
      { name: 'shared', type: 'Key Vault', region: 'eastus2', description: 'Microsoft.KeyVault/vaults', groupId: 'zone-identity-security' },
      { name: 'shared (2)', type: 'Storage Account', region: 'eastus2', description: 'Microsoft.Storage/storageAccounts', groupId: 'zone-data' },
    ]);
    assert.deepEqual(armImport.connections, [{ from: 'contoso-web', to: 'sqlsrv', label: 'depends on', type: 'sync' }]);
    assert.equal(armImport.coverage.totalResources, 6);
    assert.equal(armImport.coverage.mapped, 4);
    assert.equal(armImport.coverage.folded, 1);
    assert.deepEqual(armImport.coverage.skippedTypes, ['Microsoft.Fabrikam/widgets']);
    assert.equal(armImport.coverage.canonicalServiceCount, 4);
    assert.deepEqual(armImport.coverage.uncanonicalizedTypes, []);
    assert.match(armImport.warnings[0], /not in the extractor's mapping and were skipped/i);

    // Auto-detection must reach the same result without a format hint.
    const armAutoDetected = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(armTemplate) },
    }));
    assert.equal(armAutoDetected.format, 'arm');
    assert.deepEqual(armAutoDetected.services, armImport.services);

    // The imported ARM architecture must be directly consumable downstream.
    const armValidation = await client.callTool({
      name: 'validate_architecture',
      arguments: { services: armImport.services, connections: armImport.connections },
    });
    assert.equal(typeof armValidation.structuredContent?.score, 'number');
    const armEstimate = await client.callTool({
      name: 'estimate_costs',
      arguments: { services: armImport.services },
    });
    assert.equal(armEstimate.structuredContent?.serviceCount, 4);
    assert.deepEqual(armEstimate.structuredContent?.requestedRegions, ['eastus2', 'westeurope']);

    // A real `az group export` resource group: mostly noise that must be folded.
    const realExport = JSON.parse(readFileSync(
      new URL('../../tests/fixtures/arm/AZURE_DIAGRAM_RG.json', import.meta.url),
      'utf8',
    ));
    const realArmImport = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(realExport), format: 'arm' },
    }));
    assert.equal(realArmImport.coverage.totalResources, 699);
    assert.equal(realArmImport.coverage.mapped, 5);
    assert.equal(realArmImport.coverage.folded, 694);
    assert.equal(realArmImport.coverage.edgeCount, 1);
    assert.equal(realArmImport.services.length, 5);
    assert.equal(realArmImport.services.find(service => service.name === 'aqcosmosdb007')?.type, 'Azure Cosmos DB');
    assert.equal(realArmImport.services.find(service => service.name === 'aqcosmosdb007')?.region, 'westus2');
    assert.equal(realArmImport.services.find(service => service.name === 'azure-diagram-builder')?.region, 'eastus2');
    assert.deepEqual(realArmImport.coverage.uncanonicalizedTypes, ['Container Apps Environment']);
    assert.match(realArmImport.warnings.join(' '), /no canonical AADB catalog equivalent/i);

    const armFormatMismatch = await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(roundTripScene), format: 'arm' },
    });
    assert.equal(armFormatMismatch.isError, true);
    assert.match(armFormatMismatch.content.find(item => item.type === 'text')?.text ?? '', /expected a "resources" array/i);

    // Runtime location expressions are not resolvable, so no region is claimed.
    const armRuntimeLocation = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: {
        format: 'arm',
        content: JSON.stringify({
          $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
          contentVersion: '1.0.0.0',
          resources: [
            { type: 'Microsoft.Storage/storageAccounts', name: 'runtimeloc', location: '[resourceGroup().location]', properties: {} },
          ],
        }),
      },
    }));
    assert.equal(armRuntimeLocation.services.length, 1);
    assert.equal(armRuntimeLocation.services[0].name, 'runtimeloc');
    assert.equal('region' in armRuntimeLocation.services[0], false);

    for (const iacTool of ['bicep', 'terraform']) {
      const guideResult = await client.callTool({
        name: 'generate_deployment_guide',
        arguments: {
          projectName: 'contract-test',
          location: 'eastus2',
          iacTool,
          services: initialArchitecture.services,
          connections: initialArchitecture.connections,
        },
      });
      const guide = textPayload(guideResult);
      assert.deepEqual(guideResult.structuredContent, guide);
      assert.equal(guide.iacTool, iacTool);
      assert(guide.markdown.includes('contract-test'));
    }

    const regionalGuide = textPayload(await client.callTool({
      name: 'generate_deployment_guide',
      arguments: {
        projectName: 'regional-contract-test',
        location: 'eastus2',
        iacTool: 'bicep',
        ...regionalArchitecture,
      },
    }));
    assert(regionalGuide.markdown.includes('Regional placement limitation'));
    assert(regionalGuide.markdown.includes('is not yet emitted as multi-region IaC'));

    console.log('MCP contract test passed: stateless missing/stale-session recovery, all 13 handlers, 3 resources, 3 prompts, auth, metadata, pricing, regional comparison, hardening idempotency, and deployment guides.');
  } finally {
    if (client) await client.close().catch(() => {});
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});