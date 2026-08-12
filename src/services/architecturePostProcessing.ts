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

  const connectedIds = new Set<string>();
  architecture.connections.forEach((connection: any) => {
    connectedIds.add(String(connection.from));
    connectedIds.add(String(connection.to));
  });
  const orphans = architecture.services.filter(
    (service: any) => !connectedIds.has(String(service.id)),
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
    orphanCount: orphans.length,
    orphanServices: orphans.map((service: any) => String(service.name || service.id)),
  };

  return architecture;
}
