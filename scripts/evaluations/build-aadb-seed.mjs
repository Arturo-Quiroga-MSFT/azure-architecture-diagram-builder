import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configPath = join(root, 'evaluations/aadb/cases.v1.json');
const outputDir = join(root, '.foundry/datasets');
const outputPath = join(outputDir, 'aadb-eval-seed-v1.jsonl');
const manifestPath = join(outputDir, 'manifest.json');
const force = process.argv.includes('--force');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

const configText = readFileSync(configPath, 'utf8');
const config = JSON.parse(configText);
const rows = [];
const sources = [];

for (const scenario of config.cases) {
  const sourcePath = join(root, scenario.sourceFile);
  const sourceText = readFileSync(sourcePath, 'utf8');
  const comparison = JSON.parse(sourceText);
  let candidateCount = 0;

  for (const [candidateId, candidate] of Object.entries(comparison.results ?? {})) {
    const architecture = candidate.architecture;
    if (!architecture?.services || !architecture?.connections || !architecture?.groups) continue;

    const response = JSON.stringify(architecture);
    rows.push({
      case_id: `${scenario.id}::${candidateId}`,
      scenario_id: scenario.id,
      dataset_name: config.name,
      dataset_version: config.version,
      query: comparison.prompt,
      response,
      context: JSON.stringify({
        expected_behavior: scenario.expectedBehavior,
        requirements: scenario.requirements,
      }),
      expected_behavior: scenario.expectedBehavior,
      requirements: scenario.requirements,
      candidate: {
        id: candidateId,
        model: candidate.model ?? 'unknown',
        displayName: candidate.displayName ?? candidate.model ?? candidateId,
        reasoningEffort: candidate.metrics?.reasoningEffort ?? comparison.reasoningEffort ?? 'unknown',
      },
      metrics: candidate.metrics ?? {},
      architecture,
      lineage: {
        sourceFile: scenario.sourceFile,
        sourceTimestamp: comparison.timestamp ?? null,
      },
    });
    candidateCount++;
  }

  sources.push({
    scenarioId: scenario.id,
    sourceFile: scenario.sourceFile,
    sha256: sha256(sourceText),
    candidates: candidateCount,
  });
}

if (rows.length === 0) throw new Error('No complete architecture candidates were found.');

mkdirSync(outputDir, { recursive: true });
const jsonl = `${rows.map(row => JSON.stringify(row)).join('\n')}\n`;
if (existsSync(outputPath)) {
  const existing = readFileSync(outputPath, 'utf8');
  if (existing !== jsonl && !force) {
    throw new Error(
      `Refusing to overwrite ${config.name} ${config.version} with different content. `
      + 'Bump the dataset version, or use --force only for an intentional correction.',
    );
  }
}
writeFileSync(outputPath, jsonl);
writeFileSync(manifestPath, `${JSON.stringify({
  name: config.name,
  stage: config.stage,
  version: config.version,
  description: config.description,
  datasetFile: '.foundry/datasets/aadb-eval-seed-v1.jsonl',
  rowCount: rows.length,
  scenarioCount: config.cases.length,
  configFile: 'evaluations/aadb/cases.v1.json',
  configSha256: sha256(configText),
  datasetSha256: sha256(jsonl),
  sources,
}, null, 2)}\n`);

console.log(`Wrote ${rows.length} rows across ${config.cases.length} scenarios to ${outputPath}`);
console.log(`Wrote lineage manifest to ${manifestPath}`);