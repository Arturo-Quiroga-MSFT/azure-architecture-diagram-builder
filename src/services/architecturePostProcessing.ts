// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getServiceIconMapping } from '../data/serviceIconMapping';

export interface ArchitectureProcessingLogger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

const defaultLogger: ArchitectureProcessingLogger = {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
};

const SHARED_SERVICE_PRODUCTS = new Set([
  'Azure Container Apps',
  'Service Bus',
]);

const CONNECTION_TYPES = new Set(['sync', 'async', 'optional', 'association', 'containment']);

const serviceText = (service: any): string => `${service?.name || ''} ${service?.type || ''}`.toLowerCase();
const isFrontDoor = (service: any): boolean => /\bfront door\b/.test(serviceText(service));
const isWafPolicy = (service: any): boolean => /web application firewall|\bwaf\b/.test(serviceText(service));
const isPrivateConnectivity = (service: any): boolean => /private link|private endpoint/.test(serviceText(service));
const isVirtualNetwork = (service: any): boolean => /virtual network|\bvnet\b/.test(serviceText(service));
const isPrivateDnsZone = (service: any): boolean => /private dns|dns zone/.test(serviceText(service));
const isNetworkContainer = (service: any): boolean => (
  isVirtualNetwork(service)
  || /\bsubnet\b|private dns|dns zone|vnet integration/.test(serviceText(service))
);

// One shared boundary for the whole diagram, however many resources it
// protects, instead of a node and up to three edges per protected resource.
const PRIVATE_CONNECTIVITY_GROUP_ID = 'private-connectivity';

