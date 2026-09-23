// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Unified data provider for "Import from Azure".
 *
 * Chooses between two modes transparently:
 *   • Delegated (hosted): VITE_AZURE_AD_CLIENT_ID is set → the browser signs the
 *     user in (MSAL) and calls Azure Resource Manager / Resource Graph DIRECTLY
 *     with the user's token. Everything is RBAC-scoped to that user; the app's
 *     server identity is never involved.
 *   • Server (local / self-host): no client ID → calls the token server's
 *     /api/azure/* routes (gated by AZURE_IMPORT_ENABLED, using the server's
 *     DefaultAzureCredential).
 *
 * Both modes return the same shapes and feed the same Resource Graph adapter.
 */

import {
  listSubscriptions as serverListSubscriptions,
  listResourceGroups as serverListResourceGroups,
  type AzureSubscription,
  type AzureResourceGroup,
} from './azureImport';
import { queryResourceGroupResources as serverQueryResources, type ArgResource } from './resourceGraphAdapter';
import { isDelegatedAuthConfigured, getArmToken, getSignedInName, signIn } from './msalAuth';

const ARM = 'https://management.azure.com';

export function isDelegatedMode(): boolean {
  return isDelegatedAuthConfigured();
}

async function armFetch(token: string, path: string): Promise<any> {
  const r = await fetch(`${ARM}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Azure Resource Manager request failed (${r.status})`);
  return r.json();
}

// ── Delegated (browser-direct) ────────────────────────────────────────────────

async function delegatedSubscriptions(): Promise<AzureSubscription[]> {
  const token = await getArmToken();
  const data = await armFetch(token, '/subscriptions?api-version=2022-12-01');
  return (data.value || []).map((s: any) => ({ subscriptionId: s.subscriptionId, displayName: s.displayName }));
}

async function delegatedResourceGroups(subscriptionId: string): Promise<AzureResourceGroup[]> {
  const token = await getArmToken();
  const data = await armFetch(token, `/subscriptions/${subscriptionId}/resourcegroups?api-version=2021-04-01`);
  return (data.value || [])
    .map((g: any) => ({ name: g.name, location: g.location }))
    .sort((a: AzureResourceGroup, b: AzureResourceGroup) => a.name.localeCompare(b.name));
}

async function delegatedResources(subscriptionId: string, resourceGroup: string): Promise<ArgResource[]> {
  const token = await getArmToken();
  const rg = resourceGroup.replace(/'/g, '');
  const query = `Resources | where resourceGroup =~ '${rg}' | project id, name, type, kind, location, properties | limit 1000`;
  const r = await fetch(`${ARM}/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptions: [subscriptionId], query, options: { resultFormat: 'objectArray' } }),
  });
  if (!r.ok) throw new Error(`Resource Graph query failed (${r.status})`);
  const data = await r.json();
  return (data.data || []) as ArgResource[];
}

// ── Public unified API ────────────────────────────────────────────────────────

/**
 * Ensure the user is authenticated when in delegated mode; returns the signed-in
 * account name (or undefined in server mode). When not signed in, this starts a
 * full-page sign-in redirect and does not resolve (the app re-opens the import
 * modal when the redirect returns).
 */
export async function ensureSignedIn(): Promise<string | undefined> {
  if (!isDelegatedMode()) return undefined;
  const name = await getSignedInName();
  if (name) return name;
  await signIn(); // navigates away for interactive sign-in
  return undefined;
}

export async function getSubscriptions(): Promise<AzureSubscription[]> {
  return isDelegatedMode() ? delegatedSubscriptions() : serverListSubscriptions();
}

export async function getResourceGroups(subscriptionId: string): Promise<AzureResourceGroup[]> {
  return isDelegatedMode() ? delegatedResourceGroups(subscriptionId) : serverListResourceGroups(subscriptionId);
}

export async function getResources(subscriptionId: string, resourceGroup: string): Promise<ArgResource[]> {
  return isDelegatedMode() ? delegatedResources(subscriptionId, resourceGroup) : serverQueryResources(subscriptionId, resourceGroup);
}

export type { AzureSubscription, AzureResourceGroup };
