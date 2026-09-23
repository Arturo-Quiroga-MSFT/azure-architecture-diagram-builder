import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reviewPath = join(root, '.foundry/reviews/aadb-v2-review-sample.jsonl');
const statusPath = join(root, '.foundry/reviews/aadb-v2-review-status.json');
const manifestPath = join(root, '.foundry/datasets/manifest.v2.json');
const metadataPath = join(root, '.foundry/evaluation-metadata.json');
const args = process.argv.slice(2);

function valueArg(name) {
  const prefix = `${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

if (args.includes('--help')) {
  console.log(`Usage: node scripts/evaluations/finalize-aadb-v2-review.mjs \\
  --reviewed-by='<reviewer name or team>' \\
  --decision=approve|reject`);
  process.exit(0);
}

const reviewedBy = valueArg('--reviewed-by');
const decision = valueArg('--decision');
if (!reviewedBy) throw new Error('--reviewed-by is required');
if (!['approve', 'reject'].includes(decision)) {
  throw new Error('--decision must be approve or reject');
}

const rows = readFileSync(reviewPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid review JSONL at line ${index + 1}: ${error.message}`);
    }
  });
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const currentStatus = JSON.parse(readFileSync(statusPath, 'utf8'));

if (rows.length !== 16 || new Set(rows.map(row => row.review_id)).size !== 16) {
  throw new Error('Review file must contain 16 unique review rows');
}
if (new Set(rows.map(row => row.scenario_id)).size !== 8) {
  throw new Error('Review file must contain all eight scenarios');
}
if (currentStatus.datasetSha256 !== manifest.datasetSha256) {
  throw new Error('Review status dataset hash does not match manifest.v2.json');
}

const dimensions = [
  'architectureSuitability',
  'requirementAdherence',
  'security',
  'explanationQuality',
];
const incompleteRows = rows.flatMap(row => {
  const missing = [];
  if (row.reviewer?.status !== 'reviewed') missing.push('status');
  for (const dimension of dimensions) {
    const rating = row.reviewer?.[dimension];
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) missing.push(dimension);
  }
  return missing.length ? [{ reviewId: row.review_id, missing }] : [];
});
if (incompleteRows.length > 0) {
  const reviewedCount = rows.length - incompleteRows.length;
  const pendingIds = incompleteRows.map(item => item.reviewId).join(', ');
  throw new Error(
    `Human review is incomplete: ${reviewedCount}/${rows.length} rows reviewed. `
    + `Pending: ${pendingIds}. --decision=${decision} finalizes completed ratings; it does not create ratings. `
    + 'Run `npm run eval:aadb:v2:review:interactive` to review rows, or '
    + '`npm run eval:aadb:v2:review:status` to check progress.',
  );
}

function average(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

const dimensionAverages = Object.fromEntries(
  dimensions.map(dimension => [dimension, average(rows.map(row => row.reviewer[dimension]))]),
);
const overallAverage = average(rows.flatMap(row =>
  dimensions.map(dimension => row.reviewer[dimension])));
const deterministicDisagreements = rows.filter(row => {
  const humanAverage = average(dimensions.map(dimension => row.reviewer[dimension]));
  return (row.deterministic.passed && humanAverage < 3.5)
    || (!row.deterministic.passed && humanAverage >= 4);
}).map(row => row.review_id);
const reviewSha256 = createHash('sha256').update(readFileSync(reviewPath)).digest('hex');

const status = {
  ...currentStatus,
  status: decision === 'approve' ? 'approved' : 'rejected',
  reviewedBy,
  reviewedAt: new Date().toISOString(),
  approvedForFoundryRegistration: decision === 'approve',
  decision,
  reviewSha256,
  dimensionAverages,
  overallAverage,
  deterministicDisagreements,
  notes: currentStatus.notes,
};
writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
const evaluationMetadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const pendingV2 = evaluationMetadata.pendingDatasets?.find(item => item.version === 'v2');
if (!pendingV2) throw new Error('evaluation-metadata.json has no pending v2 dataset entry');
pendingV2.status = decision === 'approve' ? 'approved-human-review' : 'rejected-human-review';
pendingV2.approvedForFoundryRegistration = decision === 'approve';
pendingV2.reviewedBy = reviewedBy;
pendingV2.reviewedAt = status.reviewedAt;
writeFileSync(metadataPath, `${JSON.stringify(evaluationMetadata, null, 2)}\n`);

execFileSync(
  process.execPath,
  [join(root, 'scripts/evaluations/build-aadb-model-scorecard-v2.mjs')],
  { cwd: root, stdio: 'inherit' },
);
console.log(JSON.stringify(status, null, 2));