function repairSemanticRelationships(architecture: any, logger: ArchitectureProcessingLogger): number {
  const servicesById = new Map<string, any>(
    architecture.services.map((service: any) => [String(service.id), service]),
  );
  let repairs = 0;

  const frontDoor = architecture.services.find(isFrontDoor);
  const wafPolicies = architecture.services.filter(isWafPolicy);
  if (frontDoor && wafPolicies.length > 0) {
    for (const policy of wafPolicies) {
      policy.name = 'Front Door WAF Policy';
      policy.type = 'Web Application Firewall';
      policy.category = 'security';
      policy.groupId = frontDoor.groupId ?? policy.groupId ?? null;
      policy.description = policy.description
        || 'WAF policy associated with Azure Front Door for edge request inspection.';

      let association = architecture.connections.find((connection: any) => (
        (String(connection.from) === String(policy.id) && String(connection.to) === String(frontDoor.id))
        || (String(connection.from) === String(frontDoor.id) && String(connection.to) === String(policy.id))
      ));
      if (!association) {
        association = {};
        architecture.connections.push(association);
      }
      Object.assign(association, {
        from: policy.id,
        to: frontDoor.id,
        label: 'WAF policy associated with Front Door route',
        type: 'association',
      });

      for (const connection of architecture.connections) {
        if (connection === association) continue;
        if (String(connection.from) === String(policy.id)) {
          connection.from = frontDoor.id;
          repairs++;
        }
        if (String(connection.to) === String(policy.id)) {
          connection.to = frontDoor.id;
          repairs++;
        }
      }
      repairs++;
      logger.warn('Repaired Front Door WAF as a policy association instead of a request-flow hop');
    }
  }

  const privateConnectivityServices = architecture.services.filter(isPrivateConnectivity);
  const protectedTargets = new Map<string, any>();
  for (const privateConnectivity of privateConnectivityServices) {
    const related = architecture.connections.filter((connection: any) => (
      String(connection.from) === String(privateConnectivity.id)
      || String(connection.to) === String(privateConnectivity.id)
    ));
    const eligibleTarget = (id: string): boolean => {
      const service = servicesById.get(id);
      return Boolean(
        service
        && !isNetworkContainer(service)
        && !isFrontDoor(service)
        && !isPrivateConnectivity(service),
      );
    };
    const outgoingTargetIds = related
      .filter((connection: any) => String(connection.from) === String(privateConnectivity.id))
      .map((connection: any) => String(connection.to))
      .filter(eligibleTarget);
    const incomingTargetIds = related
      .filter((connection: any) => String(connection.to) === String(privateConnectivity.id))
      .map((connection: any) => String(connection.from))
      .filter(eligibleTarget);
    const targetIds: string[] = [
      ...new Set<string>(outgoingTargetIds.length > 0 ? outgoingTargetIds : incomingTargetIds),
    ];

    if (outgoingTargetIds.length > 0 && incomingTargetIds.length > 0) {
      for (const sourceId of [...new Set<string>(incomingTargetIds)]) {
        for (const targetId of [...new Set<string>(outgoingTargetIds)]) {
          if (sourceId === targetId) continue;
          const alreadyConnected = architecture.connections.some((connection: any) => (
            !related.includes(connection)
            && String(connection.from) === sourceId
            && String(connection.to) === targetId
          ));
          if (alreadyConnected) continue;
          const target = servicesById.get(targetId);
          architecture.connections.push({
            from: sourceId,
            to: targetId,
            label: `Connect privately to ${target?.name || targetId}`,
            type: 'sync',
          });
          repairs++;
        }
      }
    }

    architecture.connections = architecture.connections.filter((connection: any) => !related.includes(connection));

    // The connector itself never survives as a canvas node: it is either
    // orphaned (no protected resource) or folded into the shared group below.
    architecture.services = architecture.services.filter(
      (service: any) => String(service.id) !== String(privateConnectivity.id),
    );
    servicesById.delete(String(privateConnectivity.id));
    repairs += related.length;

    if (Array.isArray(architecture.workflow)) {
      architecture.workflow.forEach((step: any) => {
        if (!Array.isArray(step.services)) return;
        step.services = step.services.filter((id: unknown) => String(id) !== String(privateConnectivity.id));
      });
    }

    if (targetIds.length === 0) {
      logger.warn('Removed Private Link connector with no protected resource target');
      continue;
    }

    targetIds.forEach((targetId) => {
      const target = servicesById.get(targetId);
      if (target) protectedTargets.set(targetId, target);
    });
    logger.warn(`Folded Azure Private Link connector into the Private Connectivity group (${targetIds.length} protected resource(s))`);
  }

  if (protectedTargets.size > 0) {
    const names = [...protectedTargets.values()].map((target: any) => target.name).sort((a, b) => a.localeCompare(b));
    const note = names.length === 1
      ? `Private endpoints: ${names[0]}`
      : `Private endpoints: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

    let virtualNetwork = architecture.services.find(isVirtualNetwork);
    if (!virtualNetwork) {
      virtualNetwork = { id: 'private-connectivity-vnet', name: 'Virtual Network', type: 'Virtual Network', category: 'networking' };
      architecture.services.push(virtualNetwork);
      servicesById.set(String(virtualNetwork.id), virtualNetwork);
    }

    // Reuse whichever group the Virtual Network already belongs to — that
    // respects a boundary the model (or the user) already built around it.
    // Only invent a fresh one when the VNet has none.
    const groupId = virtualNetwork.groupId || PRIVATE_CONNECTIVITY_GROUP_ID;
    let group = architecture.groups.find((candidate: any) => candidate.id === groupId);
    if (!group) {
      group = { id: groupId, label: 'Private Connectivity' };
      architecture.groups.push(group);
    }
    group.note = note;
    virtualNetwork.groupId = groupId;

    let privateDnsZone = architecture.services.find(isPrivateDnsZone);
    if (!privateDnsZone) {
      privateDnsZone = { id: 'private-connectivity-dns', name: 'Private DNS Zone', type: 'Private DNS Zone', category: 'networking' };
      architecture.services.push(privateDnsZone);
      servicesById.set(String(privateDnsZone.id), privateDnsZone);
    }
    privateDnsZone.groupId = groupId;

    // One named Private Link node per protected resource, contained in the
    // same group as the VNet/DNS Zone. No edges to the VNet or to the actual
    // resource elsewhere on canvas — membership in the group is what says
    // "this belongs to the boundary", same as the group's own note does at a
    // glance. This is what makes each protected resource individually visible
    // (and its name individually readable) without redrawing a line to it.
    for (const [targetId, target] of protectedTargets) {
      const linkId = `private-link-${targetId}`;
      let link = servicesById.get(linkId);
      if (!link) {
        link = { id: linkId, name: `Private Link - ${target.name}`, type: 'Azure Private Link', category: 'networking' };
        architecture.services.push(link);
        servicesById.set(linkId, link);
      }
      link.groupId = groupId;
    }

    repairs++;
  }

  // A model that ignores the new instructions may still emit this exact edge
  // on its own (it never touches a Private Endpoint node, so the loop above
  // never sees it). Its meaning is now carried by the boundary's note instead.
  const outboundPrivateAccessCount = architecture.connections.length;
  architecture.connections = architecture.connections.filter(
    (connection: any) => !/vnet integration for outbound private access/i.test(String(connection.label ?? '')),
  );
  repairs += outboundPrivateAccessCount - architecture.connections.length;

  architecture.connections.forEach((connection: any) => {
    if (!CONNECTION_TYPES.has(connection.type)) {
      connection.type = 'sync';
    }
  });
  return repairs;
}

export function postProcessArchitecture(
  architecture: any,
  logger: ArchitectureProcessingLogger = defaultLogger,
): any {
  if (architecture.services && Array.isArray(architecture.services)) {
    architecture.services = architecture.services.map((service: any) => {
      const mapping = getServiceIconMapping(service.name) || getServiceIconMapping(service.type);
      if (mapping) {
        logger.log(`Normalized "${service.name}" -> "${mapping.displayName}" (${mapping.category})`);
        return {
          ...service,
          name: mapping.displayName,
          type: mapping.displayName,
          category: mapping.category,
        };
      }
      return service;
    });
  }

  if (!architecture.services || !Array.isArray(architecture.services)) {
    throw new Error('Invalid response format: missing services array');
  }

  if (!architecture.connections || !Array.isArray(architecture.connections)) {
    architecture.connections = [];
  }

  if (!architecture.groups || !Array.isArray(architecture.groups)) {
    architecture.groups = [];
  }

  const canonicalServiceIds = new Map<string, string>();
  let mergedServices = 0;
  architecture.services = architecture.services.filter((service: any) => {
    const product = String(service.name ?? service.type ?? '');
    if (!SHARED_SERVICE_PRODUCTS.has(product)) return true;
    const key = `${String(service.groupId ?? '')}\u0000${product}`;
    const canonicalId = canonicalServiceIds.get(key);
    if (!canonicalId) {
      canonicalServiceIds.set(key, String(service.id));
      return true;
    }
    canonicalServiceIds.set(String(service.id), canonicalId);
    mergedServices++;
    return false;
  });
  if (mergedServices > 0) {
    const canonicalId = (value: unknown) => canonicalServiceIds.get(String(value)) ?? String(value);
    architecture.connections.forEach((connection: any) => {
      connection.from = canonicalId(connection.from);
      connection.to = canonicalId(connection.to);
    });
    if (Array.isArray(architecture.workflow)) {
      architecture.workflow.forEach((step: any) => {
        if (!Array.isArray(step.services)) return;
        step.services = [...new Set(step.services.map(canonicalId))];
      });
    }
    logger.warn(`Merged ${mergedServices} duplicate shared-service node(s)`);
  }

  architecture.groups = architecture.groups.map((group: any) => {
    if (typeof group === 'string') {
      return {
        id: group,
        label: group
          .split('-')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      };
    }
    const { groupId: _groupId, ...cleanGroup } = group;
    return cleanGroup;
  });

  const groupIds = new Set(architecture.groups.map((group: any) => group.id));
  const serviceIds = new Set(architecture.services.map((service: any) => service.id));

  for (const groupId of groupIds) {
    if (serviceIds.has(groupId)) {
      logger.warn(`Group ID "${groupId}" collides with a service ID; prefixing group`);
      const group = architecture.groups.find((candidate: any) => candidate.id === groupId);
      const newId = `group-${groupId}`;
      group.id = newId;
      architecture.services.forEach((service: any) => {
        if (service.groupId === groupId) service.groupId = newId;
      });
    }
  }

  const validGroupIds = new Set(architecture.groups.map((group: any) => group.id));
  architecture.services.forEach((service: any) => {
    if (service.groupId && !validGroupIds.has(service.groupId)) {
      logger.warn(`Service "${service.id}" references unknown group "${service.groupId}"; clearing`);
      service.groupId = null;
    }
  });

  const slug = (value: unknown) => String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const serviceIdSet = new Set<string>(
    architecture.services.map((service: any) => String(service.id)),
  );
  const aliasToId = new Map<string, string>();
  for (const service of architecture.services) {
    for (const alias of [service.id, service.name, service.type]) {
      const key = slug(alias);
      if (key && !aliasToId.has(key)) aliasToId.set(key, String(service.id));
    }
  }

  const resolveEndpoint = (reference: unknown): string | null => {
    const raw = String(reference ?? '');
    if (serviceIdSet.has(raw)) return raw;
    return aliasToId.get(slug(raw)) ?? null;
  };

  let repairedEdges = 0;
  let droppedEdges = 0;
  architecture.connections = architecture.connections.filter((connection: any) => {
    const from = resolveEndpoint(connection.from);
    const to = resolveEndpoint(connection.to);
    if (!from || !to || from === to) {
      logger.warn(
        `Dropping connection "${connection.from}" -> "${connection.to}" (unresolvable or self-referencing endpoint)`,
      );
      droppedEdges++;
      return false;
    }
    if (from !== connection.from || to !== connection.to) {
      logger.warn(
        `Repaired connection endpoint "${connection.from}" -> "${from}", "${connection.to}" -> "${to}"`,
      );
      repairedEdges++;
      connection.from = from;
      connection.to = to;
    }
    return true;
  });

  const semanticRepairs = repairSemanticRelationships(architecture, logger);

  // Semantic repair can redirect policy hops onto an existing request-flow
  // pair, so remove any self-references before pair de-duplication.
  architecture.connections = architecture.connections.filter((connection: any) => (
    String(connection.from) !== String(connection.to)
  ));

  // Parallel connections resolve to the same two handles, so they stack into
  // overlapping lines whose labels collide. The full text stays on the chip's
  // tooltip even when the merged label clamps.
  let mergedEdges = 0;
  const byPair = new Map<string, any>();
  architecture.connections.forEach((connection: any) => {
    const key = [String(connection.from), String(connection.to)].sort().join('\u0000');
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, connection);
      return;
    }
    const labels = new Set(
      [...String(existing.label ?? '').split(' · '), String(connection.label ?? '')]
        .map((value: string) => value.trim())
        .filter(Boolean),
    );
    existing.label = [...labels].join(' · ');
    mergedEdges++;
  });
  if (mergedEdges > 0) {
    logger.warn(
      `Merged ${mergedEdges} duplicate connection(s) between service pairs that were already linked`,
    );
    architecture.connections = [...byPair.values()];
  }

  const connectedIds = new Set<string>();
  architecture.connections.forEach((connection: any) => {
    connectedIds.add(String(connection.from));
    connectedIds.add(String(connection.to));
  });
  // The Private Connectivity boundary is deliberately unconnected — the group's
  // note carries the relationship instead of an edge — so its own nodes are not
  // orphans in the sense this check exists to catch (a service the model forgot
  // to wire up). A group only gets a `.note` from that repair, whatever id it
  // has — the group may be a fresh one or an existing group the VNet already
  // belonged to, so a note is the reliable signal, not the id.
  const notedGroupIds = new Set(
    architecture.groups.filter((group: any) => group.note).map((group: any) => group.id),
  );
  const orphans = architecture.services.filter(
    (service: any) => !connectedIds.has(String(service.id)) && !notedGroupIds.has(service.groupId),
  );
  if (orphans.length > 0) {
    logger.warn(
      `${orphans.length} service(s) have no connections: ${orphans
        .map((service: any) => service.name || service.id)
        .join(', ')}`,
    );
  }

  architecture.integrity = {
    repairedEdges,
    droppedEdges,
    mergedServices,
    mergedEdges,
    orphanCount: orphans.length,
    orphanServices: orphans.map((service: any) => String(service.name || service.id)),
    semanticRepairs,
  };

  return architecture;
}
