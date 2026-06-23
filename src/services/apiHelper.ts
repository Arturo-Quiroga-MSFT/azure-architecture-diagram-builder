// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * API Format Helper
 * Abstracts the difference between Azure OpenAI Responses API and Chat Completions API.
 * OpenAI models (GPT-5.x) use the Responses API; third-party models
 * (DeepSeek, Grok) use the Chat Completions API via Azure AI model inference.
 */

export type ApiFormat = 'responses' | 'chat-completions';

/**
 * Build the correct API URL for the given format.
 * - Responses API:       {endpoint}openai/v1/responses
 * - Chat Completions:    {endpoint}openai/deployments/{deployment}/chat/completions?api-version=2024-12-01-preview
 */
export function buildApiUrl(endpoint: string, deployment: string, apiFormat: ApiFormat): string {
  if (apiFormat === 'chat-completions') {
    return `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-05-01-preview`;
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
}): any {
  const { deployment, messages, maxTokens, apiFormat, isReasoning, reasoningEffort, jsonOutput = true } = params;

  if (apiFormat === 'chat-completions') {
    return {
      messages,
      max_tokens: maxTokens,
      ...(jsonOutput ? { response_format: { type: 'json_object' } } : {}),
      temperature: 0.7,
    };
  }

  // Responses API
  const body: any = {
    model: deployment,
    input: messages,
    max_output_tokens: maxTokens,
    ...(jsonOutput ? { text: { format: { type: 'json_object' } } } : {}),
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
  if (apiFormat === 'chat-completions') {
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
  body: any;
  signal?: AbortSignal;
}): Promise<OpenAIProxyResult> {
  const response = await fetch('/api/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiFormat: params.apiFormat,
      deployment: params.deployment,
      body: params.body,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    return { ok: false, status: response.status, data: null, errorText };
  }

  const data = await response.json();
  return { ok: true, status: response.status, data };
}
