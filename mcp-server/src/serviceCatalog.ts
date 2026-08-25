// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Azure service catalog generated from AADB's canonical SERVICE_ICON_MAP.
 * Run `npm run sync:icons` after changing the canonical web catalog.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export interface ServiceInfo {
  displayName: string;
  aliases: string[];
  iconFile: string;
  iconCategory?: string;
  category: string;
  hasPricingData: boolean;
  pricingServiceName?: string;
  isUsageBased?: boolean;
  costRange?: string;
}

function loadCatalog(): Record<string, ServiceInfo> {
  const here = dirname(fileURLToPath(import.meta.url));
  const catalogPath = resolve(here, 'serviceCatalog.generated.json');
  const parsed = JSON.parse(readFileSync(catalogPath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Generated service catalog must be an object');
  }
  return parsed as Record<string, ServiceInfo>;
}

export const SERVICE_CATALOG = loadCatalog();

const normalizeIdentity = (value: string) => value.trim().toLowerCase();
const SERVICE_IDENTITIES = new Map<string, string>();

for (const [key, info] of Object.entries(SERVICE_CATALOG)) {
  for (const identity of [key, info.displayName, ...info.aliases]) {
    const normalized = normalizeIdentity(identity);
    const owner = SERVICE_IDENTITIES.get(normalized);
    if (owner && owner !== key) {
      throw new Error(`Ambiguous generated service identity "${identity}": ${owner} vs ${key}`);
    }
    SERVICE_IDENTITIES.set(normalized, key);
  }
}

/** Resolve a canonical key, display name, or alias case-insensitively. */
export function resolveServiceName(name: string): string | null {
  return SERVICE_IDENTITIES.get(normalizeIdentity(name)) ?? null;
}

/** Get all unique categories in the catalog. */
export function getCategories(): string[] {
  return [...new Set(Object.values(SERVICE_CATALOG).map(service => service.category))].sort();
}

/** Filter services by category. */
export function getServicesByCategory(category: string): Record<string, ServiceInfo> {
  return Object.fromEntries(
    Object.entries(SERVICE_CATALOG).filter(([, info]) => info.category === category),
  );
}
