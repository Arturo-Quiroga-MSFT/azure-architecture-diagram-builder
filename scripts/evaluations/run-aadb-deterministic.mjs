import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const datasetPath = join(root, '.foundry/datasets/aadb-eval-seed-v1.jsonl');
const outputDir = join(root, '.foundry/results');
const rowsPath = join(outputDir, 'aadb-baseline-v1.rows.jsonl');
const summaryPath = join(outputDir, 'aadb-baseline-v1.json');
const reportPath = join(outputDir, 'aadb-baseline-v1.md');

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function loadRows(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

function matchesAlias(node, aliases) {
  const values = new Set([normalize(node?.type), normalize(node?.name)]);
  return aliases.some(alias => values.has(normalize(alias)));
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
    && services.every(service => service && typeof service.id === 'string' && typeof service.name === 'string');

  const serviceIds = services.map(service => String(service.id));
  const serviceIdSet = new Set(serviceIds);
  const duplicateServiceIds = serviceIds.length - serviceIdSet.size;
  const groupIds = groups.map(group => String(group.id));
  const groupIdSet = new Set(groupIds);
  const duplicateGroupIds = groupIds.length - groupIdSet.size;
  const serviceById = new Map(services.map(service => [String(service.id), service]));

  const invalidEdges = connections.filter(connection =>
    !serviceIdSet.has(String(connection.from)) || !serviceIdSet.has(String(connection.to)));
  const selfEdges = connections.filter(connection => String(connection.from) === String(connection.to));
  const invalidGroupRefs = services.filter(service => !service.groupId || !groupIdSet.has(String(service.groupId)));
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

  const edgeKeys = connections.map(connection => `${connection.from}\u0000${connection.to}\u0000${normalize(connection.label)}`);
  const duplicateEdges = edgeKeys.length - new Set(edgeKeys).size;

  const requiredServiceResults = (requirements.requiredServiceSets ?? []).map(aliases => ({
    aliases,
    matched: services.some(service => matchesAlias(service, aliases)),
  }));
  const requiredServiceRecall = requiredServiceResults.length
    ? requiredServiceResults.filter(result => result.matched).length / requiredServiceResults.length
    : 1;

  function connectionMatches(connection, requirement) {
    const from = serviceById.get(String(connection.from));
    const to = serviceById.get(String(connection.to));
    return from && to && matchesAlias(from, requirement.from) && matchesAlias(to, requirement.to);
  }

  const requiredConnectionResults = (requirements.requiredConnections ?? []).map(requirement => ({
    requirement,
    matched: connections.some(connection => connectionMatches(connection, requirement)),
  }));
  const requiredConnectionRecall = requiredConnectionResults.length
    ? requiredConnectionResults.filter(result => result.matched).length / requiredConnectionResults.length
    : 1;
  const forbiddenConnections = (requirements.forbiddenConnections ?? []).flatMap(requirement =>
    connections
      .filter(connection => connectionMatches(connection, requirement))
      .map(connection => ({ requirement, connection })));

  const groupCountPass = groups.length >= (requirements.minimumGroups ?? 0);
  const workflowCountPass = workflow.length >= (requirements.minimumWorkflowSteps ?? 0);
  const graphIntegrityChecks = [
    duplicateServiceIds === 0,
    duplicateGroupIds === 0,
    invalidEdges.length === 0,
    selfEdges.length === 0,
    invalidGroupRefs.length === 0,
    orphanServices.length === 0,
    invalidWorkflowRefs.length === 0,
  ];
  const graphIntegrity = graphIntegrityChecks.filter(Boolean).length / graphIntegrityChecks.length;

  const score = round(
    (schemaValid ? 10 : 0)
    + graphIntegrity * 30
    + requiredServiceRecall * 25
    + requiredConnectionRecall * 20
    + (forbiddenConnections.length === 0 ? 5 : 0)
    + (groupCountPass ? 5 : 0)
    + (workflowCountPass ? 5 : 0),
    1,
  );
  const passed = schemaValid
    && graphIntegrity === 1
    && requiredServiceRecall === 1
    && requiredConnectionRecall >= 0.75
    && forbiddenConnections.length === 0
    && groupCountPass
    && workflowCountPass;

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
      groupCountPass,
      workflowCountPass,
      counts: {
        services: services.length,
        connections: connections.length,
        groups: groups.length,
        workflowSteps: workflow.length,
        duplicateServiceIds,
        duplicateGroupIds,
        duplicateEdges,
        invalidEdges: invalidEdges.length,
        selfEdges: selfEdges.length,
        invalidGroupRefs: invalidGroupRefs.length,
        orphanServices: orphanServices.length,
        invalidWorkflowRefs: invalidWorkflowRefs.length,
        forbiddenConnections: forbiddenConnections.length,
      },
      missingServiceSets: requiredServiceResults.filter(result => !result.matched).map(result => result.aliases),
      missingConnections: requiredConnectionResults.filter(result => !result.matched).map(result => result.requirement),
      forbiddenConnectionDetails: forbiddenConnections,
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
    passRate: round(values.filter(value => value.result.passed).length / values.length),
    averageScore: round(average(values.map(value => value.result.score)), 1),
    averageServiceRecall: round(average(values.map(value => value.result.requiredServiceRecall))),
    averageConnectionRecall: round(average(values.map(value => value.result.requiredConnectionRecall))),
    averageLatencyMs: round(average(values.map(value => Number(value.metrics?.elapsedTimeMs ?? 0))), 1),
    averageTokens: round(average(values.map(value => Number(value.metrics?.totalTokens ?? 0))), 1),
  })).sort((left, right) => right.averageScore - left.averageScore || left.key.localeCompare(right.key));
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function markdown(summary, results) {
  const lines = [
    '# AADB Deterministic Evaluation Baseline v1',
    '',
    `**Generated:** ${summary.generatedAt}`,
    `**Dataset:** ${summary.dataset.name} ${summary.dataset.version} (${summary.dataset.rows} candidate rows, ${summary.dataset.scenarios} scenarios)`,
    '',
    '## Overall',
    '',
    `- Pass rate: **${pct(summary.overall.passRate)}** (${summary.overall.passed}/${summary.overall.candidates})`,
    `- Average deterministic score: **${summary.overall.averageScore}/100**`,
    `- Average required-service recall: **${pct(summary.overall.averageServiceRecall)}**`,
    `- Average required-connection recall: **${pct(summary.overall.averageConnectionRecall)}**`,
    '',
    '## By model',
    '',
    '| Model | Candidates | Pass rate | Avg score | Service recall | Connection recall | Avg latency | Avg tokens |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...summary.byModel.map(item =>
      `| ${item.key} | ${item.candidates} | ${pct(item.passRate)} | ${item.averageScore} | ${pct(item.averageServiceRecall)} | ${pct(item.averageConnectionRecall)} | ${Math.round(item.averageLatencyMs)} ms | ${Math.round(item.averageTokens)} |`),
    '',
    '## By scenario',
    '',
    '| Scenario | Candidates | Pass rate | Avg score | Service recall | Connection recall |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...summary.byScenario.map(item =>
      `| ${item.key} | ${item.candidates} | ${pct(item.passRate)} | ${item.averageScore} | ${pct(item.averageServiceRecall)} | ${pct(item.averageConnectionRecall)} |`),
    '',
    '## Failed candidates',
    '',
  ];

  const failed = results.filter(result => !result.result.passed);
  if (failed.length === 0) lines.push('No deterministic failures.');
  for (const item of failed) {
    const reasons = [];
    if (!item.result.schemaValid) reasons.push('schema invalid');
    if (item.result.counts.orphanServices) reasons.push(`${item.result.counts.orphanServices} orphan service(s)`);
    if (item.result.counts.invalidEdges) reasons.push(`${item.result.counts.invalidEdges} invalid edge(s)`);
    if (item.result.counts.invalidGroupRefs) reasons.push(`${item.result.counts.invalidGroupRefs} invalid group reference(s)`);
    if (item.result.counts.invalidWorkflowRefs) reasons.push(`${item.result.counts.invalidWorkflowRefs} invalid workflow reference(s)`);
    if (item.result.missingServiceSets.length) reasons.push(`${item.result.missingServiceSets.length} required service set(s) missing`);
    if (item.result.missingConnections.length) reasons.push(`${item.result.missingConnections.length} required connection(s) missing`);
    if (item.result.counts.forbiddenConnections) reasons.push(`${item.result.counts.forbiddenConnections} forbidden connection(s)`);
    if (!item.result.groupCountPass) reasons.push('too few groups');
    if (!item.result.workflowCountPass) reasons.push('too few workflow steps');
    lines.push(`- **${item.case_id}** (${item.result.score}/100): ${reasons.join('; ')}`);
  }

  lines.push(
    '',
    '## Interpretation',
    '',
    'This baseline measures deterministic structure and requirement coverage only. It does not yet measure architecture suitability, semantic explanation quality, safety, or groundedness. Those dimensions are reserved for calibrated Foundry built-in and custom evaluators in the next step.',
    '',
  );
  return lines.join('\n');
}

