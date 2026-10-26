// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Pricing across AI generations and refinements.
 *
 * Two jobs, both pure so they can be tested without the pricing catalog:
 *
 * 1. Keep what the user chose. A Guided Chat refinement regenerates the whole
 *    architecture, and the app used to re-price every node at its catalog
 *    default, silently undoing tiers, instance counts and custom prices set with
 *    the price badge. `pricingToCarryForward` decides which nodes keep their
 *    previous pricing.
 *
 * 2. Apply what the user asked for. The generation contract lets the model
 *    return `services[].pricing = { tier, quantity }` when the request names a
 *    tier or an instance count ("make API Management Standard v2", "run 3 App
 *    Service instances"). `readPricingRequest` validates that intent,
 *    `matchTier` resolves it against the service's catalog tiers, and
 *    `describePricingChange` writes the line shown in the change review.
 */

import type { NodePricingConfig, PricingTier } from '../types/pricing';

export interface PricingRequest {
  tier?: string;
  quantity?: number;
}

export interface PricingChange {
  serviceId: string;
  serviceName: string;
  status: 'applied' | 'unknown-tier' | 'not-tiered' | 'custom-price-kept';
  fromTier?: string;
  toTier?: string;
  fromQuantity?: number;
  toQuantity?: number;
  /** Monthly delta in USD (PAYG, quantity included). */
  monthlyDelta?: number;
  /** For unknown-tier: the tier the user asked for and the valid choices. */
  requestedTier?: string;
  validTiers?: string[];
}

const MAX_QUANTITY = 1000;

/** Validate the model's optional `pricing` object on a service. Returns null when there is nothing usable. */
export function readPricingRequest(value: unknown): PricingRequest | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const tier = typeof raw.tier === 'string' && raw.tier.trim() ? raw.tier.trim().slice(0, 80) : undefined;
  const quantityValue = typeof raw.quantity === 'string' ? Number(raw.quantity) : raw.quantity;
  const quantity = typeof quantityValue === 'number' && Number.isFinite(quantityValue)
    ? Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantityValue)))
    : undefined;
  if (!tier && quantity === undefined) return null;
  return { ...(tier ? { tier } : {}), ...(quantity !== undefined ? { quantity } : {}) };
}

const compact = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Resolve a requested tier against catalog tiers. Exact name/SKU first, then a
 * punctuation- and case-insensitive match, then a match on the tier name before
 * any parenthesised description ("S1 (Standard)" ← "s1"). Deliberately does not
 * strip words like "standard": "Standard" and "Standard v2" are different API
 * Management tiers.
 */
export function matchTier(tiers: PricingTier[], requested: string): PricingTier | undefined {
  const want = String(requested || '').trim();
  if (!want) return undefined;
  const exact = tiers.find((t) => t.name === want || t.skuName === want);
  if (exact) return exact;
  const key = compact(want);
  const loose = tiers.find((t) => compact(t.name) === key || compact(t.skuName) === key);
  if (loose) return loose;
  const head = (name: string) => compact(name.replace(/\(.*\)/, ''));
  return tiers.find((t) => head(t.name) === key);
}

/** Distinct, readable tier choices for an error message. */
export function tierChoices(tiers: PricingTier[], limit = 12): string[] {
  const names: string[] = [];
  for (const t of tiers) {
    const name = t.skuName || t.name;
    if (name && !names.includes(name)) names.push(name);
    if (names.length >= limit) break;
  }
  return names;
}

interface NodeLike {
  id: string;
  type?: string;
  data?: { label?: unknown; pricing?: NodePricingConfig | null };
}

interface ServiceLike {
  id: string;
  name: string;
}

const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();

/**
 * Previous pricing to keep for each generated service, keyed by the generated
 * service id. A service keeps its pricing when it matches a previous node by id
 * (or, when the AI regenerated ids, by name) and is still the same service.
 * Each previous node is used at most once, so a second instance of a service
 * gets fresh pricing.
 */
export function pricingToCarryForward(
  previousNodes: NodeLike[],
  services: ServiceLike[],
): Map<string, NodePricingConfig> {
  const carried = new Map<string, NodePricingConfig>();
  const candidates = previousNodes.filter((n) => n.type === 'azureNode' && n.data?.pricing);
  const used = new Set<string>();

  const take = (service: ServiceLike, node: NodeLike | undefined) => {
    if (!node || used.has(node.id) || norm(node.data?.label) !== norm(service.name)) return false;
    used.add(node.id);
    carried.set(service.id, node.data!.pricing as NodePricingConfig);
    return true;
  };

  const byId = new Map(candidates.map((n) => [n.id, n]));
  const unmatched = services.filter((service) => !take(service, byId.get(service.id)));
  for (const service of unmatched) {
    take(service, candidates.find((n) => !used.has(n.id) && norm(n.data?.label) === norm(service.name)));
  }
  return carried;
}

/** Monthly PAYG cost of a pricing config, quantity included. */
export function monthlyCost(pricing: Pick<NodePricingConfig, 'estimatedCost' | 'quantity'> | null | undefined): number {
  if (!pricing) return 0;
  return (Number(pricing.estimatedCost) || 0) * (Number(pricing.quantity) || 1);
}

const money = (value: number) => `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** One change-review line for a pricing change requested in chat. */
export function describePricingChange(change: PricingChange): string {
  const who = change.serviceName;
  if (change.status === 'unknown-tier') {
    const choices = change.validTiers?.length ? ` Available tiers: ${change.validTiers.join(', ')}.` : '';
    return `- ${who}: tier "${change.requestedTier}" isn't in the price catalog, so the tier was not changed.${choices}`;
  }
  if (change.status === 'not-tiered') {
    return `- ${who}: priced by usage, so there is no tier to change. Set a custom price with its price badge if you have one.`;
  }
  if (change.status === 'custom-price-kept') {
    return `- ${who}: kept your custom price. Clear it with the price badge to use catalog tiers.`;
  }
  const parts: string[] = [];
  if (change.toTier && change.toTier !== change.fromTier) parts.push(`${change.fromTier || 'default'} → ${change.toTier}`);
  if (change.toQuantity && change.toQuantity !== change.fromQuantity) {
    parts.push(`${change.fromQuantity ?? 1} → ${change.toQuantity} instance${change.toQuantity === 1 ? '' : 's'}`);
  }
  if (parts.length === 0) {
    const count = change.toQuantity && change.toQuantity > 1 ? ` × ${change.toQuantity}` : '';
    return `- ${who}: ${change.toTier || 'catalog'} tier${count}, as requested.`;
  }
  const delta = change.monthlyDelta ?? 0;
  const cost = Math.abs(delta) < 0.005 ? 'no cost change' : `${delta > 0 ? '+' : '−'}${money(delta)}/mo`;
  return `- ${who}: ${parts.join(', ')} · ${cost}.`;
}
