// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure import client — talks to the server's /api/azure/* endpoints to
 * reverse-engineer a live Resource Group into an ARM template. The template is
 * then handed to the deterministic ARM extractor (armExtractor.ts) on the
 * client, so the diagram is a faithful mirror of the deployed estate.
 *
 * These endpoints are disabled unless the server sets AZURE_IMPORT_ENABLED=true
 * (local / self-host only), so callers must handle a 503 "disabled" response.
 */

export interface AzureSubscription {
  subscriptionId: string;
  displayName: string;
}

export interface AzureResourceGroup {
  name: string;
  location: string;
}

export class AzureImportDisabledError extends Error {
  constructor(message = 'Azure import is disabled on the server') {
    super(message);
    this.name = 'AzureImportDisabledError';
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 503) {
    let msg = 'Azure import is disabled on the server';
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new AzureImportDisabledError(msg);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

/** Whether the server has Azure import enabled (probes the subscriptions route). */
export async function isAzureImportEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/azure/subscriptions', { method: 'GET' });
    return res.status !== 503;
  } catch {
    return false;
  }
}

export async function listSubscriptions(): Promise<AzureSubscription[]> {
  const data = await getJson<{ subscriptions: AzureSubscription[] }>('/api/azure/subscriptions');
  return data.subscriptions || [];
}

export async function listResourceGroups(subscriptionId: string): Promise<AzureResourceGroup[]> {
  const data = await getJson<{ resourceGroups: AzureResourceGroup[] }>(
    `/api/azure/resource-groups?subscriptionId=${encodeURIComponent(subscriptionId)}`,
  );
  return data.resourceGroups || [];
}
