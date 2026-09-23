// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Loose service-name → icon resolver for editorial diagrams (Reference,
 * Blueprint). The strict `getServiceIconMapping` only matches exact names
 * and explicit aliases; this helper adds substring containment so common
 * AI-emitted variations like "Logic Apps Playbooks" → Logic Apps, or
 * "Azure Functions (Worker)" → Azure Functions still resolve.
 */

import { SERVICE_ICON_MAP, getServiceIconMapping, ServiceIconMapping } from '../data/serviceIconMapping';

export function resolveServiceIconLoose(name: string): ServiceIconMapping | null {
  if (!name) return null;
  const strict = getServiceIconMapping(name);
  if (strict) return strict;

  const lower = name.toLowerCase().trim();

  // Pick the longest display-name or alias that is contained in `name`
  // (or that contains `name`, for cases like "Functions" → "Azure Functions").
  let best: ServiceIconMapping | null = null;
  let bestLen = 0;
  for (const mapping of Object.values(SERVICE_ICON_MAP)) {
    const candidates = [mapping.displayName, ...mapping.aliases];
    for (const c of candidates) {
      const cl = c.toLowerCase();
      if (cl.length < 3) continue;
      const hit = lower.includes(cl) || cl.includes(lower);
      if (hit && cl.length > bestLen) {
        best = mapping;
        bestLen = cl.length;
      }
    }
  }
  return best;
}
