import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);

function valueArg(name, fallback = '') {
  const prefix = `${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : fallback;
}

const reviewPath = resolve(root, valueArg(
  '--review-file',
  '.foundry/reviews/aadb-v2-review-sample.jsonl',
));
const statusOnly = args.includes('--status');

if (args.includes('--help')) {
  console.log(`Usage:
  npm run eval:aadb:v2:review:status
  npm run eval:aadb:v2:review:interactive

Options:
  --status                 Show completion status and exit
  --review-file=<path>     Override the review JSONL path
  --help                   Show this help

Interactive commands at a rating prompt:
  q                        Save completed rows and quit
  s                        Skip the current row`);
  process.exit(0);
}

function loadRows() {
  return readFileSync(reviewPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid review JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

function saveRows(rows) {
  const temporaryPath = `${reviewPath}.tmp`;
  writeFileSync(temporaryPath, `${rows.map(row => JSON.stringify(row)).join('\n')}\n`);
  renameSync(temporaryPath, reviewPath);
}

function reviewComplete(row) {
  const dimensions = [
    row.reviewer?.architectureSuitability,
    row.reviewer?.requirementAdherence,
    row.reviewer?.security,
    row.reviewer?.explanationQuality,
  ];
  return row.reviewer?.status === 'reviewed'
    && dimensions.every(rating => Number.isInteger(rating) && rating >= 1 && rating <= 5);
}

function status(rows) {
  const reviewed = rows.filter(reviewComplete);
  const pending = rows.filter(row => !reviewComplete(row));
  const scenarioStatus = [...new Set(rows.map(row => row.scenario_id))]
    .sort()
    .map(scenarioId => {
      const scenarioRows = rows.filter(row => row.scenario_id === scenarioId);
      return {
        scenario: scenarioId,
        reviewed: scenarioRows.filter(reviewComplete).length,
        total: scenarioRows.length,
      };
    });
  return {
    reviewFile: reviewPath,
    reviewed: reviewed.length,
    pending: pending.length,
    total: rows.length,
    nextPending: pending[0]?.review_id ?? null,
    pendingIds: pending.map(row => row.review_id),
    scenarios: scenarioStatus,
    readyToFinalize: pending.length === 0,
  };
}

function printStatus(rows) {
  const report = status(rows);
  console.log(`AADB v2 human review: ${report.reviewed}/${report.total} complete (${report.pending} pending)`);
  for (const scenario of report.scenarios) {
    console.log(`  ${scenario.scenario}: ${scenario.reviewed}/${scenario.total}`);
  }
  if (report.readyToFinalize) {
    console.log('\nReady to finalize:');
    console.log("  npm run eval:aadb:v2:review -- --reviewed-by='<name or team>' --decision=approve");
  } else {
    console.log(`\nNext pending row: ${report.nextPending}`);
    console.log('Continue the blinded review:');
    console.log('  npm run eval:aadb:v2:review:interactive');
  }
  return report;
}

function formatServices(architecture) {
  const groupById = new Map((architecture.groups ?? []).map(group => [group.id, group.label]));
  return (architecture.services ?? []).map(service => {
    const group = groupById.get(service.groupId) ?? 'Ungrouped';
    return `  - ${service.name} [${group}]: ${service.description ?? 'No description'}`;
  }).join('\n');
}

function formatConnections(architecture) {
  const serviceById = new Map((architecture.services ?? []).map(service => [service.id, service.name]));
  return (architecture.connections ?? []).map(connection => {
    const from = serviceById.get(connection.from) ?? connection.from;
    const to = serviceById.get(connection.to) ?? connection.to;
    return `  - ${from} -> ${to} [${connection.type ?? 'sync'}]: ${connection.label}`;
  }).join('\n');
}

function formatWorkflow(architecture) {
  return (architecture.workflow ?? []).map(step =>
    `  ${step.step}. ${step.description}`).join('\n');
}

function printRow(row, index, total) {
  console.log('\n' + '='.repeat(88));
  console.log(`REVIEW ${index + 1}/${total}: ${row.review_id}`);
  console.log(`Scenario: ${row.scenario_id}`);
  console.log('='.repeat(88));
  console.log(`\nPROMPT\n${row.query}`);
  console.log(`\nEXPECTED BEHAVIOR\n${row.expected_behavior}`);
  console.log(`\nSERVICES (${row.architecture.services?.length ?? 0})\n${formatServices(row.architecture)}`);
  console.log(`\nCONNECTIONS (${row.architecture.connections?.length ?? 0})\n${formatConnections(row.architecture)}`);
  console.log(`\nWORKFLOW (${row.architecture.workflow?.length ?? 0})\n${formatWorkflow(row.architecture)}`);
  console.log('\nDETERMINISTIC EVIDENCE');
  console.log(`  Passed: ${row.deterministic.passed}`);
  console.log(`  Score: ${row.deterministic.score}/100`);
  console.log(`  Service recall: ${Math.round(row.deterministic.requiredServiceRecall * 100)}%`);
  console.log(`  Flow recall: ${Math.round(row.deterministic.requiredConnectionRecall * 100)}%`);
  console.log(`  Flags: ${row.deterministic.reasons.length ? row.deterministic.reasons.join(', ') : 'none'}`);
  console.log('\nRate independently. 1=unusable, 3=viable with material gaps, 5=reference quality.');
}

async function askRating(reader, label) {
  while (true) {
    const answer = (await reader.question(`${label} [1-5, s=skip, q=quit]: `)).trim().toLowerCase();
    if (answer === 'q') return { command: 'quit' };
    if (answer === 's') return { command: 'skip' };
    const rating = Number.parseInt(answer, 10);
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      return { rating };
    }
    console.log('Enter an integer from 1 to 5, s to skip, or q to save and quit.');
  }
}

async function reviewRow(reader, row) {
  const ratings = {};
  const questions = [
    ['architectureSuitability', 'Architecture suitability'],
    ['requirementAdherence', 'Requirement adherence'],
    ['security', 'Security'],
    ['explanationQuality', 'Explanation quality'],
  ];
  for (const [field, label] of questions) {
    const answer = await askRating(reader, label);
    if (answer.command) return answer.command;
    ratings[field] = answer.rating;
  }
  const notes = (await reader.question('Reviewer notes (optional): ')).trim();
  console.log('\nRatings:');
  for (const [field, label] of questions) console.log(`  ${label}: ${ratings[field]}`);
  console.log(`  Notes: ${notes || '(none)'}`);
  const confirmation = (await reader.question('Save this row? [y/n/q]: ')).trim().toLowerCase();
  if (confirmation === 'q') return 'quit';
  if (confirmation !== 'y' && confirmation !== 'yes') return 'skip';
  row.reviewer = {
    status: 'reviewed',
    ...ratings,
    notes: notes || null,
  };
  return 'saved';
}

const rows = loadRows();
if (rows.length !== 16) throw new Error(`Expected 16 review rows, found ${rows.length}`);
if (statusOnly) {
  printStatus(rows);
  process.exit(0);
}
if (!input.isTTY || !output.isTTY) {
  throw new Error(
    'Interactive review requires a terminal. Run npm run eval:aadb:v2:review:status for non-interactive status.',
  );
}

const reader = createInterface({ input, output });
try {
  console.log('AADB v2 blinded architect review');
  console.log('Model identity is intentionally hidden. Completed rows are saved after each confirmation.');
  printStatus(rows);

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (reviewComplete(row)) continue;
    printRow(row, index, rows.length);
    const result = await reviewRow(reader, row);
    if (result === 'saved') {
      saveRows(rows);
      console.log(`Saved ${row.review_id}.`);
    } else if (result === 'quit') {
      console.log('Review paused. Previously completed rows remain saved.');
      break;
    } else {
      console.log(`Skipped ${row.review_id}.`);
    }
  }
} finally {
  reader.close();
}

console.log('');
printStatus(rows);
