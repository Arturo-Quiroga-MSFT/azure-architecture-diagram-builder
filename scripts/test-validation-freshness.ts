import assert from 'node:assert/strict';
import { resolveValidationFreshness } from '../src/utils/validationFreshness';

assert.deepEqual(
  resolveValidationFreshness(true, true),
  { keepResult: true, needsRefresh: true },
  'Applying recommendations should retain the previous report and require revalidation.',
);

assert.deepEqual(
  resolveValidationFreshness(true, false),
  { keepResult: false, needsRefresh: false },
  'Ordinary generation should clear an obsolete validation report.',
);

assert.deepEqual(
  resolveValidationFreshness(false, true),
  { keepResult: false, needsRefresh: false },
  'There is no report to retain when recommendations are applied without prior results.',
);

console.log('Validation freshness tests passed.');