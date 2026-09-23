import assert from 'node:assert/strict';
import { preserveManualLayout, type LayoutNode } from '../src/utils/preserveManualLayout.ts';

const previous: LayoutNode[] = [
  {
    id: 'old-group',
    type: 'groupNode',
    position: { x: 100, y: 50 },
    data: { label: 'Application Tier' },
    style: { width: 500, height: 300, backgroundColor: '#eef6ff' },
    width: 500,
    height: 300,
  },
  {
    id: 'old-app',
    type: 'azureNode',
    position: { x: 40, y: 60 },
    parentNode: 'old-group',
    data: { label: 'App Service', pricing: { estimatedCost: 125 }, stylePreset: 'presentation' },
    style: { opacity: 0.9 },
  },
  {
    id: 'removed-cache',
    type: 'azureNode',
    position: { x: 720, y: 100 },
    data: { label: 'Azure Cache for Redis' },
  },
];

const generated: LayoutNode[] = [
  {
    id: 'new-group-id',
    type: 'groupNode',
    position: { x: 600, y: 400 },
    data: { label: 'Application Tier' },
    style: { width: 700, height: 500 },
    width: 700,
    height: 500,
  },
  {
    id: 'new-monitor',
    type: 'azureNode',
    position: { x: 40, y: 60 },
    parentNode: 'new-group-id',
    data: { label: 'Application Insights' },
  },
  {
    id: 'regenerated-app-id',
    type: 'azureNode',
    position: { x: 80, y: 90 },
    parentNode: 'new-group-id',
    data: { label: 'app-service', iconPath: '/new-app-service.svg' },
  },
];

const result = preserveManualLayout(previous, generated);
const group = result.find((node) => node.id === 'new-group-id');
const app = result.find((node) => node.id === 'regenerated-app-id');
const monitor = result.find((node) => node.id === 'new-monitor');

assert.deepEqual(group?.position, { x: 100, y: 50 }, 'group position should survive regenerated IDs');
assert.equal((group?.style as Record<string, unknown>).backgroundColor, '#eef6ff', 'manual group style should be retained');

assert.deepEqual(app?.position, { x: 40, y: 60 }, 'service absolute position should survive parent ID changes');
assert.equal(app?.parentNode, 'new-group-id', 'generated topology should own the current parent ID');
assert.equal((app?.data as Record<string, unknown>).iconPath, '/new-app-service.svg', 'generated icon should be accepted');
assert.equal((app?.data as Record<string, unknown>).stylePreset, 'presentation', 'editor display data should survive');

assert.deepEqual(monitor?.position, { x: 300, y: 60 }, 'new services should move only when their generated position overlaps');
assert.equal((group?.style as Record<string, unknown>).width, 528, 'parent groups should expand only enough to contain additions');
assert.equal(result.some((node) => node.id === 'removed-cache'), false, 'removed services should stay removed');

const stableIdResult = preserveManualLayout(
  [{ id: 'sql', type: 'azureNode', position: { x: 20, y: 40 }, data: { label: 'SQL Database' } }],
  [{ id: 'sql', type: 'azureNode', position: { x: 900, y: 800 }, data: { label: 'Renamed SQL Database' } }],
);
assert.deepEqual(stableIdResult[0].position, { x: 20, y: 40 }, 'stable IDs should take precedence over labels');

const unchangedGroupResult = preserveManualLayout(
  previous.slice(0, 2),
  generated.slice(0, 2),
);
assert.equal(
  (unchangedGroupResult[0].style as Record<string, unknown>).width,
  500,
  'manual group dimensions should remain unchanged when no addition needs more room',
);

console.log('Layout preservation tests passed.');