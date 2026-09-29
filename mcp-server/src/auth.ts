// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Remote MCP authorization (MCP 2025-06-18 authorization spec).
 *
 * The server is an OAuth 2.1 protected resource; Microsoft Entra ID is the
 * authorization server. Clients (VS Code, GitHub Copilot CLI, ...) discover
 * Entra from the Protected Resource Metadata document, sign the user in, and
 * send an Entra access token for this API. Tokens are validated locally
 * against Entra's signing keys: signature, audience, issuer (per tenant),
 * expiry and the delegated scope.
 *
 * A static bearer token (MCP_AUTH_TOKEN) is still accepted for clients that
 * cannot do OAuth (connector wizards, scripts). Either credential is enough.
 */

import { timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';

export interface EntraAuthConfig {
  /** Application (client) ID of the MCP API app registration. */
  clientId: string;
  /** Delegated scope required on the token (without the api:// prefix). */
  scope: string;
  /** Optional tenant allow-list; empty means any Entra organization. */
  allowedTenants: string[];
  /** Entra authority host. */
  authority: string;
}

export interface McpAuthConfig {
  entra?: EntraAuthConfig;
  staticToken?: string;
}

export type AuthResult =
  | { ok: true; method: 'entra'; tenantId: string; objectId?: string }
  | { ok: true; method: 'static' | 'none' }
  | { ok: false; error: 'missing_token' | 'invalid_token' | 'insufficient_scope'; description: string };

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): McpAuthConfig {
  const clientId = env.MCP_ENTRA_CLIENT_ID?.trim();
  return {
    staticToken: env.MCP_AUTH_TOKEN?.trim() || undefined,
    entra: clientId
      ? {
          clientId,
          scope: env.MCP_ENTRA_SCOPE?.trim() || 'mcp.tools',
          allowedTenants: (env.MCP_ENTRA_ALLOWED_TENANTS ?? '')
            .split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
          authority: (env.MCP_ENTRA_AUTHORITY?.trim() || 'https://login.microsoftonline.com').replace(/\/+$/, ''),
        }
      : undefined,
  };
}

export function isAuthEnabled(config: McpAuthConfig): boolean {
  return Boolean(config.entra || config.staticToken);
}

/** Resource identifier advertised in metadata and expected as token audience. */
export function resourceUri(entra: EntraAuthConfig): string {
  return `api://${entra.clientId}`;
}

/**
 * RFC 9728 Protected Resource Metadata. `resource` is the MCP endpoint URL
 * (what clients connect to); scopes use the Entra App ID URI form.
 */
export function protectedResourceMetadata(entra: EntraAuthConfig, mcpUrl: string): Record<string, unknown> {
  const tenantSegment = entra.allowedTenants.length === 1 ? entra.allowedTenants[0] : 'organizations';
  return {
    resource: mcpUrl,
    authorization_servers: [`${entra.authority}/${tenantSegment}/v2.0`],
    scopes_supported: [`${resourceUri(entra)}/${entra.scope}`],
    bearer_methods_supported: ['header'],
    resource_name: 'Azure Architecture Diagram Builder MCP',
    resource_documentation: 'https://github.com/Arturo-Quiroga-MSFT/azure-architecture-diagram-builder/blob/main/mcp-server/README.md',
  };
}

/** `WWW-Authenticate` challenge for 401/403 responses. */
export function authChallenge(config: McpAuthConfig, metadataUrl: string, error?: string, description?: string): string {
  if (!config.entra) return 'Bearer';
  const parts = [`resource_metadata="${metadataUrl}"`, `scope="${resourceUri(config.entra)}/${config.entra.scope}"`];
  if (error) parts.push(`error="${error}"`);
  if (description) parts.push(`error_description="${description.replace(/"/g, "'")}"`);
  return `Bearer ${parts.join(', ')}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

const jwksCache = new Map<string, JWTVerifyGetKey>();
function entraKeys(authority: string): JWTVerifyGetKey {
  let keys = jwksCache.get(authority);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${authority}/common/discovery/v2.0/keys`), { cooldownDuration: 60_000 });
    jwksCache.set(authority, keys);
  }
  return keys;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyEntraToken(
  token: string,
  entra: EntraAuthConfig,
  keys: JWTVerifyGetKey = entraKeys(entra.authority),
): Promise<AuthResult> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      audience: [entra.clientId, resourceUri(entra)],
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iss', 'aud'],
      clockTolerance: 60,
    }));
  } catch (err) {
    return { ok: false, error: 'invalid_token', description: `Token rejected: ${(err as Error).message}` };
  }

  const tid = typeof payload.tid === 'string' ? payload.tid.toLowerCase() : '';
  if (!GUID.test(tid)) return { ok: false, error: 'invalid_token', description: 'Token has no tenant id.' };
  // Multi-tenant apps must pin the issuer to the token's own tenant.
  const expectedIssuers = [`${entra.authority}/${tid}/v2.0`, `https://sts.windows.net/${tid}/`];
  if (!expectedIssuers.includes(String(payload.iss))) {
    return { ok: false, error: 'invalid_token', description: 'Token issuer does not match its tenant.' };
  }
  if (entra.allowedTenants.length && !entra.allowedTenants.includes(tid)) {
    return { ok: false, error: 'invalid_token', description: 'Tenant is not allowed to use this server.' };
  }
  const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
  if (!scopes.includes(entra.scope)) {
    return { ok: false, error: 'insufficient_scope', description: `Token is missing the '${entra.scope}' scope.` };
  }
  return { ok: true, method: 'entra', tenantId: tid, objectId: typeof payload.oid === 'string' ? payload.oid : undefined };
}

export async function authorizeRequest(
  authorizationHeader: string | string[] | undefined,
  config: McpAuthConfig,
  keys?: JWTVerifyGetKey,
): Promise<AuthResult> {
  if (!isAuthEnabled(config)) return { ok: true, method: 'none' };
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i);
  if (!match) return { ok: false, error: 'missing_token', description: 'A bearer token is required.' };
  const token = match[1];

  if (config.staticToken && safeEqual(token, config.staticToken)) return { ok: true, method: 'static' };
  // Only JWT-shaped tokens go to Entra validation.
  if (config.entra && token.split('.').length === 3) return verifyEntraToken(token, config.entra, keys);
  return { ok: false, error: 'invalid_token', description: 'The bearer token is not valid.' };
}
