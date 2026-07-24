#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconMap = JSON.parse(readFileSync(resolve(root, 'dist', 'iconMap.generated.json'), 'utf8'));
const iconSvgs = JSON.parse(readFileSync(resolve(root, 'dist', 'iconSvgs.generated.json'), 'utf8'));

function textResult(result) {
  const text = result.content?.find(item => item.type === 'text')?.text;
  assert.equal(typeof text, 'string', 'tool must return text content');
  return text;
}

function assertOfficialIcons(svg, services) {
  for (const service of services) {
    const iconFile = iconMap[service].iconFile;
    assert(svg.includes(iconSvgs[iconFile]), `${service} must render its mapped official icon`);
  }
}

function assertAlias(byKey, canonicalName, alias) {
  const service = byKey.get(canonicalName);
  assert(service, `${canonicalName} must be discoverable`);
  assert(service.aliases.includes(alias), `${alias} must resolve to ${canonicalName}`);
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [resolve(root, 'dist', 'index.js')],
  stderr: 'pipe',
});
const client = new Client({ name: 'aadb-icon-smoke', version: '1.0.0' });

try {
  await client.connect(transport);

  const listResult = await client.callTool({ name: 'list_services', arguments: {} });
  const listed = JSON.parse(textResult(listResult));
  assert.equal(listed.totalServices, 104);
  const byKey = new Map(listed.services.map(service => [service.key, service]));

  const foundryServices = [
    'Microsoft Foundry',
    'Foundry Application',
    'Foundry Project',
    'Foundry IQ',
    'Microsoft Foundry Agent Service',
    'Microsoft Foundry Control Plane',
    'Foundry Labs',
    'Foundry Local',
    'Microsoft Foundry Models',
  ];
  for (const service of foundryServices) assert(byKey.has(service), `${service} must be discoverable`);
  assert(byKey.has('AI Gateway'), 'AI Gateway must be discoverable');
  assert(byKey.has('Azure AI Search'), 'Azure AI Search must be discoverable');
  assertAlias(byKey, 'Microsoft Foundry', 'Azure AI Foundry');
  assertAlias(byKey, 'Microsoft Foundry Models', 'Foundry Models');
  assertAlias(byKey, 'Microsoft Foundry Agent Service', 'Foundry Agent Service');
  assertAlias(byKey, 'Microsoft Foundry Control Plane', 'Foundry Control Plane');
  assertAlias(byKey, 'Azure AI Search', 'Azure Cognitive Search');
  assertAlias(byKey, 'Web Application Firewall', 'WAF Policy');

  const fabricResult = await client.callTool({
    name: 'list_services',
    arguments: { category: 'fabric' },
  });
  assert.equal(JSON.parse(textResult(fabricResult)).totalServices, 20);

  const requiredRenderServices = [
    { type: 'Foundry Models', canonical: 'Microsoft Foundry Models' },
    { type: 'Foundry Agent Service', canonical: 'Microsoft Foundry Agent Service' },
    { type: 'Foundry IQ', canonical: 'Foundry IQ' },
    { type: 'AI Gateway', canonical: 'AI Gateway' },
    { type: 'Azure AI Search', canonical: 'Azure AI Search' },
    { type: 'Lakehouse', canonical: 'Lakehouse' },
  ];
  const foundryRender = await client.callTool({
    name: 'render_diagram',
    arguments: {
      title: 'Microsoft Foundry V24 icon smoke test',
      region: 'none',
      services: requiredRenderServices.map(service => ({ name: service.type, type: service.type })),
    },
  });
  const foundrySvg = textResult(foundryRender);
  assertOfficialIcons(
    foundrySvg,
    requiredRenderServices.map(service => service.canonical),
  );
  assert.equal((foundrySvg.match(/<image\b/g) ?? []).length, requiredRenderServices.length);
  const renderSha256 = createHash('sha256').update(foundrySvg).digest('hex');

  const regressionServices = ['App Service', 'Microsoft Fabric Capacity', 'Lakehouse'];
  const regressionRender = await client.callTool({
    name: 'render_diagram',
    arguments: {
      title: 'Azure and Fabric icon regression',
      region: 'none',
      services: regressionServices.map(service => ({ name: service, type: service })),
    },
  });
  assertOfficialIcons(textResult(regressionRender), regressionServices);

  const sceneResult = await client.callTool({
    name: 'export_reactflow_scene',
    arguments: {
      region: 'none',
      services: [{ name: 'Foundry workspace', type: 'Azure AI Foundry' }],
    },
  });
  const sceneText = textResult(sceneResult);
  const scene = JSON.parse(sceneText);
  const foundryNode = scene.nodes.find(node => node.type === 'azureNode');
  assert.equal(foundryNode.data.azureServiceType, 'Microsoft Foundry');
  assert(foundryNode.data.iconPath.endsWith('/035746832-icon-service-AI-Foundry.svg'));

  const importResult = await client.callTool({
    name: 'import_architecture',
    arguments: { content: sceneText, format: 'reactflow' },
  });
  const imported = JSON.parse(textResult(importResult));
  assert.equal(imported.services[0].type, 'Microsoft Foundry');

  const legacyImportResult = await client.callTool({
    name: 'import_architecture',
    arguments: {
      content: JSON.stringify({
        nodes: [{
          id: 'orders-api',
          type: 'azureNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'orders-api',
            iconPath: '/Azure_Public_Service_Icons/Icons/app services/app-service.svg',
          },
        }],
        edges: [],
      }),
      format: 'reactflow',
    },
  });
  const legacyImport = JSON.parse(textResult(legacyImportResult));
  assert.equal(legacyImport.services[0].type, 'App Service');

  const legacyCdnImportResult = await client.callTool({
    name: 'import_architecture',
    arguments: {
      content: JSON.stringify({
        nodes: [{
          id: 'public-assets',
          type: 'azureNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'public-assets',
            iconPath: '/Azure_Public_Service_Icons/Icons/app services/cdn-profiles.svg',
          },
        }],
        edges: [],
      }),
      format: 'reactflow',
    },
  });
  const legacyCdnImport = JSON.parse(textResult(legacyCdnImportResult));
  assert.equal(legacyCdnImport.services[0].type, 'CDN');

  const reverseLookupResult = await client.callTool({
    name: 'import_architecture',
    arguments: {
      content: JSON.stringify({
        nodes: [{
          id: 'worker',
          type: 'azureNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'worker',
            iconPath: '/Azure_Public_Service_Icons/Icons/compute/10021-icon-service-Virtual-Machine.svg',
          },
        }],
        edges: [],
      }),
      format: 'reactflow',
    },
  });
  const reverseLookup = JSON.parse(textResult(reverseLookupResult));
  assert.equal(reverseLookup.services[0].type, 'Virtual Machines');

  const fallbackSceneResult = await client.callTool({
    name: 'export_reactflow_scene',
    arguments: {
      region: 'none',
      services: [{ name: 'Custom component', type: 'Unknown Service' }],
    },
  });
  const fallbackScene = JSON.parse(textResult(fallbackSceneResult));
  assert(fallbackScene.nodes.find(node => node.type === 'azureNode').data.iconPath
    .endsWith('/general/10001-icon-service-All-Resources.svg'));

  const wafResult = await client.callTool({
    name: 'validate_architecture',
    arguments: {
      services: [
        { name: 'Web', type: 'App Service' },
        { name: 'WAF Policy', type: 'WAF Policy' },
      ],
      connections: [],
    },
  });
  assert(!textResult(wafResult).includes('no-waf'), 'WAF Policy alias must satisfy WAF detection');

  const bicepResult = await client.callTool({
    name: 'generate_bicep',
    arguments: {
      services: [
        { name: 'WAF Policy', type: 'WAF Policy' },
        { name: 'Search', type: 'Azure Cognitive Search' },
      ],
    },
  });
  const bicep = JSON.parse(textResult(bicepResult));
  assert(bicep.servicesCovered.includes('WAF Policy'));
  assert(bicep.servicesCovered.includes('Search'));
  assert(bicep.bicep.includes('FrontDoorWebApplicationFirewallPolicies'));
  assert(bicep.bicep.includes('Microsoft.Search/searchServices'));

  console.log(
    `[test-mcp-smoke] discovery, rendering, round-trip, WAF, and IaC aliases passed; ` +
    `Foundry/Fabric SVG ${Buffer.byteLength(foundrySvg)} bytes, SHA-256 ${renderSha256}`,
  );
} finally {
  await client.close();
}
