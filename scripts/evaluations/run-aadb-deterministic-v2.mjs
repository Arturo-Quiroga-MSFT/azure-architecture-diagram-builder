import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const datasetPath = join(root, '.foundry/datasets/aadb-eval-seed-v2.jsonl');
const manifestPath = join(root, '.foundry/datasets/manifest.v2.json');
const outputDir = join(root, '.foundry/results');
const rowsPath = join(outputDir, 'aadb-baseline-v2.rows.jsonl');
const summaryPath = join(outputDir, 'aadb-baseline-v2.json');
const reportPath = join(outputDir, 'aadb-baseline-v2.md');
const reviewDir = join(root, '.foundry/reviews');
const reviewPath = join(reviewDir, 'aadb-v2-review-sample.jsonl');
const reviewStatusPath = join(reviewDir, 'aadb-v2-review-status.json');

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function comparableNames(value) {
  const normalized = normalize(value);
  return new Set([
    normalized,
    normalized.replace(/^microsoft azure /, ''),
    normalized.replace(/^azure /, ''),
    normalized.replace(/^microsoft /, ''),
  ]);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function loadRows(path) {
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

function matchesAlias(node, aliases) {
  const values = [node?.type, node?.name].flatMap(value => [...comparableNames(value)]);
  return aliases.some(alias => {
    const names = [...comparableNames(alias)];
    return values.some(value => names.some(name =>
      value === name || (name.includes(' ') && value.endsWith(` ${name}`))));
  });
}

function connectionMatches(connection, requirement, serviceById) {
  const from = serviceById.get(String(connection.from));
  const to = serviceById.get(String(connection.to));
  return from && to && matchesAlias(from, requirement.from) && matchesAlias(to, requirement.to);
}

function isGenericLabel(label) {
  const value = normalize(label).replace(/[.!?]+$/, '');
  return value.length < 8 || /^(request|response|data|access|connection|connects|sync|async|telemetry|monitoring|logs|events?)$/.test(value);
}

function evaluateRow(row) {
  const architecture = row.architecture ?? {};
  const services = Array.isArray(architecture.services) ? architecture.services : [];
  const connections = Array.isArray(architecture.connections) ? architecture.connections : [];
  const groups = Array.isArray(architecture.groups) ? architecture.groups : [];
  const workflow = Array.isArray(architecture.workflow) ? architecture.workflow : [];
  const requirements = row.requirements ?? {};

  const schemaValid = Array.isArray(architecture.services)
    && Array.isArray(architecture.connections)
    && Array.isArray(architecture.groups)
    && Array.isArray(architecture.workflow)
    && services.every(service => service
      && typeof service.id === 'string'
      && typeof service.name === 'string'
      && typeof service.type === 'string'
      && typeof service.category === 'string');

  const serviceIds = services.map(service => String(service.id));
  const serviceIdSet = new Set(serviceIds);
  const groupIds = groups.map(group => String(group.id));
  const groupIdSet = new Set(groupIds);
  const serviceById = new Map(services.map(service => [String(service.id), service]));
  const duplicateServiceIds = serviceIds.length - serviceIdSet.size;
  const duplicateGroupIds = groupIds.length - groupIdSet.size;
  const serviceGroupCollisions = groupIds.filter(groupId => serviceIdSet.has(groupId));
  const invalidEdges = connections.filter(connection =>
    !serviceIdSet.has(String(connection.from)) || !serviceIdSet.has(String(connection.to)));
  const selfEdges = connections.filter(connection => String(connection.from) === String(connection.to));
  const invalidGroupRefs = services.filter(service =>
    !service.groupId || !groupIdSet.has(String(service.groupId)));

  const connectedIds = new Set();
  for (const connection of connections) {
    if (serviceIdSet.has(String(connection.from))) connectedIds.add(String(connection.from));
    if (serviceIdSet.has(String(connection.to))) connectedIds.add(String(connection.to));
  }
  const orphanServices = services.filter(service => !connectedIds.has(String(service.id)));
  const invalidWorkflowRefs = workflow.flatMap(step =>
    (Array.isArray(step.services) ? step.services : [])
      .filter(serviceId => !serviceIdSet.has(String(serviceId)))
      .map(serviceId => ({ step: step.step, serviceId })));
  const edgeKeys = connections.map(connection =>
    `${connection.from}\u0000${connection.to}\u0000${normalize(connection.label)}\u0000${normalize(connection.type)}`);
  const duplicateEdges = edgeKeys.length - new Set(edgeKeys).size;
  const invalidConnectionTypes = connections.filter(connection =>
    !['sync', 'async', 'optional'].includes(normalize(connection.type || 'sync')));
  const genericLabels = connections.filter(connection => isGenericLabel(connection.label));

  const requiredServiceResults = (requirements.requiredServiceSets ?? []).map(aliases => ({
    aliases,
    matched: services.some(service => matchesAlias(service, aliases)),
  }));
  const requiredServiceRecall = requiredServiceResults.length
    ? requiredServiceResults.filter(result => result.matched).length / requiredServiceResults.length
    : 1;

  const requiredConnectionResults = (requirements.requiredConnections ?? []).map(requirement => ({
    requirement,
    matched: connections.some(connection => connectionMatches(connection, requirement, serviceById)),
  }));
  const requiredConnectionRecall = requiredConnectionResults.length
    ? requiredConnectionResults.filter(result => result.matched).length / requiredConnectionResults.length
    : 1;
  const forbiddenConnections = (requirements.forbiddenConnections ?? []).flatMap(requirement =>
    connections
      .filter(connection => connectionMatches(connection, requirement, serviceById))
      .map(connection => ({ requirement, connection })));

  const connectionTypes = new Set(connections.map(connection => normalize(connection.type || 'sync')));
  const missingRequiredConnectionTypes = (requirements.requiredConnectionTypes ?? [])
    .filter(type => !connectionTypes.has(normalize(type)));

  const monitoringServices = services.filter(service =>
    /monitor|application insights|log analytics/.test(`${normalize(service.name)} ${normalize(service.type)}`));
  const monitoringIds = new Set(monitoringServices.map(service => String(service.id)));
  const monitoringConnections = connections.filter(connection =>
    monitoringIds.has(String(connection.from)) || monitoringIds.has(String(connection.to)));
  const monitoringDensityPass = monitoringConnections.length <= (requirements.maximumMonitoringConnections ?? 3);

  const visualizationAliases = [
    'azure managed grafana', 'power bi embedded', 'power bi report',
    'real-time dashboard', 'azure dashboard', 'azure workbooks',
  ];
  const visualizationPass = !requirements.requiresVisualization
    || services.some(service => matchesAlias(service, visualizationAliases));
  const fabricCorePass = !requirements.requiresFabricCore
    || (
      services.some(service => matchesAlias(service, ['microsoft fabric capacity', 'fabric capacity']))
      && services.some(service => matchesAlias(service, ['onelake']))
    );

  const groupCountPass = groups.length >= (requirements.minimumGroups ?? 0)
    && groups.length <= (requirements.maximumGroups ?? Number.POSITIVE_INFINITY);
  const workflowCountPass = workflow.length >= (requirements.minimumWorkflowSteps ?? 0)
    && workflow.length <= (requirements.maximumWorkflowSteps ?? Number.POSITIVE_INFINITY);
  const serviceCountPass = services.length >= (requirements.minimumServices ?? 0)
    && services.length <= (requirements.maximumServices ?? Number.POSITIVE_INFINITY);
  const connectionCountPass = connections.length >= (requirements.minimumConnections ?? 0)
    && connections.length <= (requirements.maximumConnections ?? Number.POSITIVE_INFINITY);
  const postProcessingIntegrityPass = Number(architecture.integrity?.droppedEdges ?? 0) === 0
    && Number(architecture.integrity?.orphanCount ?? orphanServices.length) === 0;

  const graphChecks = [
    duplicateServiceIds === 0,
    duplicateGroupIds === 0,
    serviceGroupCollisions.length === 0,
    invalidEdges.length === 0,
    selfEdges.length === 0,
    invalidGroupRefs.length === 0,
    orphanServices.length === 0,
    invalidWorkflowRefs.length === 0,
    duplicateEdges === 0,
  ];
  const graphIntegrity = graphChecks.filter(Boolean).length / graphChecks.length;
  const labelsPass = genericLabels.length === 0;
  const connectionTypesPass = invalidConnectionTypes.length === 0
    && missingRequiredConnectionTypes.length === 0;
  const forbiddenPass = forbiddenConnections.length === 0;

  const components = [
    { weight: 8, pass: schemaValid },
    { weight: 20, value: graphIntegrity },
    { weight: 20, value: requiredServiceRecall },
    { weight: 15, value: requiredConnectionRecall },
    { weight: 5, pass: forbiddenPass },
    { weight: 4, pass: connectionTypesPass },
    { weight: 4, pass: labelsPass },
    { weight: 3, pass: groupCountPass },
    { weight: 3, pass: workflowCountPass },
    { weight: 3, pass: serviceCountPass },
    { weight: 3, pass: connectionCountPass },
    { weight: 3, pass: monitoringDensityPass },
    { weight: 3, pass: visualizationPass },
    { weight: 3, pass: fabricCorePass },
    { weight: 3, pass: postProcessingIntegrityPass },
  ];
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const score = round(components.reduce((sum, component) =>
    sum + component.weight * ('value' in component ? component.value : component.pass ? 1 : 0), 0) / totalWeight * 100, 1);

  const passed = schemaValid
    && graphIntegrity === 1
    && requiredServiceRecall === 1
    && requiredConnectionRecall >= 0.75
    && forbiddenPass
    && connectionTypesPass
    && labelsPass
    && groupCountPass
    && workflowCountPass
    && serviceCountPass
    && connectionCountPass
    && monitoringDensityPass
    && visualizationPass
    && fabricCorePass
    && postProcessingIntegrityPass;

  return {
    case_id: row.case_id,
    scenario_id: row.scenario_id,
    dataset_version: row.dataset_version,
    candidate: row.candidate,
    metrics: row.metrics,
    result: {
      passed,
      score,
      schemaValid,
      graphIntegrity: round(graphIntegrity),
      requiredServiceRecall: round(requiredServiceRecall),
      requiredConnectionRecall: round(requiredConnectionRecall),
      forbiddenPass,
      connectionTypesPass,
      labelsPass,
      groupCountPass,
      workflowCountPass,
      serviceCountPass,
      connectionCountPass,
      monitoringDensityPass,
      visualizationPass,
      fabricCorePass,
      postProcessingIntegrityPass,
      counts: {
        services: services.length,
        connections: connections.length,
        groups: groups.length,
        workflowSteps: workflow.length,
        duplicateServiceIds,
        duplicateGroupIds,
        serviceGroupCollisions: serviceGroupCollisions.length,
        duplicateEdges,
        invalidEdges: invalidEdges.length,
        selfEdges: selfEdges.length,
        invalidGroupRefs: invalidGroupRefs.length,
        orphanServices: orphanServices.length,
        invalidWorkflowRefs: invalidWorkflowRefs.length,
        invalidConnectionTypes: invalidConnectionTypes.length,
        genericLabels: genericLabels.length,
        monitoringConnections: monitoringConnections.length,
        forbiddenConnections: forbiddenConnections.length,
        repairedEdges: Number(architecture.integrity?.repairedEdges ?? 0),
        droppedEdges: Number(architecture.integrity?.droppedEdges ?? 0),
      },
      missingServiceSets: requiredServiceResults.filter(result => !result.matched).map(result => result.aliases),
      missingConnections: requiredConnectionResults.filter(result => !result.matched).map(result => result.requirement),
      missingRequiredConnectionTypes,
      forbiddenConnectionDetails: forbiddenConnections,
      genericConnectionLabels: genericLabels.map(connection => connection.label),
      orphanServiceNames: orphanServices.map(service => service.name),
    },
    lineage: row.lineage,
  };
}

function aggregate(results, keySelector) {
  const buckets = new Map();
  for (const result of results) {
    const key = keySelector(result);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(result);
    else buckets.set(key, [result]);
  }
  return [...buckets.entries()].map(([key, values]) => ({
    key,
    candidates: values.length,
    passed: values.filter(value => value.result.passed).length,
    passRate: round(values.filter(value => value.result.passed).length / values.length),
    averageScore: round(average(values.map(value => value.result.score)), 1),
    averageServiceRecall: round(average(values.map(value => value.result.requiredServiceRecall))),
    averageConnectionRecall: round(average(values.map(value => value.result.requiredConnectionRecall))),
    averageLatencyMs: round(average(values.map(value => Number(value.metrics?.elapsedTimeMs ?? value.metrics?.captureElapsedTimeMs ?? 0))), 1),
    averageTokens: round(average(values.map(value => Number(value.metrics?.totalTokens ?? 0))), 1),
  })).sort((left, right) => right.averageScore - left.averageScore || left.key.localeCompare(right.key));
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function failureReasons(item) {
  const reasons = [];
  if (!item.result.schemaValid) reasons.push('schema invalid');
  if (item.result.graphIntegrity < 1) reasons.push('graph integrity');
  if (item.result.requiredServiceRecall < 1) reasons.push('required services');
  if (item.result.requiredConnectionRecall < 0.75) reasons.push('required flows');
  if (!item.result.forbiddenPass) reasons.push('forbidden flow');
  if (!item.result.connectionTypesPass) reasons.push('connection type');
  if (!item.result.labelsPass) reasons.push('generic labels');
  if (!item.result.groupCountPass) reasons.push('group count');
  if (!item.result.workflowCountPass) reasons.push('workflow count');
  if (!item.result.serviceCountPass) reasons.push('service count');
  if (!item.result.connectionCountPass) reasons.push('connection count');
  if (!item.result.monitoringDensityPass) reasons.push('monitoring density');
  if (!item.result.visualizationPass) reasons.push('visualization missing');
  if (!item.result.fabricCorePass) reasons.push('Fabric core missing');
  if (!item.result.postProcessingIntegrityPass) reasons.push('post-processing integrity');
  return reasons;
}

function markdown(summary, results) {
  const lines = [
    '# AADB Deterministic Evaluation Baseline v2',
    '',
    `**Evaluated from capture:** ${summary.evaluatedFromCaptureAt}`,
    `**Dataset:** ${summary.dataset.name} ${summary.dataset.version} (${summary.dataset.rows} rows, ${summary.dataset.scenarios} scenarios)`,
    `**Capture:** ${summary.capture.attempts} attempts; ${summary.capture.successes} successful; ${summary.capture.failures} failed`,
    '',
    '## Overall',
    '',
    `- Strict pass rate: **${pct(summary.overall.passRate)}** (${summary.overall.passed}/${summary.overall.candidates})`,
    `- Average deterministic score: **${summary.overall.averageScore}/100**`,
    `- Average required-service recall: **${pct(summary.overall.averageServiceRecall)}**`,
    `- Average required-flow recall: **${pct(summary.overall.averageConnectionRecall)}**`,
    '',
    '## By model',
    '',
    '| Model | Rows | Pass rate | Avg score | Service recall | Flow recall | Avg latency | Avg tokens |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summary.byModel.map(item =>
      `| ${item.key} | ${item.candidates} | ${pct(item.passRate)} | ${item.averageScore} | ${pct(item.averageServiceRecall)} | ${pct(item.averageConnectionRecall)} | ${Math.round(item.averageLatencyMs)} ms | ${Math.round(item.averageTokens)} |`),
    '',
    '## By scenario',
    '',
    '| Scenario | Rows | Pass rate | Avg score | Service recall | Flow recall |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...summary.byScenario.map(item =>
      `| ${item.key} | ${item.candidates} | ${pct(item.passRate)} | ${item.averageScore} | ${pct(item.averageServiceRecall)} | ${pct(item.averageConnectionRecall)} |`),
    '',
    '## Failed rows',
    '',
  ];
  const failed = results.filter(result => !result.result.passed);
  if (failed.length === 0) lines.push('No deterministic failures.');
  for (const item of failed) {
    lines.push(`- **${item.case_id}** (${item.result.score}/100): ${failureReasons(item).join('; ')}`);
  }
  lines.push(
    '',
    '## Review status',
    '',
    `A blinded ${summary.review.sampleSize}-row architect review queue is available at \`${summary.review.file}\`.`,
    'Remote registration and semantic evaluator v2 remain gated on completed human review.',
    '',
  );
  return lines.join('\n');
}

function createReviewSample(datasetRows, results) {
  const rowById = new Map(datasetRows.map(row => [row.case_id, row]));
  const byScenario = new Map();
  for (const result of results) {
    const values = byScenario.get(result.scenario_id) ?? [];
    values.push(result);
    byScenario.set(result.scenario_id, values);
  }

  const selected = [];
  for (const [scenarioId, values] of [...byScenario.entries()].sort()) {
    const sorted = [...values].sort((left, right) =>
      left.result.score - right.result.score || left.case_id.localeCompare(right.case_id));
    const low = sorted[0];
    const high = [...sorted].reverse().find(item => item.candidate.model !== low.candidate.model) ?? sorted.at(-1);
    selected.push(low, high);
  }

  return selected.map((result, index) => {
    const row = rowById.get(result.case_id);
    const { metrics: _metrics, ...reviewArchitecture } = row.architecture;
    return {
      review_id: `aadb-v2-review-${String(index + 1).padStart(2, '0')}`,
      scenario_id: result.scenario_id,
      query: row.query,
      expected_behavior: row.expected_behavior,
      requirements: row.requirements,
      response: JSON.stringify(reviewArchitecture),
      architecture: reviewArchitecture,
      deterministic: {
        passed: result.result.passed,
        score: result.result.score,
        reasons: failureReasons(result),
        requiredServiceRecall: result.result.requiredServiceRecall,
        requiredConnectionRecall: result.result.requiredConnectionRecall,
      },
      source_case_id_sha256: sha256(row.case_id),
      reviewer: {
        status: 'pending',
        architectureSuitability: null,
        requirementAdherence: null,
        security: null,
        explanationQuality: null,
        notes: null,
      },
    };
  });
}

const datasetRows = loadRows(datasetPath);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const results = datasetRows.map(evaluateRow);
const overall = {
  candidates: results.length,
  passed: results.filter(result => result.result.passed).length,
  passRate: round(results.filter(result => result.result.passed).length / results.length),
  averageScore: round(average(results.map(result => result.result.score)), 1),
  averageServiceRecall: round(average(results.map(result => result.result.requiredServiceRecall))),
  averageConnectionRecall: round(average(results.map(result => result.result.requiredConnectionRecall))),
};
const reviewSample = createReviewSample(datasetRows, results);
const summary = {
  evaluatedFromCaptureAt: manifest.builtFromCaptureAt,
  evaluator: { name: 'aadb-deterministic', version: 'v2' },
  dataset: {
    name: manifest.name,
    version: manifest.version,
    rows: manifest.rowCount,
    scenarios: manifest.scenarioCount,
    sha256: manifest.datasetSha256,
  },
  capture: {
    attempts: manifest.attemptCount,
    successes: manifest.generationSuccessCount,
    failures: manifest.generationFailureCount,
    successRate: manifest.generationSuccessRate,
  },
  overall,
  byModel: aggregate(results, result => result.candidate.model),
  byScenario: aggregate(results, result => result.scenario_id),
  review: {
    status: 'pending-human-review',
    sampleSize: reviewSample.length,
    file: '.foundry/reviews/aadb-v2-review-sample.jsonl',
  },
};

mkdirSync(outputDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });
writeFileSync(rowsPath, `${results.map(result => JSON.stringify(result)).join('\n')}\n`);
writeFileSync(summaryPath, `${JSON.stringify({ summary, rowsFile: '.foundry/results/aadb-baseline-v2.rows.jsonl' }, null, 2)}\n`);
writeFileSync(reportPath, `${markdown(summary, results)}\n`);

