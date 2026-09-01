import assert from 'node:assert/strict';
import { validatePullRequest } from './validate-pr-governance.mjs';

function body(overrides = {}) {
  const values = {
    changeType: 'feature',
    risk: 'R2',
    lifecycle: 'plan',
    review: 'required-pending',
    external: 'not-applicable',
    merge: 'pending',
    deployment: 'not-requested',
    fence: 'Not applicable: this feature changes an existing documented workflow.',
    ...overrides,
  };
  return `
Change type: ${values.changeType}
Risk class: ${values.risk}
Lifecycle: ${values.lifecycle}
Independent review: ${values.review}
External gate: ${values.external}
Merge approval: ${values.merge}
Production deployment: ${values.deployment}

## Summary
Adds one bounded behavior with no unrelated refactor.

## Acceptance Criteria
The documented user journey has an observable pass/fail outcome.

## Blast Radius
Searched all consumers of the changed contract; two call sites are affected.

## Test Evidence
npm run test:focused passed with 3 tests.

## Regression Fence
${values.fence}

## Limitations / Not Tested
No production deployment was performed.

## Rollback
Revert the feature commit.

## Approval Evidence
Plan critique passed; independent implementation review is pending.
`;
}

function errorsFor(prBody, changedFiles = ['src/App.tsx']) {
  return validatePullRequest({ body: prBody, changedFiles }).errors;
}

assert.deepEqual(errorsFor(body()), [], 'valid R2 feature should pass');
assert.deepEqual(errorsFor(body({
  changeType: 'bug',
  fence: 'Before: old code fails the focused test.\nAfter: fixed code passes the same test.',
})), [], 'bug with red/green fence should pass');
assert.deepEqual(errorsFor(body({
  risk: 'R3', lifecycle: 'full-rpi', review: 'complete',
}), ['.github/workflows/quality.yml']), [], 'R3 workflow change should pass');
assert.deepEqual(errorsFor(body({
  risk: 'R4', lifecycle: 'full-rpi', review: 'complete', external: 'approved',
}), ['infra/main.bicep']), [], 'approved R4 infrastructure change should pass');

assert(errorsFor(body({ lifecycle: 'direct' })).some(error => error.includes('cannot use the direct')));
assert(errorsFor(body({ changeType: 'bug' })).some(error => error.includes('Before: and After:')));
assert(errorsFor(body({ risk: 'R4', lifecycle: 'full-rpi', review: 'complete', external: 'pending' }))
  .some(error => error.includes('External gate is approved')));
assert(errorsFor(body({ risk: 'R2' }), ['scripts/production/deploy-webapp.sh'])
  .some(error => error.includes('require risk class R3')));
assert(errorsFor(body().replace('## Summary\nAdds one bounded behavior with no unrelated refactor.', '## Summary\n<!-- What changed? -->'))
  .some(error => error.includes('Section is empty: Summary')));
assert(errorsFor(body().replace('No production deployment was performed.', 'TBD'))
  .some(error => error.includes('placeholder')));
assert(errorsFor(body(), []).includes('Changed-file list is empty'));

console.log('PR governance tests passed: 4 valid and 7 invalid evidence cases');
