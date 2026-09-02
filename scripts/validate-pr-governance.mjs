import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIELD_VALUES = {
  'Change type': ['bug', 'feature', 'refactor', 'docs', 'operations', 'governance'],
  'Risk class': ['R0', 'R1', 'R2', 'R3', 'R4'],
  Lifecycle: ['direct', 'plan', 'full-rpi', 'spec-kit-plus-rpi'],
  'Independent review': ['not-required', 'required-pending', 'complete', 'exception'],
  'External gate': ['not-applicable', 'pending', 'approved'],
  'Merge approval': ['pending', 'approved'],
  'Production deployment': ['not-requested', 'pending', 'approved'],
  'Review readiness': ['not-ready', 'ready'],
  'Readiness acknowledgment': ['pending', 'acknowledged'],
};

const READINESS_SECTIONS = [
  'Review Readiness Brief',
  'Blockers / Critical Findings',
  'Unexpected Discoveries',
  'Plan Deviations',
  'Limitations / Not Tested',
  'Decision Requested',
];

const REQUIRED_SECTIONS = [
  ...READINESS_SECTIONS,
  'Summary',
  'Acceptance Criteria',
  'Blast Radius',
  'Test Evidence',
  'Regression Fence',
  'Rollback',
  'Approval Evidence',
];

const RISK_ORDER = ['R0', 'R1', 'R2', 'R3', 'R4'];
const R3_PATHS = [
  '.github/workflows/',
  'scripts/production/',
  'infra/',
  'azure.yaml',
  'Dockerfile',
];

function stripComments(value) {
  return value.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function fieldValue(body, name) {
  const match = body.match(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(.*)$`, 'mi'));
  return match ? stripComments(match[1]) : '';
}

function sectionValue(body, name) {
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim().toLowerCase() === `## ${name}`.toLowerCase());
  if (headingIndex < 0) return '';
  const nextHeadingOffset = lines.slice(headingIndex + 1).findIndex(line => /^##\s+/.test(line.trim()));
  const endIndex = nextHeadingOffset < 0 ? lines.length : headingIndex + 1 + nextHeadingOffset;
  return stripComments(lines.slice(headingIndex + 1, endIndex).join('\n'));
}

export function validatePullRequest({ body, changedFiles = [], isDraft = true }) {
  const errors = [];
  const visibleBody = stripComments(body || '');
  const fields = {};

  for (const [name, allowed] of Object.entries(FIELD_VALUES)) {
    const value = fieldValue(body || '', name);
    fields[name] = value;
    if (!value) errors.push(`Missing field: ${name}`);
    else if (!allowed.includes(value)) {
      errors.push(`${name} must be one of: ${allowed.join(', ')}`);
    }
  }

  const sections = {};
  for (const name of REQUIRED_SECTIONS) {
    const value = sectionValue(body || '', name);
    sections[name] = value;
    if (!value) errors.push(`Section is empty: ${name}`);
    else if (/\b(?:TODO|TBD)\b|\[replace[^\]]*\]/i.test(value)) {
      errors.push(`Section contains a placeholder: ${name}`);
    }
  }

  const orderedSectionIndices = [...READINESS_SECTIONS, 'Summary'].map(name => (
    body.split(/\r?\n/).findIndex(line => line.trim().toLowerCase() === `## ${name}`.toLowerCase())
  ));
  if (orderedSectionIndices.some((index, position) => position > 0 && index <= orderedSectionIndices[position - 1])) {
    errors.push('Readiness sections must appear in the required order before Summary');
  }

  if (changedFiles.length === 0) errors.push('Changed-file list is empty');

  const risk = fields['Risk class'];
  const lifecycle = fields.Lifecycle;
  const riskIndex = RISK_ORDER.indexOf(risk);

  if (riskIndex >= 2 && lifecycle === 'direct') {
    errors.push(`${risk} changes cannot use the direct lifecycle`);
  }
  if (riskIndex >= 3 && !['full-rpi', 'spec-kit-plus-rpi'].includes(lifecycle)) {
    errors.push(`${risk} changes require full-rpi or spec-kit-plus-rpi`);
  }
  if (riskIndex >= 2 && fields['Independent review'] === 'not-required') {
    errors.push(`${risk} changes require independent review or a documented exception`);
  }
  if (risk === 'R4' && fields['Independent review'] === 'exception') {
    errors.push('R4 independent review cannot be self-exempted');
  }
  if (risk === 'R4' && fields['External gate'] !== 'approved') {
    errors.push('R4 changes are blocked until External gate is approved');
  }
  if (!isDraft && fields['Review readiness'] !== 'ready') {
    errors.push('Non-draft PR requires Review readiness: ready');
  }
  if (!isDraft && fields['Readiness acknowledgment'] !== 'acknowledged') {
    errors.push('Non-draft PR requires Readiness acknowledgment: acknowledged');
  }

  const hasR3Path = changedFiles.some(file => R3_PATHS.some(entry => (
    entry.endsWith('/') ? file.startsWith(entry) : file === entry
  )));
  if (hasR3Path && riskIndex < 3) {
    errors.push('Deployment, infrastructure, or workflow changes require risk class R3 or R4');
  }

  if (fields['Change type'] === 'bug') {
    const fence = sections['Regression Fence'] || '';
    if (!/\bBefore\s*:/i.test(fence) || !/\bAfter\s*:/i.test(fence)) {
      errors.push('Bug Regression Fence must include both Before: and After: evidence');
    }
    if (/\bnot applicable\b|\bn\/a\b/i.test(fence)) {
      errors.push('A bug requires an executable fence or a specific explanation of why none is possible');
    }
  }

  if (/\b(?:TODO|TBD)\b|\[replace[^\]]*\]/i.test(visibleBody)) {
    errors.push('PR body contains an unresolved visible placeholder');
  }

  return { errors, fields, sections, changedFiles, hasR3Path };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--body-file') args.bodyFile = argv[index + 1];
    if (argv[index] === '--changed-files') args.changedFilesFile = argv[index + 1];
  }
  return args;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const body = args.bodyFile ? fs.readFileSync(args.bodyFile, 'utf8') : (process.env.PR_BODY || '');
  const changedFiles = args.changedFilesFile
    ? fs.readFileSync(args.changedFilesFile, 'utf8').split(/\r?\n/).filter(Boolean)
    : (process.env.CHANGED_FILES || '').split(/\r?\n/).filter(Boolean);
  const isDraft = process.env.PR_IS_DRAFT !== 'false';
  const result = validatePullRequest({ body, changedFiles, isDraft });

  if (result.errors.length > 0) {
    console.error('PR governance validation failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`PR governance validation passed: ${result.fields['Risk class']}, ${changedFiles.length} changed file(s)`);
}
