/**
 * Scene import — accept AADB's *current* JSON export (a ReactFlow scene) and
 * convert it into the az-prototype manifest shape the promoter understands.
 *
 * AADB's `saveDiagram()` writes `reactFlowInstance.toObject()` (nodes, edges,
 * viewport) plus metadata/workflow/architecturePrompt. There is NO schemaVersion
 * field, and a node's Azure service identity lives in `data.iconPath`
 * (icon-file stem) and `data.label` — not a canonical `type` field. We resolve
 * each node back to a service kind using, in priority order:
 *   1. exact icon-file stem   (e.g. "azure-openai")
 *   2. keyword within the stem (e.g. "...container-apps...")
 *   3. the node label / alias  (e.g. "AI Search")
 */
import type { z } from "zod";
import type { serviceKindSchema } from "../manifest/schema.js";
import type { AadbManifest, AadbService, AadbConnection } from "./aadbManifest.js";
import { parseAadbManifest } from "./aadbManifest.js";
import { mapAadbService, mapIconStem, mapKind, type ServiceMapEntry } from "./serviceMap.js";

type ServiceKind = z.infer<typeof serviceKindSchema>;

/** Loose shape of a ReactFlow scene as exported by AADB. */
interface RfNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  parentNode?: string;
  data?: {
    label?: string;
    iconPath?: string;
    category?: string;
    description?: string;
    isGroup?: boolean;
  };
}
interface RfEdge {
  source: string;
  target: string;
  label?: string;
  data?: { connectionType?: "sync" | "async" | "optional" };
}
export interface ReactFlowScene {
  nodes: RfNode[];
  edges?: RfEdge[];
  metadata?: { architectureName?: string; savedAt?: string; author?: string };
  workflow?: Array<{ step: number; description: string; services: string[] }>;
  architecturePrompt?: string;
}

/** Substring keywords (checked against icon stem, then label) -> service kind. */
const KEYWORD_TO_KIND: Array<[string, ServiceKind]> = [
  ["openai", "azureOpenAI"],
  ["gpt", "azureOpenAI"],
  ["cognitive-search", "aiSearch"],
  ["ai-search", "aiSearch"],
  ["cognitive-services", "aiFoundry"],
  ["foundry", "aiFoundry"],
  ["ai-studio", "aiFoundry"],
  ["cosmos", "cosmosDb"],
  ["sql-database", "sqlDatabase"],
  ["postgres", "postgresql"],
  ["mysql", "mysql"],
  ["redis", "redis"],
  ["blob", "storageAccount"],
  ["storage", "storageAccount"],
  ["key-vault", "keyVault"],
  ["keyvault", "keyVault"],
  ["container-registry", "containerRegistry"],
  ["event-hub", "eventHubs"],
  ["service-bus", "serviceBus"],
  ["kubernetes", "aks"],
  ["container-app", "containerAppsEnvironment"],
  ["container-instance", "containerInstances"],
  ["function", "functions"],
  ["virtual-machine", "virtualMachine"],
  ["application-gateway", "applicationGateway"],
  ["api-management", "apiManagement"],
  ["application-insights", "applicationInsights"],
  ["app-insights", "applicationInsights"],
  ["log-analytics", "logAnalytics"],
  ["app-service", "appService"],
  ["appservice", "appService"],
];

/** Extract the lowercased icon-file stem from an iconPath. */
function stemOf(iconPath?: string): string {
  if (!iconPath) return "";
  const base = iconPath.split("/").pop() ?? "";
  return base.replace(/\.svg$/i, "").toLowerCase();
}

/** Resolve a scene node to a studio service entry, or undefined if unknown. */
export function resolveNodeKind(
  iconPath?: string,
  label?: string,
): ServiceMapEntry | undefined {
  const stem = stemOf(iconPath);
  if (stem) {
    const byStem = mapIconStem(stem);
    if (byStem) return byStem;
    for (const [kw, kind] of KEYWORD_TO_KIND) {
      if (stem.includes(kw)) return mapKind(kind);
    }
  }
  if (label) {
    const byLabel = mapAadbService(label);
    if (byLabel) return byLabel;
    const l = label.toLowerCase();
    for (const [kw, kind] of KEYWORD_TO_KIND) {
      if (l.includes(kw)) return mapKind(kind);
    }
  }
  return undefined;
}

/** True if the value looks like a ReactFlow scene export from AADB. */
export function isReactFlowScene(value: unknown): value is ReactFlowScene {
  if (!value || typeof value !== "object") return false;
  const v = value as { nodes?: unknown };
  if (!Array.isArray(v.nodes) || v.nodes.length === 0) return false;
  const first = v.nodes[0] as RfNode;
  return typeof first?.id === "string" && (!!first.data || !!first.position);
}

function isGroupNode(n: RfNode): boolean {
  return n.type === "groupNode" || n.data?.isGroup === true;
}

/**
 * Convert a ReactFlow scene into an az-prototype manifest so it can flow through
 * the existing promoter. Unresolved services keep their label as `type`, which
 * the promoter then reports as unmapped rather than dropping.
 */
export function sceneToAadbManifest(scene: ReactFlowScene): AadbManifest {
  const nodes = scene.nodes ?? [];
  const nameById = new Map<string, string>();
  for (const n of nodes) nameById.set(n.id, n.data?.label ?? n.id);

  const groups = nodes
    .filter(isGroupNode)
    .map((n) => ({ id: n.id, label: n.data?.label ?? n.id }));

  const services: AadbService[] = [];
  for (const n of nodes) {
    if (isGroupNode(n)) continue;
    if (!n.data) continue; // skip annotations / non-service nodes
    const entry = resolveNodeKind(n.data.iconPath, n.data.label);
    const label = n.data.label ?? n.id;
    services.push({
      id: n.id,
      name: label,
      type: entry ? entry.aadbType : label,
      category: n.data.category ?? entry?.aadbCategory ?? "other",
      description: n.data.description ?? "",
      groupId: n.parentNode ?? null,
    });
  }

  const connections: AadbConnection[] = (scene.edges ?? []).map((e) => ({
    from: nameById.get(e.source) ?? e.source,
    to: nameById.get(e.target) ?? e.target,
    label: e.label ?? "",
    type: e.data?.connectionType ?? "sync",
  }));

  return parseAadbManifest({
    schemaVersion: "1.0",
    source: "azure-diagram-builder",
    createdAt: scene.metadata?.savedAt ?? new Date().toISOString(),
    project: {
      name: scene.metadata?.architectureName || "Imported AADB diagram",
      location: "eastus2",
      iacTool: "bicep",
    },
    architecture: {
      services,
      connections,
      groups,
      workflow: scene.workflow ?? [],
    },
  });
}
