/**
 * Private Link group-id mapping — the canonical sub-resource group IDs used by
 * Azure Private Endpoints, keyed by workload service kind.
 *
 * Sources: Azure Private Link resource reference. These group IDs are required
 * by both the AVM Bicep and Terraform private-endpoint modules.
 */
import type { z } from "zod";
import type { serviceKindSchema } from "./schema.js";

type ServiceKind = z.infer<typeof serviceKindSchema>;

export interface PrivateLinkMapping {
  /** Private Link sub-resource group ID (a.k.a. groupId / subresource name). */
  groupId: string;
  /** A stable default memberName for static IP configuration. */
  memberName: string;
}

const MAP: Partial<Record<ServiceKind, PrivateLinkMapping>> = {
  azureOpenAI: { groupId: "account", memberName: "default" },
  aiFoundry: { groupId: "account", memberName: "default" },
  aiSearch: { groupId: "searchService", memberName: "searchService" },
  storageAccount: { groupId: "blob", memberName: "blob" },
  cosmosDb: { groupId: "Sql", memberName: "Sql" },
  sqlDatabase: { groupId: "sqlServer", memberName: "sqlServer" },
  postgresql: { groupId: "postgresqlServer", memberName: "postgresqlServer" },
  mysql: { groupId: "mysqlServer", memberName: "mysqlServer" },
  redis: { groupId: "redisCache", memberName: "redisCache" },
  keyVault: { groupId: "vault", memberName: "default" },
  containerRegistry: { groupId: "registry", memberName: "registry" },
  eventHubs: { groupId: "namespace", memberName: "namespace" },
  serviceBus: { groupId: "namespace", memberName: "namespace" },
  eventGrid: { groupId: "topic", memberName: "topic" },
  documentIntelligence: { groupId: "account", memberName: "default" },
  azureMachineLearning: { groupId: "amlworkspace", memberName: "default" },
  logicApps: { groupId: "sites", memberName: "sites" },
};

/** Look up the Private Link mapping for a service kind, or a safe fallback. */
export function privateLinkFor(kind: ServiceKind): PrivateLinkMapping {
  return MAP[kind] ?? { groupId: "default", memberName: "default" };
}
