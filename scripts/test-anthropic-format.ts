import assert from 'node:assert/strict';
import { buildRequestBody, parseApiResponse, stripCodeFence } from '../src/services/apiHelper';

// System messages lift to `system`, adjacent same-role turns merge, and JSON
// mode appends the JSON-only instruction.
const body = buildRequestBody({
  deployment: 'claude-opus-5-5',
  messages: [
    { role: 'system', content: 'You design Azure architectures.' },
    { role: 'user', content: 'First part.' },
    { role: 'user', content: [{ type: 'input_text', text: 'Second part.' }] },
    { role: 'assistant', content: 'OK.' },
    { role: 'user', content: 'Go.' },
  ],
  maxTokens: 32000,
  apiFormat: 'anthropic-messages',
  isReasoning: true,
  reasoningEffort: 'medium',
  jsonOutput: true,
});
assert.equal(body.model, 'claude-opus-5-5');
assert.equal(body.max_tokens, 32000);
assert.match(body.system, /^You design Azure architectures\.\n\n/);
assert.match(body.system, /single valid JSON object/);
assert.deepEqual(body.messages.map((m: any) => m.role), ['user', 'assistant', 'user']);
assert.deepEqual(body.messages[0].content, [
  { type: 'text', text: 'First part.' },
  { type: 'text', text: 'Second part.' },
]);
assert.deepEqual(body.thinking, { type: 'adaptive' });
assert.deepEqual(body.output_config, { effort: 'medium' });
assert.equal('temperature' in body, false);
assert.equal('response_format' in body, false);

// Effort "none" disables thinking; non-JSON calls skip the JSON instruction.
const plain = buildRequestBody({
  deployment: 'claude-sonnet-5-5',
  messages: [{ role: 'user', content: 'Hi' }],
  maxTokens: 1000,
  apiFormat: 'anthropic-messages',
  isReasoning: true,
  reasoningEffort: 'none',
  jsonOutput: false,
});
assert.deepEqual(plain.thinking, { type: 'disabled' });
assert.equal('output_config' in plain, false);
assert.equal('system' in plain, false);

// Data-URL images convert to Anthropic base64 image blocks.
const withImage = buildRequestBody({
  deployment: 'claude-opus-5-5',
  messages: [{ role: 'user', content: [{ type: 'input_image', image_url: 'data:image/png;base64,QUJD' }] }],
  maxTokens: 1000,
  apiFormat: 'anthropic-messages',
  isReasoning: false,
  reasoningEffort: 'medium',
  jsonOutput: false,
});
assert.deepEqual(withImage.messages[0].content, [
  { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QUJD' } },
]);

// Responses keep only text blocks (thinking blocks are dropped), unwrap a
// fenced JSON reply, and total the Anthropic usage fields.
const parsed = parseApiResponse(
  {
    content: [
      { type: 'thinking', thinking: 'internal', signature: 'sig' },
      { type: 'text', text: '```json\n{"services":[]}\n```' },
    ],
    usage: { input_tokens: 100, cache_read_input_tokens: 20, output_tokens: 30 },
  },
  'anthropic-messages',
);
assert.equal(parsed.content, '{"services":[]}');
assert.equal(parsed.promptTokens, 120);
assert.equal(parsed.completionTokens, 30);
assert.equal(parsed.totalTokens, 150);

// Fences around non-JSON content are left alone.
const markdown = '```bicep\nresource x\n```';
assert.equal(stripCodeFence(markdown), markdown);
assert.equal(stripCodeFence('```\nnot json\n```'), '```\nnot json\n```');

console.log('Anthropic Messages format contract passed');
