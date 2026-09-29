// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * API Format Helper
 * Abstracts the difference between Azure OpenAI Responses API and Chat Completions API.
 * OpenAI models (GPT-5.x / GPT-6) use the Responses API; third-party models
 * (DeepSeek, Grok, Kimi, Mistral) use the Chat Completions API via Azure AI
 * model inference; Anthropic Claude models use the Anthropic Messages API.
 */

export type ApiFormat = 'responses' | 'chat-completions' | 'chat-completions-v1' | 'anthropic-messages';

const JSON_ONLY_INSTRUCTION =
  'Respond with a single valid JSON object only. Do not wrap it in markdown code fences and do not add any text before or after it.';

/** Human-readable API family name for logs. */
export function describeApiFormat(apiFormat: ApiFormat): string {
  if (apiFormat === 'anthropic-messages') return 'Anthropic Messages';
  return isChatCompletionsFormat(apiFormat) ? 'Chat Completions' : 'Responses';
}

function dataUrlToAnthropicImage(url: string): any | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(url);
  if (!match) return { type: 'image', source: { type: 'url', url } };
  return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } };
}

function toAnthropicContent(content: any): any {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map((part: any) => {
      if (typeof part === 'string') return { type: 'text', text: part };
      if (part?.type === 'text' || part?.type === 'input_text') return { type: 'text', text: part.text ?? '' };
      if (part?.type === 'input_image') return dataUrlToAnthropicImage(part.image_url);
      if (part?.type === 'image_url') return dataUrlToAnthropicImage(part.image_url?.url ?? part.image_url);
      return null;
    })
    .filter(Boolean);
}

function contentToText(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((p: any) => (typeof p === 'string' ? p : p?.text ?? '')).filter(Boolean).join('\n');
  }
  return String(content ?? '');
}

/**
 * Convert OpenAI-style messages into an Anthropic Messages API body.
 * System messages are lifted into the top-level `system` field and adjacent
 * same-role turns are merged, since Anthropic requires alternating roles.
 */
export function buildAnthropicBody(params: {
  deployment: string;
  messages: any[];
  maxTokens: number;
  isReasoning: boolean;
  reasoningEffort: string;
  jsonOutput: boolean;
}): any {
  const { deployment, messages, maxTokens, isReasoning, reasoningEffort, jsonOutput } = params;
  const systemParts: string[] = [];
  const turns: { role: 'user' | 'assistant'; content: any }[] = [];

  for (const msg of messages) {
    if (msg.role === 'system' || msg.role === 'developer') {
      systemParts.push(contentToText(msg.content));
      continue;
    }
    const role: 'user' | 'assistant' = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = toAnthropicContent(msg.content);
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) {
      const asBlocks = (c: any) => (typeof c === 'string' ? [{ type: 'text', text: c }] : c);
      prev.content = [...asBlocks(prev.content), ...asBlocks(content)];
    } else {
      turns.push({ role, content });
    }
  }

  if (jsonOutput) systemParts.push(JSON_ONLY_INSTRUCTION);

  const body: any = {
    model: deployment,
    max_tokens: maxTokens,
    messages: turns,
  };
  if (systemParts.length) body.system = systemParts.join('\n\n');

  if (isReasoning && reasoningEffort !== 'none') {
    body.thinking = { type: 'adaptive' };
    body.output_config = { effort: reasoningEffort };
  } else {
    body.thinking = { type: 'disabled' };
  }
  return body;
}

/**
 * Strip a markdown code fence wrapping the whole reply, but only when the
 * fenced body is valid JSON — non-JSON (e.g. markdown answers) is left intact.
 */
export function stripCodeFence(text: string): string {
  const match = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/i.exec(text);
  if (!match) return text;
  const inner = match[1].trim();
  try {
    JSON.parse(inner);
    return inner;
  } catch {
    return text;
  }
}

export function isChatCompletionsFormat(apiFormat: ApiFormat): boolean {
  return apiFormat === 'chat-completions' || apiFormat === 'chat-completions-v1';
}

/**
 * Build the correct API URL for the given format.
 * - Responses API:       {endpoint}openai/v1/responses
 * - Chat Completions:    {endpoint}openai/deployments/{deployment}/chat/completions?api-version=2024-12-01-preview
 */
