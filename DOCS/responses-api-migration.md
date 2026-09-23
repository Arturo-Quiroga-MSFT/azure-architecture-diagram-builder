# Responses API Migration

**Branch:** `responses-api-migration`  
**Commit:** `dfc340d`  
**Date:** February 13, 2026  

## Overview

Migrated all Azure OpenAI API calls from the **Chat Completions API** to the **Responses API** (v1 GA). This was driven by two factors:

1. **GPT-5.2-Codex support** — The Codex model does not support Chat Completions (`OperationNotSupported`), only the Responses API.
2. **Microsoft deprecation** — Microsoft is deprecating the Chat Completions API in favor of the Responses API.

## Files Changed

| File | Function | Purpose |
|------|----------|---------|
| `src/services/azureOpenAI.ts` | `callAzureOpenAI()` | Main architecture generation |
| `src/services/azureOpenAI.ts` | `analyzeArchitectureDiagramImage()` | Image-to-architecture analysis |
| `src/services/architectureValidator.ts` | `callAzureOpenAI()` | Well-Architected validation |
| `src/services/deploymentGuideGenerator.ts` | `callAzureOpenAI()` | Deployment guide generation |

## API Mapping Reference

### Endpoint

| Before | After |
|--------|-------|
| `{endpoint}/openai/deployments/{deployment}/chat/completions?api-version=2024-12-01-preview` | `{endpoint}openai/v1/responses` |

The v1 GA endpoint does not require an `api-version` query parameter.

### Request Body

| Chat Completions | Responses API | Notes |
|-----------------|---------------|-------|
| `messages` (array) | `input` (array) | All messages including system go in `input` |
| — | `model` | Deployment name goes in the body, not the URL |
| `max_completion_tokens` | `max_output_tokens` | |
| `response_format: { type: 'json_object' }` | `text: { format: { type: 'json_object' } }` | |
| `reasoning_effort: 'low'` | `reasoning: { effort: 'low' }` | Only for reasoning models |
| — | `store: false` | Prevents 30-day server-side data retention |

### Response Body

| Chat Completions | Responses API | Notes |
|-----------------|---------------|-------|
| `choices[0].message.content` | `output_text` | Convenience shortcut field |
| — | `output[].content[].text` | Fallback: iterate `output` array for `type: 'message'` items |
| `usage.prompt_tokens` | `usage.input_tokens` | |
| `usage.completion_tokens` | `usage.output_tokens` | |
| `usage.total_tokens` | `usage.total_tokens` | Same |

### Image Analysis (Vision)

| Chat Completions | Responses API |
|-----------------|---------------|
| `type: 'text'` | `type: 'input_text'` |
| `type: 'image_url'` | `type: 'input_image'` |
| `image_url: { url: ... }` | `image_url: 'data:...'` (string, not object) |

Image analysis uses `instructions` (system prompt) instead of `input` because it doesn't use `json_object` format.

## Key Constraint: json_object Format

When using `text.format.type: 'json_object'`, the word **"json"** must appear in the `input` messages. This is why all messages (including system prompts that mention "Return ONLY a valid JSON object") are passed in `input` rather than splitting system prompts into the `instructions` field.

## Response Parsing

The implementation uses a two-tier parsing strategy:

```typescript
// Primary: use output_text convenience field
let content = data.output_text || '';

// Fallback: extract from output array
if (!content && data.output) {
  for (const item of data.output) {
    if (item.type === 'message' && item.content) {
      for (const part of item.content) {
        if (part.type === 'output_text') {
          content += part.text;
        }
      }
    }
  }
}
```

## Test Results

All 6 models tested successfully on the Responses API:

| Model | Prompt | Time | Tokens | Status |
|-------|--------|------|--------|--------|
| GPT-4.1 | Web app (React, Node, PostgreSQL, Blob) | 5.37s | 2,511 | ✅ |
| GPT-5.2-Codex (low) | Same web app prompt | 22.20s | 2,956 | ✅ |
| GPT-5.2 (low) | Healthcare imaging eventing architecture | 43s | — | ✅ |

### Model Comparison: GPT-5.2 vs GPT-5.2-Codex

Both models were tested with the same complex healthcare imaging prompt:

| Aspect | GPT-5.2 (43s) | GPT-5.2-Codex (22s) |
|--------|---------------|---------------------|
| Services | 9 (identical set) | 9 (identical set) |
| Groups | 5 (identical) | 5 (identical) |
| Claim check pattern | ✅ VPN → Storage direct blob upload | ❌ Missing |
| Edge label detail | High (session IDs, IPsec, 250M-scale) | Functional but generic |
| Workflow specificity | Domain-specific (ordering lag, checkpoints) | Generic descriptions |
| Speed | ~2x slower | ~2x faster |

**Takeaway:** GPT-5.2 produces more architecturally nuanced results; Codex is better for fast iterations.

## References

- [Azure OpenAI Responses API - How To](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses)
- [Azure OpenAI Responses API Samples](https://github.com/Azure-Samples/azure-openai-responses-api-samples)
