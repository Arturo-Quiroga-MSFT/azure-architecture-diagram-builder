// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export interface ServiceInfo {
  displayName: string;
  aliases: string[];
  category: string;
  hasPricingData: boolean;
  pricingServiceName?: string;
  isUsageBased?: boolean;
  costRange?: string;
}

const catalogPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'serviceCatalog.generated.json',
);

export const SERVICE_CATALOG: Record<string, ServiceInfo> = JSON.parse(
  readFileSync(catalogPath, 'utf8'),
) as Record<string, ServiceInfo>;

const SERVICE_NAME_INDEX = new Map<string, string>();
for (const [canonicalName, info] of Object.entries(SERVICE_CATALOG)) {
  for (const name of [canonicalName, info.displayName, ...info.aliases]) {
    SERVICE_NAME_INDEX.set(name.trim().toLowerCase(), canonicalName);
  }
}

export function resolveServiceName(name: string): string | null {
  return SERVICE_NAME_INDEX.get(name.trim().toLowerCase()) ?? null;
}

export function getCategories(): string[] {
  return [...new Set(Object.values(SERVICE_CATALOG).map(service => service.category))].sort();
}

export function getServicesByCategory(category: string): Record<string, ServiceInfo> {
  return Object.fromEntries(
    Object.entries(SERVICE_CATALOG).filter(([, service]) => service.category === category),
  );
}
