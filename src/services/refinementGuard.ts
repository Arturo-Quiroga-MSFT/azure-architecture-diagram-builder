import { getServiceIconMapping, SERVICE_ICON_MAP, type ServiceIconMapping } from '../data/serviceIconMapping';
import type { CurrentArchitecture } from './modificationPrompt';

interface ServiceRecord {
  id: string;
  name: string;
  canonicalName: string;
  mapping: ServiceIconMapping | null;
}

export interface RefinementServiceChange {
  name: string;
  canonicalName: string;
  reason: 'explicitly-requested' | 'ai-proposed' | 'removed-by-refinement';
}

export interface RefinementReview {
  isRefinement: boolean;
  request: string;
  added: RefinementServiceChange[];
  removed: RefinementServiceChange[];
  unrequestedAdditions: RefinementServiceChange[];
  addedConnections: number;
  removedConnections: number;
  addedGroups: string[];
  removedGroups: string[];
}

const normalize = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function canonicalize(name: string, type?: string): Omit<ServiceRecord, 'id'> {
  const displayNameMapping = Object.values(SERVICE_ICON_MAP).find((candidate) => (
    normalize(candidate.displayName) === normalize(name)
    || (type ? normalize(candidate.displayName) === normalize(type) : false)
  ));
  const mapping = getServiceIconMapping(name) || (type ? getServiceIconMapping(type) : null) || displayNameMapping || null;
  return {
    name,
    canonicalName: mapping?.displayName || name.trim(),
    mapping,
  };
}

function currentServices(current: CurrentArchitecture): ServiceRecord[] {
  return current.nodes
    .filter((node) => node?.type === 'azureNode')
    .map((node) => {
      const name = String(node?.data?.label || node?.data?.serviceName || node.id).trim();
      return { ...canonicalize(name), id: String(node.id) };
    });
}

function nextServices(architecture: any): ServiceRecord[] {
  return (Array.isArray(architecture?.services) ? architecture.services : [])
    .map((service: any) => {
      const name = String(service?.name ?? service?.label ?? service?.service ?? service?.type ?? '').trim();
      return { ...canonicalize(name, String(service?.type || '')), id: String(service?.id || '') };
    })
    .filter((service: ServiceRecord) => service.name && service.id);
}

