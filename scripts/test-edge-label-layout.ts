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

console.log('Edge-label layout tests passed.');