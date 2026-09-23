import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function readJsonLines(path) {
  return readFileSync(join(root, path), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

const config = readJson('evaluations/aadb/cases.v2.json');
const captures = readJsonLines('.foundry/captures/aadb-v2-attempts.jsonl');
const captureSummary = readJson('.foundry/captures/aadb-v2-capture.json');
const datasetText = readFileSync(join(root, '.foundry/datasets/aadb-eval-seed-v2.jsonl'), 'utf8');
const datasetRows = datasetText.split('\n').filter(Boolean).map(JSON.parse);
const manifest = readJson('.foundry/datasets/manifest.v2.json');
const baseline = readJson('.foundry/results/aadb-baseline-v2.json').summary;
const resultRows = readJsonLines('.foundry/results/aadb-baseline-v2.rows.jsonl');
const reviewRows = readJsonLines('.foundry/reviews/aadb-v2-review-sample.jsonl');
const reviewStatus = readJson('.foundry/reviews/aadb-v2-review-status.json');
const v1Manifest = readJson('.foundry/datasets/manifest.json');
const evaluationMetadata = readJson('.foundry/evaluation-metadata.json');
const scorecard = readJson('.foundry/results/aadb-model-scorecard-v2.json');

assert.equal(config.version, 'v2');
assert.equal(config.mode, 'topology');
assert.equal(config.cases.length, 8);
assert.equal(new Set(config.cases.map(item => item.id)).size, 8);
assert.equal(config.capture.modelRoles.length, 3);
assert.equal(config.capture.attemptsPerModel, 2);
assert.equal(config.cases.length * config.capture.modelRoles.length * config.capture.attemptsPerModel, 48);

assert.equal(captures.length, 48);
assert.equal(new Set(captures.map(row => row.attempt_id)).size, 48);
assert.deepEqual(captureSummary.statusCounts, { success: 48 });
assert.equal(captureSummary.lineage.app_commit, '71ef7e82e354aefb738bb92082216ae4e9326875');
assert.equal(captureSummary.lineage.topology_contract_sha256, '6a72f6ec1b86524b826f4cb32978109784678acc8a780e9f5bb9add089f890bf');
assert.equal(captureSummary.attemptFileSha256, sha256(readFileSync(join(root, '.foundry/captures/aadb-v2-attempts.jsonl'))));

assert.equal(datasetRows.length, 48);
assert.equal(manifest.rowCount, 48);
assert.equal(manifest.attemptCount, 48);
assert.equal(manifest.generationSuccessCount, 48);
assert.equal(manifest.generationFailureCount, 0);
assert.equal(manifest.generationSuccessRate, 1);
assert.equal(manifest.datasetSha256, '0528c33f3abd6d81b3369a1bddc1a26643cb5d82d46c323fba06ba85150c35b3');
assert.equal(manifest.datasetSha256, sha256(datasetText));

const modelCounts = Object.fromEntries(
  [...new Set(datasetRows.map(row => row.candidate.model))]
    .sort()
    .map(model => [model, datasetRows.filter(row => row.candidate.model === model).length]),
);
assert.deepEqual(modelCounts, {
  'gpt-5.2': 16,
  'gpt-5.6-luna': 16,
  'kimi-k2-7-code': 16,
});
for (const scenario of config.cases) {
  assert.equal(datasetRows.filter(row => row.scenario_id === scenario.id).length, 6);
}

assert.equal(resultRows.length, 48);
assert.equal(baseline.evaluator.version, 'v2');
assert.equal(baseline.overall.candidates, 48);
assert.equal(baseline.overall.passed, 27);
assert.equal(baseline.overall.passRate, 0.563);
assert.equal(baseline.overall.averageScore, 96.8);
assert.equal(resultRows.filter(row => !row.result.schemaValid).length, 0);
assert.equal(resultRows.filter(row => !row.result.labelsPass).length, 0);
assert.equal(resultRows.filter(row => !row.result.connectionTypesPass).length, 0);
assert.equal(resultRows.filter(row => !row.result.postProcessingIntegrityPass).length, 0);

assert.equal(reviewRows.length, 16);
assert.ok(['pending-human-review', 'approved', 'rejected'].includes(reviewStatus.status));
assert.equal(reviewStatus.datasetSha256, manifest.datasetSha256);
assert.ok(reviewRows.every(row => !('model' in row) && !('candidate' in row)));
assert.equal(new Set(reviewRows.map(row => row.scenario_id)).size, 8);
for (const row of reviewRows) {
  const serialized = JSON.stringify(row).toLowerCase();
  for (const modelId of ['gpt-5.2', 'gpt-5.6-luna', 'kimi-k2-7-code']) {
    assert.ok(!serialized.includes(modelId), `Blinded review row leaks ${modelId}`);
  }
  const keys = [];
  const collectKeys = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      keys.push(key.toLowerCase());
      collectKeys(child);
    }
  };
  collectKeys(row);
  for (const forbiddenKey of ['model', 'deployment', 'prompttokens', 'completiontokens', 'totaltokens']) {
    assert.ok(!keys.includes(forbiddenKey), `Blinded review row leaks key ${forbiddenKey}`);
  }
}

