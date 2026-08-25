import assert from 'node:assert/strict';
import { FOLLOW_UP_MODEL_POLICY, getFollowUpOperation } from '../src/services/followUpModelPolicy';

assert.deepEqual(FOLLOW_UP_MODEL_POLICY, {
  model: 'gpt-5.6-sol',
  reasoningEffort: 'low',
});
assert.notEqual(FOLLOW_UP_MODEL_POLICY.model, 'grok-4.1-fast');
assert.equal(getFollowUpOperation('automatic_after_change'), 'chat_followups_auto');
assert.equal(getFollowUpOperation('what_would_you_add'), 'chat_followups_best');

console.log('Guided Chat follow-up model policy passed: GPT-5.6 Sol / low');