// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Regression test for the deterministic ARM extractor
 * (src/services/armExtractor.ts) against real `az group export` fixtures.
 *
 * Run:  node scripts/test-arm-extractor.mjs   (or: npm run test:arm)
 *
 * These fixtures are real Resource Group exports (secrets are SecureString
 * params without defaultValue, and Azure zeroes subscription GUIDs on export),
 * so they exercise the messy realities the extractor must handle:
 *   • names as [parameters('..._name')] expressions
 *   • hundreds of noise child resources (Log Analytics tables, saved searches,
 *     RAI policies, deployments, secrets, scope maps, role definitions, …)
 *   • real dependsOn / resourceId() edges
 */

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'tests', 'fixtures', 'arm');

// Bundle the TypeScript extractor to a temp ESM module we can import.
const outfile = join(tmpdir(), `armExtractor.${process.pid}.mjs`);
await build({
  entryPoints: [join(ROOT, 'src', 'services', 'armExtractor.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  logLevel: 'silent',
});
const { extractArchitectureFromArm, classifyRelationship } = await import(outfile);

// Expectations: each fixture must map at least this many services and edges,
// fold the vast majority of resources (noise), and skip almost nothing.
// expectEdges: [from description fragment, label, to description fragment]
const CASES = [
  { file: 'AQ_FOUNDRY_RG.json', minServices: 20, minEdges: 10, maxSkippedTypes: 3, expectNames: ['AQ-DOC-INTEL', 'aq-app-insights-001'],
    expectEdges: [
      ['AQ-ML-WORK-001', 'reads secrets from', 'Key Vault'],
      ['AQ-ML-WORK-001', 'pulls images from', 'Container Registry'],
      ['AQ-ML-WORK-001', 'sends telemetry to', 'Application Insights'],
      ['Application Insights', 'stores telemetry in', 'Log Analytics'],
      ['aq-hub-project', 'part of hub', 'aq-main-hub'],
      ['Storage Account: aqmlwork', 'publishes events to', 'Event Grid'],
    ] },
  { file: 'AZURE_DIAGRAM_RG.json', minServices: 5, minEdges: 1, maxSkippedTypes: 2, expectNames: ['aqcosmosdb007', 'azure-diagram-builder'],
    expectEdges: [['azure-diagram-builder', 'runs in', 'Container Apps Environment']] },
  { file: 'DATASHEET_RG.json', minServices: 4, minEdges: 1, maxSkippedTypes: 2, expectNames: ['app-datasheet-processor'],
    expectEdges: [['app-datasheet-processor', 'runs in', 'Container Apps Environment']] },
];

let failures = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg) => console.log(`  ✓ ${msg}`);

for (const c of CASES) {
  console.log(`\n${c.file}`);
  const template = JSON.parse(readFileSync(join(FIX, c.file), 'utf8'));
  const { architecture, coverage } = extractArchitectureFromArm(template);
  const descs = architecture.services.map((s) => s.description).join(' | ');

  if (coverage.mapped >= c.minServices) ok(`mapped ${coverage.mapped} services (>= ${c.minServices})`);
  else fail(`only mapped ${coverage.mapped} services (expected >= ${c.minServices})`);

  if (coverage.edgeCount >= c.minEdges) ok(`derived ${coverage.edgeCount} edges (>= ${c.minEdges})`);
  else fail(`only ${coverage.edgeCount} edges (expected >= ${c.minEdges})`);

  // The overwhelming majority of a real export is noise that must be folded.
  if (coverage.folded > coverage.mapped) ok(`folded ${coverage.folded} noise resources`);
  else fail(`folded only ${coverage.folded} (expected > mapped ${coverage.mapped})`);

  if (coverage.skippedTypes.length <= c.maxSkippedTypes) ok(`skipped ${coverage.skippedTypes.length} unmapped types`);
  else fail(`skipped ${coverage.skippedTypes.length} types: ${coverage.skippedTypes.join(', ')}`);

  // Names must resolve from parameter defaultValues (not mangled tokens).
  for (const n of c.expectNames) {
    if (descs.includes(n)) ok(`resolved real name "${n}"`);
    else fail(`missing resolved name "${n}"`);
  }

  // Edges carry meaningful labels, not just "depends on".
  const desc = new Map(architecture.services.map((s) => [s.id, s.description]));
  for (const [from, label, to] of c.expectEdges) {
    const hit = architecture.connections.some((e) => e.label === label
      && desc.get(e.from)?.includes(from) && desc.get(e.to)?.includes(to));
    if (hit) ok(`edge ${from} —[${label}]→ ${to}`);
    else fail(`missing edge ${from} —[${label}]→ ${to}`);
  }
  const generic = architecture.connections.filter((e) => e.label === 'depends on').length;
  if (generic === 0) ok('no generic "depends on" labels left');
  else fail(`${generic} edge(s) still labelled "depends on"`);

  // Every service must carry a group and a non-empty name.
  const bad = architecture.services.filter((s) => !s.name || !s.groupId);
  if (bad.length === 0) ok('all services have a name + zone');
  else fail(`${bad.length} services missing name/zone`);
}

console.log('\nclassifyRelationship');
const rel = (...args) => classifyRelationship(...args);
const expectRel = (got, label, type, msg) => (got.label === label && got.type === type ? ok(msg) : fail(`${msg}: got ${got.label}/${got.type}`));
expectRel(rel('Microsoft.Web/sites', 'Microsoft.Web/serverfarms', '', 'serverFarmId'), 'runs on plan', 'association', 'serverFarmId path');
expectRel(rel('Microsoft.Web/sites', 'Microsoft.KeyVault/vaults'), 'reads secrets from', 'sync', 'Key Vault target');
expectRel(rel('Microsoft.App/containerApps', 'Microsoft.CognitiveServices/accounts', 'SpeechServices'), 'uses Speech', 'sync', 'Speech kind');
expectRel(rel('Microsoft.Network/privateEndpoints', 'Microsoft.Sql/servers', '', 'privateLinkServiceConnections[0].properties.privateLinkServiceId'), 'private link to', 'sync', 'private link');
expectRel(rel('Microsoft.Web/sites', 'Microsoft.Fabrikam/widgets', '', '', 'depends on'), 'depends on', 'sync', 'unknown target keeps fallback');
const pathBeatsTarget = rel('Microsoft.App/containerApps', 'Microsoft.Network/virtualNetworks', '', 'vnetConfiguration.infrastructureSubnetId');
expectRel(pathBeatsTarget, 'deployed in subnet', 'association', 'property path outranks target type');

console.log(failures === 0 ? '\n✅ ARM extractor regression tests passed' : `\n❌ ${failures} assertion(s) failed`);
process.exit(failures === 0 ? 0 : 1);
