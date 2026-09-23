import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = join(root, 'evaluations/aadb/cases.v2.json');
const capturePath = join(root, '.foundry/captures/aadb-v2-attempts.jsonl');
const captureSummaryPath = join(root, '.foundry/captures/aadb-v2-capture.json');
const outputDir = join(root, '.foundry/datasets');
const outputPath = join(outputDir, 'aadb-eval-seed-v2.jsonl');
const manifestPath = join(outputDir, 'manifest.v2.json');
const force = process.argv.includes('--force');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function readJsonLines(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${error.message}`);
      }
    });
}

function writeImmutable(path, content) {
  if (existsSync(path)) {
    const existing = readFileSync(path, 'utf8');
    if (existing !== content && !force) {
      throw new Error(
        `Refusing to overwrite ${path} with different content. `
        + 'Create a new dataset version, or use --force only for an acknowledged correction.',
      );
    }
  }
  writeFileSync(path, content);
}

const configText = readFileSync(configPath, 'utf8');
const config = JSON.parse(configText);
const captures = readJsonLines(capturePath);
const captureSummary = JSON.parse(readFileSync(captureSummaryPath, 'utf8'));
const expectedAttempts = config.cases.length
  * config.capture.modelRoles.length
  * config.capture.attemptsPerModel;
const uniqueAttemptIds = new Set(captures.map(row => row.attempt_id));

if (captures.length !== expectedAttempts || uniqueAttemptIds.size !== expectedAttempts) {
  throw new Error(
    `Expected ${expectedAttempts} unique attempts, found ${captures.length} rows and ${uniqueAttemptIds.size} IDs.`,
  );
}

const caseById = new Map(config.cases.map(item => [item.id, item]));
const successful = captures.filter(row => row.status === 'success');
const failed = captures.filter(row => row.status !== 'success');
const rows = successful.map(capture => {
  const scenario = caseById.get(capture.scenario.id);
  if (!scenario) throw new Error(`Unknown scenario in capture: ${capture.scenario.id}`);
  const architecture = capture.architecture;
  if (!architecture?.services || !architecture?.connections || !architecture?.groups) {
    throw new Error(`Successful capture ${capture.attempt_id} has no complete normalized architecture.`);
  }

  return {
    case_id: capture.attempt_id,
    scenario_id: scenario.id,
    dataset_name: config.name,
    dataset_version: config.version,
    mode: config.mode,
    query: scenario.prompt,
    response: JSON.stringify(architecture),
    context: JSON.stringify({
      expected_behavior: scenario.expectedBehavior,
      requirements: scenario.requirements,
      prompt_style: scenario.promptStyle,
      difficulty: scenario.difficulty,
    }),
    expected_behavior: scenario.expectedBehavior,
    requirements: scenario.requirements,
    candidate: {
      id: `${capture.model.id}::${capture.attempt_number}`,
      model: capture.model.id,
      displayName: capture.model.displayName,
      modelRole: capture.model.role,
      deployment: capture.model.deployment,
      apiFormat: capture.model.apiFormat,
      reasoningEffort: capture.model.reasoningEffort,
      attemptNumber: capture.attempt_number,
    },
    metrics: {
      ...capture.metrics,
      captureElapsedTimeMs: capture.elapsed_time_ms,
    },
    architecture,
    lineage: {
      captureFile: '.foundry/captures/aadb-v2-attempts.jsonl',
      attemptId: capture.attempt_id,
      capturedAt: capture.captured_at,
      scenarioSource: scenario.source,
      promptSha256: capture.prompt_sha256,
      appCommit: capture.lineage.app_commit,
      appBranch: capture.lineage.app_branch,
      dirtyWorktree: capture.lineage.dirty_worktree,
      topologyContractVersion: capture.lineage.topology_contract_version,
      topologyContractSha256: capture.lineage.topology_contract_sha256,
      sourceFingerprintSha256: capture.lineage.source_fingerprint_sha256,
      configSha256: capture.lineage.config_sha256,
    },
  };
});

mkdirSync(outputDir, { recursive: true });
const jsonl = `${rows.map(row => JSON.stringify(row)).join('\n')}\n`;
const statusCounts = captures.reduce((counts, row) => {
  counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
}, {});
const modelCounts = rows.reduce((counts, row) => {
  counts[row.candidate.model] = (counts[row.candidate.model] ?? 0) + 1;
  return counts;
}, {});
const scenarioCounts = rows.reduce((counts, row) => {
  counts[row.scenario_id] = (counts[row.scenario_id] ?? 0) + 1;
  return counts;
}, {});
const manifest = {
  name: config.name,
  stage: config.stage,
  version: config.version,
  mode: config.mode,
  description: config.description,
  datasetFile: '.foundry/datasets/aadb-eval-seed-v2.jsonl',
  datasetSha256: sha256(jsonl),
  rowCount: rows.length,
  scenarioCount: config.cases.length,
  attemptCount: captures.length,
  generationSuccessCount: successful.length,
  generationFailureCount: failed.length,
  generationSuccessRate: captures.length ? successful.length / captures.length : 0,
  statusCounts,
  modelCounts,
  scenarioCounts,
  configFile: 'evaluations/aadb/cases.v2.json',
  configSha256: sha256(configText),
  captureFile: '.foundry/captures/aadb-v2-attempts.jsonl',
  captureSha256: sha256(readFileSync(capturePath)),
  captureSummaryFile: '.foundry/captures/aadb-v2-capture.json',
  captureSummarySha256: sha256(readFileSync(captureSummaryPath)),
  topologyContractVersion: captureSummary.lineage.topology_contract_version,
  topologyContractSha256: captureSummary.lineage.topology_contract_sha256,
  sourceFingerprintSha256: captureSummary.lineage.source_fingerprint_sha256,
  appCommit: captureSummary.lineage.app_commit,
  appBranch: captureSummary.lineage.app_branch,
  dirtyWorktree: captureSummary.lineage.dirty_worktree,
  dirtyFiles: captureSummary.lineage.dirty_files,
  models: captureSummary.matrix.models,
  builtFromCaptureAt: captureSummary.capturedAt,
};

writeImmutable(outputPath, jsonl);
writeImmutable(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  datasetFile: outputPath,
  manifestFile: manifestPath,
  rows: rows.length,
  attempts: captures.length,
  failures: failed.length,
  datasetSha256: manifest.datasetSha256,
}, null, 2));
