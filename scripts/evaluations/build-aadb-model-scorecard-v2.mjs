import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = join(root, '.foundry/results');
const jsonPath = join(outputDir, 'aadb-model-scorecard-v2.json');
const markdownPath = join(outputDir, 'aadb-model-scorecard-v2.md');

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function readJsonLines(path) {
  return readFileSync(join(root, path), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse);
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function average(values) {
  return values.length
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3))
    : null;
}

function percentile(values, percentileValue) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function round(value, digits = 3) {
  return value === null ? null : Number(Number(value).toFixed(digits));
}

function groupBy(rows, keySelector) {
  const groups = new Map();
  for (const row of rows) {
    const key = keySelector(row);
    const values = groups.get(key) ?? [];
    values.push(row);
    groups.set(key, values);
  }
  return groups;
}

function summarizeRows(rows) {
  const latencies = rows.map(row => Number(row.metrics?.elapsedTimeMs ?? row.metrics?.captureElapsedTimeMs ?? 0));
  const promptTokens = rows.map(row => Number(row.metrics?.promptTokens ?? 0));
  const completionTokens = rows.map(row => Number(row.metrics?.completionTokens ?? 0));
  const totalTokens = rows.map(row => Number(row.metrics?.totalTokens ?? 0));
  return {
    rows: rows.length,
    strictPassed: rows.filter(row => row.result.passed).length,
    strictPassRate: round(rows.filter(row => row.result.passed).length / rows.length),
    averageDeterministicScore: round(average(rows.map(row => row.result.score)), 1),
    averageRequiredServiceRecall: round(average(rows.map(row => row.result.requiredServiceRecall))),
    averageRequiredFlowRecall: round(average(rows.map(row => row.result.requiredConnectionRecall))),
    latencyMs: {
      average: round(average(latencies), 1),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    tokens: {
      averagePrompt: round(average(promptTokens), 1),
      averageCompletion: round(average(completionTokens), 1),
      averageTotal: round(average(totalTokens), 1),
      total: totalTokens.reduce((sum, value) => sum + value, 0),
    },
    postProcessing: {
      repairedEdges: rows.reduce((sum, row) => sum + Number(row.result.counts.repairedEdges ?? 0), 0),
      droppedEdges: rows.reduce((sum, row) => sum + Number(row.result.counts.droppedEdges ?? 0), 0),
      orphanServices: rows.reduce((sum, row) => sum + Number(row.result.counts.orphanServices ?? 0), 0),
      invalidWorkflowReferences: rows.reduce((sum, row) => sum + Number(row.result.counts.invalidWorkflowRefs ?? 0), 0),
    },
  };
}

function compareQuality(left, right) {
  return right.strictPassRate - left.strictPassRate
    || right.averageDeterministicScore - left.averageDeterministicScore
    || right.averageRequiredFlowRecall - left.averageRequiredFlowRecall
    || left.latencyMs.p50 - right.latencyMs.p50;
}

function paretoFrontier(models) {
  return models.filter(candidate => !models.some(other => {
    if (candidate.model === other.model) return false;
    const noWorse = other.strictPassRate >= candidate.strictPassRate
      && other.averageDeterministicScore >= candidate.averageDeterministicScore
      && other.latencyMs.p50 <= candidate.latencyMs.p50
      && other.tokens.averageTotal <= candidate.tokens.averageTotal;
    const strictlyBetter = other.strictPassRate > candidate.strictPassRate
      || other.averageDeterministicScore > candidate.averageDeterministicScore
      || other.latencyMs.p50 < candidate.latencyMs.p50
      || other.tokens.averageTotal < candidate.tokens.averageTotal;
    return noWorse && strictlyBetter;
  })).map(item => item.model);
}

function reviewScoresByCase(reviewRows, reviewStatus, datasetRows) {
  if (reviewStatus.status !== 'approved' && reviewStatus.status !== 'rejected') {
    return { available: false, status: reviewStatus.status, rows: new Map() };
  }
  const datasetByHash = new Map(datasetRows.map(row => [sha256(row.case_id), row]));
  const joined = new Map();
  for (const review of reviewRows) {
    const datasetRow = datasetByHash.get(review.source_case_id_sha256);
    if (!datasetRow) throw new Error(`Unable to rejoin review row ${review.review_id}`);
    const dimensions = [
      review.reviewer.architectureSuitability,
      review.reviewer.requirementAdherence,
      review.reviewer.security,
      review.reviewer.explanationQuality,
    ];
    if (review.reviewer.status !== 'reviewed' || dimensions.some(value => !Number.isInteger(value))) {
      throw new Error(`Review row ${review.review_id} is incomplete after finalization`);
    }
    joined.set(datasetRow.case_id, {
      reviewId: review.review_id,
      model: datasetRow.candidate.model,
      humanAverage: average(dimensions),
      architectureSuitability: dimensions[0],
      requirementAdherence: dimensions[1],
      security: dimensions[2],
      explanationQuality: dimensions[3],
      notes: review.reviewer.notes,
    });
  }
  return { available: true, status: reviewStatus.status, rows: joined };
}

const attempts = readJsonLines('.foundry/captures/aadb-v2-attempts.jsonl');
const datasetRows = readJsonLines('.foundry/datasets/aadb-eval-seed-v2.jsonl');
const deterministicRows = readJsonLines('.foundry/results/aadb-baseline-v2.rows.jsonl');
const manifest = readJson('.foundry/datasets/manifest.v2.json');
const reviewRows = readJsonLines('.foundry/reviews/aadb-v2-review-sample.jsonl');
const reviewStatus = readJson('.foundry/reviews/aadb-v2-review-status.json');
const reviewJoin = reviewScoresByCase(reviewRows, reviewStatus, datasetRows);
const datasetByCase = new Map(datasetRows.map(row => [row.case_id, row]));

const attemptsByModel = groupBy(attempts, row => row.model.id);
const resultsByModel = groupBy(deterministicRows, row => row.candidate.model);
const models = [...resultsByModel.entries()].map(([model, rows]) => {
  const attemptRows = attemptsByModel.get(model) ?? [];
  const firstDatasetRow = datasetByCase.get(rows[0].case_id);
  const humanRows = rows
    .map(row => reviewJoin.rows.get(row.case_id))
    .filter(Boolean);
  return {
    model,
    displayName: firstDatasetRow.candidate.displayName,
    role: firstDatasetRow.candidate.modelRole,
    deployment: firstDatasetRow.candidate.deployment,
    apiFormat: firstDatasetRow.candidate.apiFormat,
    reasoningEffort: firstDatasetRow.candidate.reasoningEffort,
    attempts: attemptRows.length,
    generationSuccesses: attemptRows.filter(row => row.status === 'success').length,
    generationFailures: attemptRows.filter(row => row.status !== 'success').length,
    generationSuccessRate: round(attemptRows.filter(row => row.status === 'success').length / attemptRows.length),
    ...summarizeRows(rows),
    humanReview: reviewJoin.available ? {
      status: reviewJoin.status,
      sampleSize: humanRows.length,
      averageOverall: round(average(humanRows.map(row => row.humanAverage))),
      averageArchitectureSuitability: round(average(humanRows.map(row => row.architectureSuitability))),
      averageRequirementAdherence: round(average(humanRows.map(row => row.requirementAdherence))),
      averageSecurity: round(average(humanRows.map(row => row.security))),
      averageExplanationQuality: round(average(humanRows.map(row => row.explanationQuality))),
    } : {
      status: reviewJoin.status,
      sampleSize: 0,
      averageOverall: null,
      averageArchitectureSuitability: null,
      averageRequirementAdherence: null,
      averageSecurity: null,
      averageExplanationQuality: null,
    },
  };
}).sort(compareQuality);

const scenarioRows = [...groupBy(deterministicRows, row => row.scenario_id).entries()]
  .map(([scenario, rows]) => {
    const context = JSON.parse(datasetByCase.get(rows[0].case_id).context);
    const source = datasetByCase.get(rows[0].case_id).lineage.scenarioSource;
    const modelResults = [...groupBy(rows, row => row.candidate.model).entries()]
      .map(([model, modelRows]) => ({ model, ...summarizeRows(modelRows) }))
      .sort(compareQuality);
    return {
      scenario,
      promptStyle: context.prompt_style,
      source,
      leader: modelResults[0].model,
      provisional: true,
      models: modelResults,
    };
  })
  .sort((left, right) => left.scenario.localeCompare(right.scenario));

const promptStyleRows = [...groupBy(deterministicRows, row =>
  JSON.parse(datasetByCase.get(row.case_id).context).prompt_style).entries()]
  .map(([promptStyle, rows]) => {
    const modelResults = [...groupBy(rows, row => row.candidate.model).entries()]
      .map(([model, modelRows]) => ({ model, ...summarizeRows(modelRows) }))
      .sort(compareQuality);
    return {
      promptStyle,
      leader: modelResults[0].model,
      provisional: true,
      models: modelResults,
    };
  })
  .sort((left, right) => left.promptStyle.localeCompare(right.promptStyle));

const humanReviewedModels = models
  .filter(model => model.humanReview.averageOverall !== null)
  .sort((left, right) =>
    right.humanReview.averageOverall - left.humanReview.averageOverall
    || right.humanReview.sampleSize - left.humanReview.sampleSize
    || compareQuality(left, right));

const scorecard = {
  schemaVersion: '1.0.0',
  generatedFrom: {
    datasetName: manifest.name,
    datasetVersion: manifest.version,
    datasetSha256: manifest.datasetSha256,
    feature: 'topology-generation',
    appCommit: manifest.appCommit,
    topologyContractSha256: manifest.topologyContractSha256,
  },
  evidenceStatus: {
    deterministic: 'available',
    humanReview: reviewStatus.status,
    semanticEvaluation: 'not-run',
    cost: {
      status: 'not-computed',
      reason: 'No versioned per-model input/output token pricing source is present in this evaluation package.',
    },
    recommendationsProvisional: true,
  },
  models,
  leaders: {
    deterministicQuality: models[0].model,
    humanQualitySampled: humanReviewedModels[0]?.model ?? null,
    speedP50: [...models].sort((left, right) => left.latencyMs.p50 - right.latencyMs.p50)[0].model,
    tokenEfficiency: [...models].sort((left, right) => left.tokens.averageTotal - right.tokens.averageTotal)[0].model,
    paretoFrontier: paretoFrontier(models),
  },
  byScenario: scenarioRows,
  byPromptStyle: promptStyleRows,
  interpretation: [
    'Model identity is retained in canonical evidence and removed only from blinded human-review rows.',
    'Leaders are provisional until human review and semantic evaluator v2 are complete.',
    'No single composite score is used; quality, latency, tokens, reliability, and human ratings remain separate.',
    'Generation success rates describe only this pinned capture matrix.',
  ],
};

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

const lines = [
  '# AADB Model Specialization Scorecard v2',
  '',
  `**Feature:** Topology generation`,
  `**Dataset:** ${manifest.name} ${manifest.version}`,
  `**Dataset SHA-256:** \`${manifest.datasetSha256}\``,
  `**Human review:** ${reviewStatus.status}`,
  `**Recommendations:** ${scorecard.evidenceStatus.recommendationsProvisional ? 'Provisional' : 'Human-calibrated'}`,
  '',
  '## Model Scorecard',
  '',
  '| Model | Attempts | Success | Strict pass | Avg score | Service recall | Flow recall | P50 latency | P95 latency | Avg tokens | Human score |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...models.map(model => `| ${model.displayName} | ${model.attempts} | ${pct(model.generationSuccessRate)} | ${pct(model.strictPassRate)} | ${model.averageDeterministicScore} | ${pct(model.averageRequiredServiceRecall)} | ${pct(model.averageRequiredFlowRecall)} | ${(model.latencyMs.p50 / 1000).toFixed(1)}s | ${(model.latencyMs.p95 / 1000).toFixed(1)}s | ${Math.round(model.tokens.averageTotal)} | ${model.humanReview.averageOverall ?? 'pending'} |`),
  '',
  '## Current Leaders',
  '',
  `- Deterministic quality: **${scorecard.leaders.deterministicQuality}**`,
  `- Sampled human quality: **${scorecard.leaders.humanQualitySampled ?? 'pending'}**`,
  `- P50 latency: **${scorecard.leaders.speedP50}**`,
  `- Token efficiency: **${scorecard.leaders.tokenEfficiency}**`,
  `- Pareto frontier: **${scorecard.leaders.paretoFrontier.join(', ')}**`,
  '',
  'These leaders are provisional until blinded human review and semantic evaluator v2 are complete.',
  '',
  '## Scenario Leaders',
  '',
  '| Scenario | Provisional leader |',
  '| --- | --- |',
  ...scenarioRows.map(item => `| ${item.scenario} | ${item.leader} |`),
  '',
  '## Prompt-Style Leaders',
  '',
  '| Prompt style | Provisional leader |',
  '| --- | --- |',
  ...promptStyleRows.map(item => `| ${item.promptStyle} | ${item.leader} |`),
  '',
  '## Evidence Boundaries',
  '',
  '- Model identity is retained in canonical capture, dataset, and deterministic results.',
  '- Human-review rows remain blinded; final ratings are rejoined through a SHA-256 case reference.',
  '- Cost is not computed because this evaluation package has no dated, versioned model-pricing source.',
  '- User selections and critique winners should be tracked as preference signals, not architecture correctness labels.',
  '- Aggregate v1 and v2 scores are not directly comparable because their prompts and evaluator contracts differ.',
  '',
];

mkdirSync(outputDir, { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(scorecard, null, 2)}\n`);
writeFileSync(markdownPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({
  jsonFile: '.foundry/results/aadb-model-scorecard-v2.json',
  markdownFile: '.foundry/results/aadb-model-scorecard-v2.md',
  models: models.length,
  humanReview: reviewStatus.status,
  leaders: scorecard.leaders,
}, null, 2));