const reviewContent = `${reviewSample.map(row => JSON.stringify(row)).join('\n')}\n`;
if (existsSync(reviewPath) && readFileSync(reviewPath, 'utf8') !== reviewContent) {
  const existingReview = loadRows(reviewPath);
  const hasHumanAnnotations = existingReview.some(row =>
    row.reviewer?.status !== 'pending'
    || row.reviewer?.architectureSuitability !== null
    || row.reviewer?.requirementAdherence !== null
    || row.reviewer?.security !== null
    || row.reviewer?.explanationQuality !== null
    || row.reviewer?.notes !== null);
  if (hasHumanAnnotations) {
    throw new Error(`Refusing to overwrite annotated human review queue ${reviewPath}`);
  }
}
writeFileSync(reviewPath, reviewContent);
if (!existsSync(reviewStatusPath)) {
  writeFileSync(reviewStatusPath, `${JSON.stringify({
    datasetName: manifest.name,
    datasetVersion: manifest.version,
    datasetSha256: manifest.datasetSha256,
    reviewFile: '.foundry/reviews/aadb-v2-review-sample.jsonl',
    sampleSize: reviewSample.length,
    status: 'pending-human-review',
    reviewedBy: null,
    reviewedAt: null,
    approvedForFoundryRegistration: false,
    notes: null,
  }, null, 2)}\n`);
}

console.log(JSON.stringify({
  candidates: overall.candidates,
  passed: overall.passed,
  passRate: overall.passRate,
  averageScore: overall.averageScore,
  reviewRows: reviewSample.length,
  reviewStatus: 'pending-human-review',
}, null, 2));
