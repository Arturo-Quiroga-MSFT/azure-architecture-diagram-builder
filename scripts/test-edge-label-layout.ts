import assert from 'node:assert/strict';
import type { Edge, Node } from 'reactflow';

import { deconflictEdgeLabels } from '../src/utils/edgeLabelLayout';

const nodes: Node[] = [
  { id: 'source', type: 'azureNode', position: { x: 0, y: 0 }, data: {} },
  { id: 'target', type: 'azureNode', position: { x: 600, y: 0 }, data: {} },
  { id: 'obstacle', type: 'azureNode', position: { x: 370, y: 0 }, width: 40, height: 100, data: {} },
];

const edges: Edge[] = [
  { id: 'one', source: 'source', target: 'target', sourceHandle: 'right', targetHandle: 'left', label: 'First route', data: { pathStyle: 'orthogonal' } },
  { id: 'two', source: 'source', target: 'target', sourceHandle: 'right', targetHandle: 'left', label: 'Second route', data: { pathStyle: 'orthogonal' } },
  { id: 'three', source: 'source', target: 'target', sourceHandle: 'right', targetHandle: 'left', label: 'Third route', data: { pathStyle: 'orthogonal' } },
  {
    id: 'manual',
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: 'left',
    label: 'Manually positioned connection',
    data: { pathStyle: 'orthogonal', labelOffsetX: 12, labelOffsetY: 34 },
  },
];

const result = deconflictEdgeLabels(nodes, edges);
assert.ok(
  result.slice(0, 3).some(edge => (edge.data as any).labelOffsetX !== 0),
  'an automatic label should move along its path to avoid a midpoint obstacle',
);
for (const edge of result.slice(0, 3)) {
  assert.ok(Math.abs((edge.data as any).labelOffsetX) <= 120, 'automatic labels should stay near their path anchor');
  assert.ok(Math.abs((edge.data as any).labelOffsetY) <= 90, 'automatic labels should stay within leader-line range of a horizontal path');
}
assert.deepEqual(
  {
    x: (result[3].data as any).labelOffsetX,
    y: (result[3].data as any).labelOffsetY,
  },
  { x: 12, y: 34 },
  'manually dragged label offsets should survive automatic layout',
);

const nearHorizontal = deconflictEdgeLabels([
  { id: 'near-source', type: 'azureNode', position: { x: 0, y: 300 }, data: {} },
  { id: 'near-target', type: 'azureNode', position: { x: 600, y: 310 }, data: {} },
  { id: 'near-obstacle', type: 'azureNode', position: { x: 370, y: 300 }, width: 40, height: 100, data: {} },
], [{
  id: 'near-horizontal',
  source: 'near-source',
  target: 'near-target',
  sourceHandle: 'right',
  targetHandle: 'left',
  label: 'Near route',
  data: { pathStyle: 'orthogonal' },
}]);
assert.notEqual((nearHorizontal[0].data as any).labelOffsetX, 0, 'a tiny midpoint jog should move labels along the horizontal path');
assert.ok(Math.abs((nearHorizontal[0].data as any).labelOffsetY) <= 90, 'a tiny midpoint jog should keep labels within leader-line range');

// A request and its response resolve to the same handles, so without a path
// offset they render as one line carrying two labels.
const sharedPair = deconflictEdgeLabels([
  { id: 'left', type: 'azureNode', position: { x: 0, y: 600 }, data: {} },
  { id: 'right', type: 'azureNode', position: { x: 800, y: 600 }, data: {} },
], [
  { id: 'forward', source: 'left', target: 'right', label: 'Persist chat history', data: { pathStyle: 'orthogonal' } },
  { id: 'reverse', source: 'right', target: 'left', label: 'Retrieve prior turns', data: { pathStyle: 'orthogonal' } },
]);

const forwardOffset = (sharedPair[0].data as any).pathOffset;
const reverseOffset = (sharedPair[1].data as any).pathOffset;
assert.notEqual(forwardOffset, reverseOffset, 'anti-parallel edges must not share a path');
assert.equal(forwardOffset + reverseOffset, 0, 'a pair should straddle the original path evenly');

const soloOffset = deconflictEdgeLabels([
  { id: 'a', type: 'azureNode', position: { x: 0, y: 0 }, data: {} },
  { id: 'b', type: 'azureNode', position: { x: 800, y: 0 }, data: {} },
], [{ id: 'only', source: 'a', target: 'b', label: 'Single link', data: { pathStyle: 'orthogonal' } }]);
assert.equal((soloOffset[0].data as any).pathOffset, 0, 'an unpaired edge should keep its direct path');

const containmentFanout = deconflictEdgeLabels([
  { id: 'vnet', type: 'azureNode', position: { x: 0, y: 900 }, data: {} },
  { id: 'sql-endpoint', type: 'azureNode', position: { x: 900, y: 300 }, data: {} },
  { id: 'vault-endpoint', type: 'azureNode', position: { x: 900, y: 650 }, data: {} },
  { id: 'storage-endpoint', type: 'azureNode', position: { x: 900, y: 1000 }, data: {} },
], [
  { id: 'contains-sql', source: 'vnet', target: 'sql-endpoint', label: 'Contains private endpoint for SQL Database', data: { pathStyle: 'orthogonal', connectionType: 'containment' } },
  { id: 'contains-vault', source: 'vnet', target: 'vault-endpoint', label: 'Contains private endpoint for Key Vault', data: { pathStyle: 'orthogonal', connectionType: 'containment' } },
  { id: 'contains-storage', source: 'vnet', target: 'storage-endpoint', label: 'Contains private endpoint for Storage Account', data: { pathStyle: 'orthogonal', connectionType: 'containment' } },
]);
const containmentPathOffsets = containmentFanout.map(edge => (edge.data as any).pathOffset);
assert.equal(new Set(containmentPathOffsets).size, 3, 'containment fanout should use distinct routed lanes');
assert.equal(
  containmentPathOffsets.reduce((sum, offset) => sum + offset, 0),
  0,
  'containment lanes should straddle the original route evenly',
);

console.log('Edge-label layout tests passed.');