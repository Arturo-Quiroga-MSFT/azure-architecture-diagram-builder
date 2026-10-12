// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Per-request usage logging for the remote (streamable-HTTP) MCP endpoint.
 *
 * One JSON line per HTTP request is written to stdout, which Azure Container
 * Apps ships to Log Analytics (ContainerAppConsoleLogs_CL). Records carry the
 * caller's tenant and Entra object ID but no names, emails, tokens or tool
 * arguments — enough to count users, tenants and failures without PII.
 * Set MCP_USAGE_LOG=off to disable.
 */

export interface RpcSummary {
  rpcMethods: string[];
  tools: string[];
  clientName?: string;
  clientVersion?: string;
  protocolVersion?: string;
}

export interface ToolOutcome {
  tool: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface UsageRecord {
  status: number;
  durationMs: number;
  httpMethod: string;
  auth: 'entra' | 'static' | 'none' | 'rejected';
  authError?: string;
  tenantId?: string;
  objectId?: string;
  userAgent?: string;
  rpc?: RpcSummary;
  toolResults?: ToolOutcome[];
}

const MAX_TEXT = 200;

function clip(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
}

/** Extract method names, tool names and client info from a JSON-RPC body (single or batch). */
export function summarizeRpc(body: unknown): RpcSummary {
  const messages = Array.isArray(body) ? body : body ? [body] : [];
  const summary: RpcSummary = { rpcMethods: [], tools: [] };
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const { method, params } = msg as { method?: unknown; params?: Record<string, unknown> };
    if (typeof method !== 'string') continue;
    summary.rpcMethods.push(method);
    if (method === 'tools/call' && typeof params?.name === 'string') summary.tools.push(params.name);
    if (method === 'initialize' && params) {
      const clientInfo = params.clientInfo as { name?: unknown; version?: unknown } | undefined;
      summary.clientName = clip(clientInfo?.name);
      summary.clientVersion = clip(clientInfo?.version);
      summary.protocolVersion = clip(params.protocolVersion);
    }
  }
  return summary;
}

export function usageLoggingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.MCP_USAGE_LOG ?? '').trim().toLowerCase() !== 'off';
}

export function formatUsageRecord(record: UsageRecord, now: Date = new Date()): string {
  const rpc = record.rpc;
  return JSON.stringify({
    timestamp: now.toISOString(),
    service: 'aadb-mcp',
    event: 'mcp_request',
    revision: process.env.CONTAINER_APP_REVISION || undefined,
    status: record.status,
    durationMs: record.durationMs,
    httpMethod: record.httpMethod,
    auth: record.auth,
    authError: record.authError,
    tenantId: record.tenantId,
    objectId: record.objectId,
    userAgent: clip(record.userAgent),
    rpcMethods: rpc?.rpcMethods.length ? rpc.rpcMethods : undefined,
    tools: rpc?.tools.length ? rpc.tools : undefined,
    clientName: rpc?.clientName,
    clientVersion: rpc?.clientVersion,
    protocolVersion: rpc?.protocolVersion,
    toolResults: record.toolResults?.length
      ? record.toolResults.map(r => ({ ...r, error: clip(r.error) }))
      : undefined,
  });
}

export function logUsage(record: UsageRecord): void {
  if (!usageLoggingEnabled()) return;
  process.stdout.write(`${formatUsageRecord(record)}\n`);
}
