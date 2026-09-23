import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tests = [
  'test:arm',
  'test:dagre-migration',
  'test:layout-preservation',
  'test:grouped-layout',
  'test:edge-label-layout',
  'test:validation-freshness',
  'test:impact',
  'test:impact-records',
  'test:production-exclusions',
  'test:service-names',
  'test:pricing-mode',
  'test:correlation',
  'test:refinement-guard',
  'test:follow-up-model',
  'test:semantic-relationships',
];

for (const testName of tests) {
  const result = spawnSync(npm, ['run', testName], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Deterministic test suite passed: ${tests.length} checks`);