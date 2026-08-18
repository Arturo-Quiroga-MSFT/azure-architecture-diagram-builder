import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import dagre, { Graph, layout } from '@dagrejs/dagre';

const require = createRequire(import.meta.url);
const rootPackage = require('../package.json');
const rootLock = require('../package-lock.json');
const mcpPackage = require('../mcp-server/package.json');
const mcpLock = require('../mcp-server/package-lock.json');
const dagrePackage = require('@dagrejs/dagre/package.json');

for (const [name, manifest, lock] of [
  ['root', rootPackage, rootLock],
  ['mcp', mcpPackage, mcpLock],
] as const) {
  assert.equal(manifest.dependencies['@dagrejs/dagre'], '3.1.1', `${name} should pin the tested Dagre version`);
  assert.equal(manifest.dependencies.dagre, undefined, `${name} should not depend on legacy dagre`);
  assert.equal(manifest.dependencies['@types/dagre'], undefined, `${name} should use built-in Dagre types`);
  assert.equal(lock.packages['node_modules/@dagrejs/dagre']?.version, '3.1.1');
  assert.equal(lock.packages['node_modules/dagre'], undefined);
}

assert.equal(dagrePackage.version, '3.1.1');
assert.equal(dagre.graphlib.Graph, Graph);
assert.equal(dagre.layout, layout);

const graph = new Graph({ compound: true });
graph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 90 });
graph.setDefaultEdgeLabel(() => ({}));
graph.setNode('group', {});
graph.setNode('ingress', { width: 180, height: 100 });
graph.setNode('compute', { width: 180, height: 100 });
graph.setNode('data', { width: 180, height: 100 });
graph.setParent('compute', 'group');
graph.setEdge('ingress', 'compute');
graph.setEdge('compute', 'data');
layout(graph);

const ingress = graph.node('ingress');
const compute = graph.node('compute');
const data = graph.node('data');
for (const node of [ingress, compute, data]) {
  assert(Number.isFinite(node.x) && Number.isFinite(node.y), 'Dagre should assign finite coordinates');
}
assert(ingress.x < compute.x && compute.x < data.x, 'LR layout should preserve directed rank order');

console.log('Dagre 3.1.1 migration contract passed.');