export function buildApiUrl(endpoint: string, deployment: string, apiFormat: ApiFormat): string {
  if (apiFormat === 'chat-completions-v1') {
    return `${endpoint}openai/v1/chat/completions`;
  }
  if (apiFormat === 'chat-completions') {
    return `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-05-01-preview`;
  }
  if (apiFormat === 'anthropic-messages') {
    return `${endpoint}anthropic/v1/messages`;
  }
  return `${endpoint}openai/v1/responses`;
}

/**
 * Build the request body for the given API format.
 * Handles reasoning config only for Responses API models that support it.
 */
export function buildRequestBody(params: {
  deployment: string;
  messages: any[];
  maxTokens: number;
  apiFormat: ApiFormat;
  isReasoning: boolean;
  reasoningEffort: string;
  jsonOutput?: boolean;
  supportsStructuredOutputs?: boolean;
}): any {
  const { deployment, messages, maxTokens, apiFormat, isReasoning, reasoningEffort, jsonOutput = true, supportsStructuredOutputs = true } = params;

  if (apiFormat === 'anthropic-messages') {
    return buildAnthropicBody({ deployment, messages, maxTokens, isReasoning, reasoningEffort, jsonOutput });
  }

  if (isChatCompletionsFormat(apiFormat)) {
    return {
      ...(apiFormat === 'chat-completions-v1' ? { model: deployment } : {}),
      messages,
      ...(apiFormat === 'chat-completions-v1'
        ? { max_completion_tokens: maxTokens }
        : { max_tokens: maxTokens }),
      ...(jsonOutput && supportsStructuredOutputs ? { response_format: { type: 'json_object' } } : {}),
      temperature: 0.7,
    };
  }

  // Responses API
  const body: any = {
    model: deployment,
    input: messages,
    max_output_tokens: maxTokens,
    ...(jsonOutput && supportsStructuredOutputs ? { text: { format: { type: 'json_object' } } } : {}),
    store: false,
  };

  if (isReasoning && reasoningEffort !== 'none') {
    body.reasoning = { effort: reasoningEffort };
  }

  return body;
}

/**
 * Parse the API response into a uniform shape regardless of API format.
 */
export function parseApiResponse(
  data: any,
  apiFormat: ApiFormat,
): { content: string; promptTokens: number; completionTokens: number; totalTokens: number } {
  if (apiFormat === 'anthropic-messages') {
    const usage = data.usage || {};
    // Claude may return thinking blocks alongside the answer; only text blocks are the reply.
    const text = Array.isArray(data.content)
      ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('')
      : '';
    const promptTokens = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    const completionTokens = usage.output_tokens || 0;
    return {
      content: stripCodeFence(text),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  if (isChatCompletionsFormat(apiFormat)) {
    const usage = data.usage || {};
    return {
      content: data.choices?.[0]?.message?.content || '',
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    };
  }

  // Responses API
  let content = data.output_text || '';
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

  const usage = data.usage || {};
  return {
    content,
    promptTokens: usage.input_tokens || 0,
    completionTokens: usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
  };
}

/**
 * Result of a call to the server-side Azure OpenAI proxy.
 */
export interface OpenAIProxyResult {
  ok: boolean;
  status: number;
  data: any;
  errorText?: string;
  correlationId: string;
}

/**
 * Call Azure OpenAI through the server-side proxy (/api/openai).
 *
 * The proxy holds the Azure OpenAI credentials (managed identity, with optional
 * key fallback) so they are never shipped to the browser. The client sends the
 * already-built request body plus the deployment name and API format; the server
 * constructs the upstream URL from its trusted endpoint and attaches auth.
 */
export async function callAzureOpenAIProxy(params: {
  apiFormat: ApiFormat;
  deployment: string;
  model: string;
  operation: string;
  body: any;
  signal?: AbortSignal;
}): Promise<OpenAIProxyResult> {
  const requestCorrelationId = crypto.randomUUID();
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-correlation-id': requestCorrelationId,
    },
    body: JSON.stringify({
      apiFormat: params.apiFormat,
      deployment: params.deployment,
      model: params.model,
      operation: params.operation,
      body: params.body,
    }),
    signal: params.signal,
  });
  const correlationId = response.headers.get('x-correlation-id') || requestCorrelationId;

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const diagnosticText = `${errorText}${errorText ? ' ' : ''}(Request ID: ${correlationId})`;
    return { ok: false, status: response.status, data: null, errorText: diagnosticText, correlationId };
  }

  const data = await response.json();
  return { ok: true, status: response.status, data, correlationId };
}
