import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(readFileSync(join(root, '.foundry/datasets/manifest.json'), 'utf8'));
const summary = JSON.parse(readFileSync(join(root, '.foundry/results/aadb-baseline-v1.json'), 'utf8')).summary;
const rows = readFileSync(join(root, '.foundry/results/aadb-baseline-v1.rows.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(JSON.parse);

assert.equal(manifest.name, 'aadb-eval-seed');
assert.equal(manifest.version, 'v1');
assert.equal(manifest.rowCount, 14);
assert.equal(manifest.scenarioCount, 2);
assert.equal(manifest.datasetSha256, '96e9605a7c50e4be2aa7aa4da447a11406e494365e17294d1ebe29ad1316a496');

assert.equal(rows.length, 14);
assert.equal(summary.overall.candidates, 14);
assert.equal(summary.overall.passed, 2);
assert.equal(summary.overall.passRate, 0.143);
assert.equal(summary.overall.averageScore, 93.9);
assert.equal(summary.overall.averageServiceRecall, 1);
assert.equal(summary.overall.averageConnectionRecall, 0.911);

assert.deepEqual(
  rows.filter(row => row.result.passed).map(row => row.case_id),
  [
    'multi-region-commerce::gpt52codex-low',
    'intelligent-document-processing::unknown',
  ],
);
assert.equal(
  rows.reduce((total, row) => total + row.result.counts.forbiddenConnections, 0),
  12,
  'The v1 corpus should preserve the known reversed observability-flow failures.',
);
assert.equal(
  rows.reduce((total, row) => total + row.result.missingConnections.length, 0),
  5,
  'The v1 corpus should preserve the known missing required-flow failures.',
);

console.log('AADB evaluation baseline v1 verification passed.');