function countsByCanonical(services: ServiceRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const service of services) {
    const key = normalize(service.canonicalName);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function addedInstances(previous: ServiceRecord[], next: ServiceRecord[]): ServiceRecord[] {
  const remaining = countsByCanonical(previous);
  return next.filter((service) => {
    const key = normalize(service.canonicalName);
    const count = remaining.get(key) || 0;
    if (count > 0) {
      remaining.set(key, count - 1);
      return false;
    }
    return true;
  });
}

function phraseAppears(request: string, phrase: string): boolean {
  const requestTokens = normalize(request).split(' ').filter(Boolean);
  const phraseTokens = normalize(phrase)
    .split(' ')
    .filter((token) => token && !['azure', 'microsoft', 'service', 'services'].includes(token));
  if (phraseTokens.length === 0 || phraseTokens.length > requestTokens.length) return false;
  return phraseTokens.every((token) => requestTokens.includes(token));
}

function requestAuthorizesService(request: string, service: ServiceRecord): boolean {
  const names = [service.name, service.canonicalName, ...(service.mapping?.aliases || [])];
  if (names.some((name) => phraseAppears(request, name))) return true;

  const normalizedRequest = normalize(request);
  return service.mapping?.category === 'monitor'
    && /\b(monitor|monitoring|observability|telemetry|logging|logs)\b/.test(normalizedRequest);
}

function connectionKeysFromCurrent(current: CurrentArchitecture): Set<string> {
  const names = new Map(currentServices(current).map((service) => [service.id, normalize(service.canonicalName)]));
  return new Set(current.edges.map((edge) => {
    const from = names.get(String(edge.source)) || String(edge.source);
    const to = names.get(String(edge.target)) || String(edge.target);
    return `${from}->${to}:${normalize(String(edge.label || ''))}`;
  }));
}

function connectionKeysFromNext(architecture: any): Set<string> {
  const names = new Map(nextServices(architecture).map((service) => [service.id, normalize(service.canonicalName)]));
  const connections = Array.isArray(architecture?.connections) ? architecture.connections : [];
  return new Set(connections.map((connection: any) => {
    const from = names.get(String(connection.from)) || String(connection.from);
    const to = names.get(String(connection.to)) || String(connection.to);
    return `${from}->${to}:${normalize(String(connection.label || ''))}`;
  }));
}

function differenceCount(left: Set<string>, right: Set<string>): number {
  return [...left].filter((value) => !right.has(value)).length;
}

function groupNamesFromCurrent(current: CurrentArchitecture): Set<string> {
  return new Set(current.nodes
    .filter((node) => node?.type === 'groupNode')
    .map((node) => String(node?.data?.label || node.id).trim())
    .filter(Boolean));
}

function groupNamesFromNext(architecture: any): Set<string> {
  return new Set((Array.isArray(architecture?.groups) ? architecture.groups : [])
    .map((group: any) => String(group?.label || group?.name || group?.id || '').trim())
    .filter(Boolean));
}

export function reviewRefinement(
  current: CurrentArchitecture,
  architecture: any,
  request: string,
): RefinementReview {
  const previous = currentServices(current);
  const next = nextServices(architecture);
  const previousCounts = countsByCanonical(previous);
  const additions = addedInstances(previous, next);
  const removals = addedInstances(next, previous);

  const added = additions.map((service) => {
    const existedBefore = (previousCounts.get(normalize(service.canonicalName)) || 0) > 0;
    const explicitlyRequested = existedBefore || requestAuthorizesService(request, service);
    return {
      name: service.name,
      canonicalName: service.canonicalName,
      reason: explicitlyRequested ? 'explicitly-requested' : 'ai-proposed',
    } satisfies RefinementServiceChange;
  });
  const removed = removals.map((service) => ({
    name: service.name,
    canonicalName: service.canonicalName,
    reason: 'removed-by-refinement' as const,
  }));

  const previousConnections = connectionKeysFromCurrent(current);
  const nextConnections = connectionKeysFromNext(architecture);
  const previousGroups = groupNamesFromCurrent(current);
  const nextGroups = groupNamesFromNext(architecture);

  return {
    isRefinement: previous.length > 0,
    request,
    added,
    removed,
    unrequestedAdditions: added.filter((change) => change.reason === 'ai-proposed'),
    addedConnections: differenceCount(nextConnections, previousConnections),
    removedConnections: differenceCount(previousConnections, nextConnections),
    addedGroups: [...nextGroups].filter((name) => !previousGroups.has(name)),
    removedGroups: [...previousGroups].filter((name) => !nextGroups.has(name)),
  };
}

export function removeUnrequestedServices(architecture: any, review: RefinementReview): any {
  if (review.unrequestedAdditions.length === 0) return architecture;

  const blockedNames = new Set(review.unrequestedAdditions.map((change) => normalize(change.canonicalName)));
  const blockedIds = new Set(nextServices(architecture)
    .filter((service) => blockedNames.has(normalize(service.canonicalName)))
    .map((service) => service.id));
  const clone = JSON.parse(JSON.stringify(architecture));

  clone.services = (clone.services || []).filter((service: any) => !blockedIds.has(String(service.id)));
  clone.connections = (clone.connections || []).filter((connection: any) => (
    !blockedIds.has(String(connection.from)) && !blockedIds.has(String(connection.to))
  ));
  clone.workflow = (clone.workflow || [])
    .map((step: any) => ({
      ...step,
      services: Array.isArray(step.services)
        ? step.services.filter((id: string) => !blockedIds.has(String(id)))
        : [],
    }))
    .filter((step: any) => step.services.length > 0);
  return clone;
}

export function summarizeRefinementReview(review: RefinementReview, approvedProposals = false): string {
  const lines: string[] = ['Change review:'];
  const explicitAdditions = review.added.filter((change) => change.reason === 'explicitly-requested');
  const proposedAdditions = review.added.filter((change) => change.reason === 'ai-proposed');
  const isReplacement = /\b(replace|replaced|swap|instead of|migrate from|move from)\b/i.test(review.request)
    && explicitAdditions.length > 0
    && review.removed.length > 0;

  if (review.added.length === 0 && review.removed.length === 0) {
    lines.push('- Services: no service types added or removed.');
  } else {
    if (isReplacement) {
      lines.push(`- Replaced ${review.removed.map((change) => change.name).join(', ')} with ${explicitAdditions.map((change) => change.name).join(', ')} — explicitly requested.`);
    } else {
      for (const addition of explicitAdditions) {
        lines.push(`- Added ${addition.name} — explicitly requested or an additional instance of an existing service.`);
      }
      for (const removal of review.removed) {
        lines.push(`- Removed ${removal.name} — removed by the generated refinement while applying “${review.request}”.`);
      }
    }
    if (approvedProposals) {
      for (const addition of proposedAdditions) {
        lines.push(`- Added ${addition.name} — AI-proposed; approved by you.`);
      }
    }
  }

  lines.push(`- Connections: ${review.addedConnections} added, ${review.removedConnections} removed or replaced.`);
  if (review.addedGroups.length || review.removedGroups.length) {
    lines.push(`- Groups: ${review.addedGroups.length} added, ${review.removedGroups.length} removed.`);
  }
  return lines.join('\n');
}