const datasetRows = loadRows(datasetPath);
const results = datasetRows.map(evaluateRow);
const manifest = JSON.parse(readFileSync(join(root, '.foundry/datasets/manifest.json'), 'utf8'));
const overall = {
  candidates: results.length,
  passed: results.filter(result => result.result.passed).length,
  passRate: round(results.filter(result => result.result.passed).length / results.length),
  averageScore: round(average(results.map(result => result.result.score)), 1),
  averageServiceRecall: round(average(results.map(result => result.result.requiredServiceRecall))),
  averageConnectionRecall: round(average(results.map(result => result.result.requiredConnectionRecall))),
};
const summary = {
  generatedAt: new Date().toISOString(),
  evaluator: { name: 'aadb-deterministic', version: 'v1' },
  dataset: {
    name: manifest.name,
    version: manifest.version,
    rows: manifest.rowCount,
    scenarios: manifest.scenarioCount,
    sha256: manifest.datasetSha256,
  },
  overall,
  byModel: aggregate(results, result => result.candidate.model),
  byScenario: aggregate(results, result => result.scenario_id),
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(rowsPath, `${results.map(result => JSON.stringify(result)).join('\n')}\n`);
writeFileSync(summaryPath, `${JSON.stringify({ summary, rowsFile: '.foundry/results/aadb-baseline-v1.rows.jsonl' }, null, 2)}\n`);
writeFileSync(reportPath, `${markdown(summary, results)}\n`);

console.log(`Evaluated ${results.length} candidates: ${overall.passed} passed (${pct(overall.passRate)}).`);
console.log(`Average score: ${overall.averageScore}/100.`);
console.log(`Wrote ${rowsPath}`);
console.log(`Wrote ${summaryPath}`);
console.log(`Wrote ${reportPath}`);