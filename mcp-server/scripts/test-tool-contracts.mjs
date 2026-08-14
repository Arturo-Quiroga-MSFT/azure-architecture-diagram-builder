#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const EXPECTED_TOOLS = [
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

    const initialArchitecture = {
      services: [
        { name: 'Web', type: 'App Service' },
        { name: 'Data', type: 'SQL Database' },
      ],
      connections: [{ from: 'Web', to: 'Data', label: 'Query application data' }],
      groups: [],
    };

    const validation = await client.callTool({
      name: 'validate_architecture',
      arguments: initialArchitecture,
    });
    assert.equal(typeof validation.structuredContent?.score, 'number');

    const manifest = textPayload(await client.callTool({
      name: 'generate_manifest',
      arguments: {
        projectName: 'contract-test',
        location: 'eastus2',
        iacTool: 'bicep',
        ...initialArchitecture,
      },
    }));
    assert.equal(manifest.project.name, 'contract-test');

    const regionalArchitecture = {
      services: [
        { name: 'Primary Web', type: 'App Service', region: 'East US 2' },
        { name: 'Secondary Data', type: 'SQL Database', region: 'Central US' },
      ],
      connections: [{ from: 'Primary Web', to: 'Secondary Data', label: 'Query replicated application data' }],
      groups: [],
    };
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

    const importedRegionalManifest = textPayload(await client.callTool({
      name: 'import_architecture',
      arguments: { content: JSON.stringify(regionalManifest), format: 'manifest' },
    }));
    assert.deepEqual(importedRegionalManifest.services.map(service => service.region), ['eastus2', 'centralus']);

    const bicep = textPayload(await client.callTool({
      name: 'generate_bicep',
      arguments: {
        projectName: 'contract-test',
        location: 'eastus2',
        ...initialArchitecture,
      },
    }));
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

    const terraform = textPayload(await client.callTool({
      name: 'generate_terraform',
      arguments: {
        projectName: 'contract-test',
        location: 'eastus2',
        ...initialArchitecture,
      },
    }));
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

    const mixedRegionEstimate = await client.callTool({
      name: 'estimate_costs',
      arguments: {
        region: 'eastus2',
        term: 'payg',
        services: [
          { name: 'Primary API', type: 'API Management', tier: 'standard', region: 'eastus2' },
          { name: 'Secondary API', type: 'API Management', tier: 'standard', region: 'Central US' },
          { name: 'Shared Monitor', type: 'Azure Monitor', region: 'eastus2' },
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
    assert.equal(mixed?.regionProxyUsed, true);
    assert.equal(mixed?.proxiedResourceCount, 1);
    assert.deepEqual(mixed?.requestedRegions, ['centralus', 'eastus2']);
    assert.deepEqual(mixed?.effectiveRegions, ['eastus2']);
    const secondary = mixed?.estimates.find(item => item.name === 'Secondary API');
    assert.equal(secondary?.requestedRegion, 'centralus');
    assert.equal(secondary?.effectiveRegion, 'eastus2');
    assert.equal(secondary?.regionProxyUsed, true);
    assert(secondary?.regionProxyReason.includes('No bundled pricing snapshot'));

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
    assert.equal(quantityCoverage?.proxiedResourceCount, 10);
    assert.equal(quantityCoverage?.numericCoveragePercent, 83.33);
    assert.equal(quantityCoverage?.baselineLabel, 'Partial fixed-price baseline covering 10/12 resources');
    assert.equal(quantityCoverage?.excludedServices[0]?.quantity, 2);

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

    const scene = textPayload(await client.callTool({
      name: 'export_reactflow_scene',
      arguments: {
        architectureName: 'Contract Test Architecture',
        region: 'none',
        ...initialArchitecture,
      },
    }));
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

    for (const iacTool of ['bicep', 'terraform']) {
      const guide = textPayload(await client.callTool({
        name: 'generate_deployment_guide',
        arguments: {
          projectName: 'contract-test',
          location: 'eastus2',
          iacTool,
          services: initialArchitecture.services,
          connections: initialArchitecture.connections,
        },
      }));
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

    console.log('MCP contract test passed: stateless missing/stale-session recovery, all 12 handlers, 3 resources, 3 prompts, auth, metadata, pricing, hardening idempotency, and deployment guides.');
  } finally {
    if (client) await client.close().catch(() => {});
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});