assert.equal(v1Manifest.version, 'v1');
assert.equal(v1Manifest.datasetSha256, '96e9605a7c50e4be2aa7aa4da447a11406e494365e17294d1ebe29ad1316a496');
assert.equal(evaluationMetadata.dataset.remoteRegistration.version, '1');
const pendingV2 = evaluationMetadata.pendingDatasets.find(item => item.version === 'v2');
assert.ok(pendingV2);
assert.equal(pendingV2.sha256, manifest.datasetSha256);
assert.equal(pendingV2.remoteRegistration, null);

if (reviewStatus.status === 'pending-human-review') {
  assert.equal(reviewStatus.approvedForFoundryRegistration, false);
  assert.ok(reviewRows.every(row => row.reviewer.status === 'pending'));
  assert.equal(pendingV2.status, 'pending-human-review');
  assert.equal(pendingV2.approvedForFoundryRegistration, false);
} else {
  assert.ok(reviewRows.every(row => row.reviewer.status === 'reviewed'));
  for (const row of reviewRows) {
    for (const dimension of ['architectureSuitability', 'requirementAdherence', 'security', 'explanationQuality']) {
      assert.ok(Number.isInteger(row.reviewer[dimension]));
      assert.ok(row.reviewer[dimension] >= 1 && row.reviewer[dimension] <= 5);
    }
  }
  assert.equal(pendingV2.status, reviewStatus.status === 'approved' ? 'approved-human-review' : 'rejected-human-review');
  assert.equal(pendingV2.approvedForFoundryRegistration, reviewStatus.status === 'approved');
}

assert.equal(scorecard.generatedFrom.datasetSha256, manifest.datasetSha256);
assert.equal(scorecard.generatedFrom.feature, 'topology-generation');
assert.equal(scorecard.models.length, 3);
assert.deepEqual(scorecard.models.map(item => item.model), [
  'gpt-5.6-luna',
  'kimi-k2-7-code',
  'gpt-5.2',
]);
assert.ok(scorecard.models.every(item => item.attempts === 16));
assert.ok(scorecard.models.every(item => item.humanReview.status === reviewStatus.status));
if (reviewStatus.status === 'pending-human-review') {
  assert.ok(scorecard.models.every(item => item.humanReview.sampleSize === 0));
  assert.ok(scorecard.models.every(item => item.humanReview.averageOverall === null));
} else {
  assert.equal(scorecard.models.reduce((sum, item) => sum + item.humanReview.sampleSize, 0), 16);
  assert.ok(scorecard.models.every(item => item.humanReview.averageOverall !== null));
}
assert.equal(scorecard.evidenceStatus.cost.status, 'not-computed');
assert.equal(scorecard.evidenceStatus.recommendationsProvisional, true);
assert.equal(scorecard.leaders.deterministicQuality, 'gpt-5.6-luna');
if (reviewStatus.status === 'pending-human-review') {
  assert.equal(scorecard.leaders.humanQualitySampled, null);
} else {
  assert.ok(scorecard.models.some(item =>
    item.model === scorecard.leaders.humanQualitySampled
    && item.humanReview.averageOverall !== null));
}
assert.equal(scorecard.leaders.speedP50, 'gpt-5.6-luna');
assert.equal(scorecard.leaders.tokenEfficiency, 'gpt-5.6-luna');
assert.deepEqual(scorecard.leaders.paretoFrontier, ['gpt-5.6-luna']);
assert.equal(scorecard.byScenario.length, 8);
assert.equal(scorecard.byPromptStyle.length, 4);
assert.ok(scorecard.byScenario.every(item => item.promptStyle && item.source));

console.log(JSON.stringify({
  attempts: captures.length,
  datasetRows: datasetRows.length,
  datasetSha256: manifest.datasetSha256,
  deterministicPassed: baseline.overall.passed,
  deterministicPassRate: baseline.overall.passRate,
  reviewRows: reviewRows.length,
  reviewStatus: reviewStatus.status,
  v1Preserved: true,
}, null, 2));
