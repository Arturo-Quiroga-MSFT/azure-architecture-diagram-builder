import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateAudit, validateExceptionPolicy } from './dependency-audit-policy.mjs';

const policy = JSON.parse(readFileSync(new URL('../security/dependency-audit-exceptions.json', import.meta.url), 'utf8'));

const cleanMetadata = { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 } };
const approvedReport = {
  metadata: cleanMetadata,
  vulnerabilities: {
    'image-size': {
      severity: 'high',
      via: [
        { severity: 'high', url: 'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr' },
        { severity: 'high', url: 'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq' },
      ],
    },
    pptxgenjs: { severity: 'high', via: ['image-size'] },
  },
};

const now = new Date('2026-09-01T12:00:00Z');
assert.deepEqual(validateExceptionPolicy(policy, now), []);
assert.deepEqual(evaluateAudit(approvedReport, policy, { context: 'root production', allowExceptions: true, now }), []);
assert(evaluateAudit({ ...approvedReport, vulnerabilities: { ...approvedReport.vulnerabilities, ws: { severity: 'high', via: [] } } }, policy,
  { context: 'root production', allowExceptions: true, now }).some(error => error.includes('non-allowlisted package ws')));
assert(evaluateAudit({ ...approvedReport, vulnerabilities: { ...approvedReport.vulnerabilities, 'image-size': { severity: 'high', via: [{ severity: 'high', url: 'https://github.com/advisories/GHSA-unknown-new' }] } } }, policy,
  { context: 'root production', allowExceptions: true, now }).some(error => error.includes('unapproved advisory')));
assert(evaluateAudit({ ...approvedReport, vulnerabilities: { ...approvedReport.vulnerabilities, 'image-size': { ...approvedReport.vulnerabilities['image-size'], severity: 'critical' } } }, policy,
  { context: 'root production', allowExceptions: true, now }).some(error => error.includes('critical severity cannot be excepted')));
assert(validateExceptionPolicy(policy, new Date('2026-10-02T00:00:00Z')).some(error => error.includes('expired')));
assert(evaluateAudit({ error: { summary: 'registry unavailable' } }, policy,
  { context: 'root production', allowExceptions: true, now }).some(error => error.includes('transport/tool failure')));
assert.deepEqual(evaluateAudit({ metadata: { vulnerabilities: {} }, vulnerabilities: {} }, policy,
  { context: 'server production', allowExceptions: false, now }), []);

console.log('Dependency audit policy tests passed: approved exception and five fail-closed cases');
