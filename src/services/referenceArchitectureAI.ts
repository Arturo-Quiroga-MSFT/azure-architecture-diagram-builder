// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Reference Architecture (Editorial) generation mode.
 *
 * Produces a "swim-lane" / banded reference-architecture diagram in the style
 * of the official Microsoft Azure Architecture Center diagrams.
 *
 * Week 1: this module emits a NEW schema (ReferenceArchitecture) and ships a
 * transform (referenceToTopology) that maps it into the existing
 * {groups, services, connections, workflow} shape so the current render
 * pipeline can display it. The bespoke banded layout + editorial visual theme
 * arrive in Weeks 2–3.
 */

import { callAzureOpenAI, ModelOverride, AIMetrics } from './azureOpenAI';
import { getServiceIconMapping } from '../data/serviceIconMapping';
import { MODEL_CONFIG, getModelSettings } from '../stores/modelSettingsStore';

// ──────────────────────────────────────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────────────────────────────────────

export interface RefService {
  id: string;
  name: string;          // Azure / MS product display name
  category: string;      // matches existing icon categories
  description?: string;
}

export interface RefStage {
  id: string;            // e.g. "ingest", "process", "model", "serve"
  label: string;         // e.g. "Ingest" | "Process, enrich, store"
  services: RefService[];
}

export interface RefPathBand {
  id: string;            // e.g. "hot", "cool"
  label: string;         // "Hot path" | "Cool path"
  color: 'pink' | 'blue' | 'green' | 'amber';
  stages: string[];      // stage ids this band spans
}

export interface RefDataSourceGroup {
  category: string;      // e.g. "Business applications", "Databases", "Files and API"
  items: string[];       // e.g. ["Application A", "Database 1"]
}

export interface RefActor {
  id: string;
  label: string;         // e.g. "Users"
  icon?: 'users' | 'person' | 'external-system';
}

export interface RefConnection {
  from: string;          // service id, datasource synth id, or actor id
  to: string;
  label?: string;
  band?: string;         // path band id (used for routing in Week 2)
  type?: 'sync' | 'async' | 'optional';
}

export interface RefWorkflowStep {
  step: number;
  description: string;
  services: string[];
}

export interface ReferenceArchitecture {
  title: string;
  platformWrappers?: string[];     // e.g. ["Microsoft Fabric", "Fabric Copilot"]
  stages: RefStage[];
  pathBands?: RefPathBand[];
  dataSources?: RefDataSourceGroup[];
  actors?: RefActor[];
  foundation?: string[];           // bottom strip e.g. ["OneLake"]
  crossCutting?: string[];         // very-bottom strip e.g. ["Entra","Purview","Defender"]
  connections: RefConnection[];
  workflow?: RefWorkflowStep[];
  metrics?: AIMetrics;
}

// ──────────────────────────────────────────────────────────────────────────────
// Few-shot examples (compact AAC-style reference architectures)
// ──────────────────────────────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLES = `
EXAMPLE 1 — Microsoft Fabric Medallion Lakehouse (data analytics):
{
  "title": "Microsoft Fabric Medallion Lakehouse",
  "platformWrappers": ["Microsoft Fabric", "Fabric Copilot"],
  "stages": [
    {
      "id": "ingest", "label": "Ingest",
      "services": [
        { "id": "shortcuts", "name": "OneLake Shortcuts", "category": "analytics" },
        { "id": "copy-jobs", "name": "Copy Jobs", "category": "integration" },
        { "id": "pipeline", "name": "Data Factory Pipeline", "category": "integration" },
        { "id": "dataflow", "name": "Dataflow Gen2", "category": "analytics" },
        { "id": "mirroring", "name": "Mirroring", "category": "databases" },
        { "id": "eventstream", "name": "Eventstream", "category": "analytics" }
      ]
    },
    {
      "id": "process", "label": "Process, enrich, store",
      "services": [
        { "id": "lake-bronze", "name": "Lakehouse (Bronze)", "category": "analytics" },
        { "id": "lake-silver", "name": "Lakehouse (Silver)", "category": "analytics" },
        { "id": "warehouse-gold", "name": "Warehouse (Gold)", "category": "analytics" },
        { "id": "spark-nb1", "name": "Spark Notebook", "category": "analytics" },
        { "id": "spark-nb2", "name": "Spark Notebook", "category": "analytics" },
        { "id": "experiment", "name": "ML Experiment", "category": "ai + machine learning" },
        { "id": "ml-model", "name": "ML Model", "category": "ai + machine learning" },
        { "id": "mirrored-db", "name": "Mirrored Database", "category": "databases" },
        { "id": "eventhouse", "name": "Eventhouse", "category": "analytics" }
      ]
    },
    {
      "id": "model", "label": "Model",
      "services": [
        { "id": "sem-direct-lake", "name": "Semantic Model (Direct Lake)", "category": "analytics" },
        { "id": "sem-direct-query", "name": "Semantic Model (Direct Query)", "category": "analytics" },
        { "id": "ontology", "name": "Ontology", "category": "analytics" }
      ]
    },
    {
      "id": "serve", "label": "Serve",
      "services": [
        { "id": "api-graphql", "name": "API for GraphQL", "category": "integration" },
        { "id": "report-interactive", "name": "Interactive Report", "category": "analytics" },
        { "id": "report-paginated", "name": "Paginated Report", "category": "analytics" },
        { "id": "data-agent", "name": "Data Agent", "category": "ai + machine learning" },
        { "id": "rt-dashboard", "name": "Real-Time Dashboard", "category": "analytics" },
        { "id": "kql-queryset", "name": "KQL Queryset", "category": "analytics" },
        { "id": "activator", "name": "Activator", "category": "analytics" }
      ]
    }
  ],
  "pathBands": [
    { "id": "cool", "label": "Cool path", "color": "blue", "stages": ["ingest","process","model","serve"] },
    { "id": "hot",  "label": "Hot path",  "color": "pink", "stages": ["ingest","process","model","serve"] }
  ],
  "dataSources": [
    { "category": "Business applications", "items": ["Application A","Application B","Application C"] },
    { "category": "Databases", "items": ["Database 1","Database N"] },
    { "category": "Files and API", "items": ["Apps and APIs","File servers","SFTP","Object storage (ADLS, S3, GCS)"] },
    { "category": "Events and messaging", "items": ["IoT devices","Kafka","OT systems","Historians","Event Hubs","Database change data"] }
  ],
  "actors": [{ "id": "users", "label": "Users", "icon": "users" }],
  "foundation": ["OneLake"],
  "crossCutting": ["Microsoft Entra ID","Microsoft Purview","Microsoft Defender for Cloud","Microsoft Sentinel","Microsoft Intune","Azure Key Vault","Azure Cost Management","GitHub","Azure DevOps","Azure Policy"],
  "connections": [
    { "from": "shortcuts",  "to": "lake-bronze", "band": "cool" },
    { "from": "copy-jobs",  "to": "lake-bronze", "band": "cool" },
    { "from": "pipeline",   "to": "lake-bronze", "band": "cool" },
    { "from": "dataflow",   "to": "lake-bronze", "band": "cool" },
    { "from": "mirroring",  "to": "mirrored-db", "band": "cool" },
    { "from": "mirrored-db","to": "lake-silver", "band": "cool" },
    { "from": "lake-bronze","to": "lake-silver", "band": "cool" },
    { "from": "lake-silver","to": "spark-nb2",   "band": "cool" },
    { "from": "spark-nb2",  "to": "warehouse-gold","band": "cool" },
    { "from": "lake-bronze","to": "spark-nb1",   "band": "cool" },
    { "from": "spark-nb1",  "to": "experiment",  "band": "cool" },
    { "from": "experiment", "to": "ml-model",    "band": "cool" },
    { "from": "warehouse-gold","to": "sem-direct-lake", "band": "cool" },
    { "from": "sem-direct-lake","to": "report-interactive", "band": "cool" },
    { "from": "sem-direct-lake","to": "report-paginated",   "band": "cool" },
    { "from": "sem-direct-lake","to": "data-agent",         "band": "cool" },
    { "from": "warehouse-gold","to": "api-graphql",         "band": "cool" },
    { "from": "lake-silver","to": "ontology",    "band": "cool" },
    { "from": "eventstream","to": "eventhouse",  "band": "hot" },
    { "from": "eventhouse", "to": "sem-direct-query", "band": "hot" },
    { "from": "sem-direct-query","to": "rt-dashboard", "band": "hot" },
    { "from": "sem-direct-query","to": "kql-queryset", "band": "hot" },
    { "from": "eventhouse", "to": "activator",   "band": "hot" },
    { "from": "report-interactive","to": "users" },
    { "from": "rt-dashboard","to": "users" }
  ],
  "workflow": [
    { "step": 1, "description": "Batch sources land in Bronze via Shortcuts, Copy Jobs, Pipelines, Dataflow Gen2 and Mirroring.", "services": ["shortcuts","copy-jobs","pipeline","dataflow","mirroring","lake-bronze"] },
    { "step": 2, "description": "Bronze is cleansed and conformed into Silver; Spark Notebooks train ML models from Bronze.", "services": ["lake-bronze","lake-silver","spark-nb1","experiment","ml-model"] },
    { "step": 3, "description": "Silver is aggregated into a Gold Warehouse for serving.", "services": ["lake-silver","spark-nb2","warehouse-gold"] },
    { "step": 4, "description": "Semantic Models (Direct Lake) power interactive/paginated reports and the Data Agent.", "services": ["warehouse-gold","sem-direct-lake","report-interactive","report-paginated","data-agent"] },
    { "step": 5, "description": "Streaming sources flow through Eventstream into Eventhouse for real-time analytics.", "services": ["eventstream","eventhouse","sem-direct-query","rt-dashboard","activator"] }
  ]
}

EXAMPLE 2 — AKS web application reference (simple 3-stage):
{
  "title": "AKS Web Application Reference",
  "platformWrappers": ["Azure"],
  "stages": [
    { "id": "edge", "label": "Edge",
      "services": [
        { "id": "frontdoor", "name": "Azure Front Door", "category": "networking" },
        { "id": "waf", "name": "Web Application Firewall", "category": "security" }
      ]
    },
    { "id": "app", "label": "Application",
      "services": [
        { "id": "apim", "name": "API Management", "category": "integration" },
        { "id": "aks", "name": "Azure Kubernetes Service", "category": "containers" },
        { "id": "acr", "name": "Container Registry", "category": "containers" }
      ]
    },
    { "id": "data", "label": "Data",
      "services": [
        { "id": "sql", "name": "Azure SQL Database", "category": "databases" },
        { "id": "redis", "name": "Azure Cache for Redis", "category": "databases" },
        { "id": "blob", "name": "Blob Storage", "category": "storage" }
      ]
    }
  ],
  "actors": [{ "id": "users", "label": "Users", "icon": "users" }],
  "foundation": ["Virtual Network"],
  "crossCutting": ["Microsoft Entra ID","Azure Key Vault","Azure Monitor","Microsoft Defender for Cloud"],
  "connections": [
    { "from": "users", "to": "frontdoor" },
    { "from": "frontdoor", "to": "waf" },
    { "from": "waf", "to": "apim" },
    { "from": "apim", "to": "aks" },
    { "from": "aks", "to": "sql" },
    { "from": "aks", "to": "redis" },
    { "from": "aks", "to": "blob" },
    { "from": "acr", "to": "aks", "label": "Image pull" }
  ],
  "workflow": [
    { "step": 1, "description": "User traffic enters via Front Door with WAF.", "services": ["users","frontdoor","waf"] },
    { "step": 2, "description": "Requests route through APIM to AKS-hosted microservices.", "services": ["waf","apim","aks"] },
    { "step": 3, "description": "AKS reads/writes SQL, caches in Redis, and stores blobs.", "services": ["aks","sql","redis","blob"] }
  ]
}

EXAMPLE 3 — Event-driven IoT analytics (hot + cool paths):
{
  "title": "Event-Driven IoT Analytics",
  "platformWrappers": ["Azure"],
  "stages": [
    { "id": "ingest", "label": "Ingest",
      "services": [
        { "id": "iothub", "name": "Azure IoT Hub", "category": "iot" },
        { "id": "eventhubs", "name": "Event Hubs", "category": "integration" }
      ]
    },
    { "id": "process", "label": "Process",
      "services": [
        { "id": "stream", "name": "Stream Analytics", "category": "analytics" },
        { "id": "func", "name": "Azure Functions", "category": "compute" }
      ]
    },
    { "id": "store", "label": "Store",
      "services": [
        { "id": "adls", "name": "Azure Data Lake Storage", "category": "storage" },
        { "id": "cosmos", "name": "Azure Cosmos DB", "category": "databases" }
      ]
    },
    { "id": "serve", "label": "Serve",
      "services": [
        { "id": "synapse", "name": "Synapse Analytics", "category": "analytics" },
        { "id": "powerbi", "name": "Power BI Embedded", "category": "analytics" },
        { "id": "grafana", "name": "Azure Managed Grafana", "category": "analytics" }
      ]
    }
  ],
  "pathBands": [
    { "id": "cool", "label": "Cool path", "color": "blue", "stages": ["ingest","process","store","serve"] },
    { "id": "hot",  "label": "Hot path",  "color": "pink", "stages": ["ingest","process","serve"] }
  ],
  "actors": [{ "id": "ops", "label": "Operators", "icon": "users" }],
  "foundation": ["Azure Virtual Network"],
  "crossCutting": ["Microsoft Entra ID","Azure Monitor","Azure Key Vault","Microsoft Defender for Cloud"],
  "connections": [
    { "from": "iothub", "to": "eventhubs", "band": "hot" },
    { "from": "eventhubs", "to": "stream", "band": "hot" },
    { "from": "stream", "to": "grafana", "band": "hot", "label": "Real-time KPIs" },
    { "from": "iothub", "to": "adls", "band": "cool", "label": "Capture" },
    { "from": "adls", "to": "func", "band": "cool" },
    { "from": "func", "to": "cosmos", "band": "cool" },
    { "from": "cosmos", "to": "synapse", "band": "cool" },
    { "from": "synapse", "to": "powerbi", "band": "cool" },
    { "from": "powerbi", "to": "ops" },
    { "from": "grafana", "to": "ops" }
  ]
}
`.trim();

// ──────────────────────────────────────────────────────────────────────────────
// Generation
// ──────────────────────────────────────────────────────────────────────────────

export async function generateReferenceArchitectureWithAI(
  description: string,
  modelOverride?: ModelOverride
): Promise<ReferenceArchitecture> {
  const systemPrompt = `You are an expert Azure cloud architect who creates publication-ready REFERENCE ARCHITECTURE diagrams in the editorial style of the Microsoft Azure Architecture Center.

Reference architectures differ from topology diagrams: they show a NARRATIVE — how data and control flow through clearly named STAGES (swim lanes), left to right, with platform wrappers, optional hot/cool path bands, a foundation strip, and a cross-cutting governance strip.

Return ONLY a valid JSON object (no markdown fences, no commentary) matching this TypeScript shape:

interface ReferenceArchitecture {
  title: string;
  platformWrappers?: string[];   // outer bands above the stages, e.g. ["Microsoft Fabric","Fabric Copilot"]
  stages: Array<{                // 3–6 left-to-right swim lanes
    id: string; label: string;
    services: Array<{ id: string; name: string; category: string; description?: string }>;
  }>;
  pathBands?: Array<{            // optional dual-path overlay
    id: string; label: string;   // e.g. "Hot path" / "Cool path"
    color: "pink"|"blue"|"green"|"amber";
    stages: string[];            // stage ids the band spans
  }>;
  dataSources?: Array<{          // left edge column (input system inventory)
    category: string;            // e.g. "Business applications","Databases","Files and API","Events and messaging"
    items: string[];
  }>;
  actors?: Array<{ id: string; label: string; icon?: "users"|"person"|"external-system" }>;
  foundation?: string[];         // bottom strip platform (e.g. ["OneLake"], ["Virtual Network"])
  crossCutting?: string[];       // very-bottom security/governance rails (Entra, Purview, Defender, Sentinel, Key Vault, Monitor, Policy, GitHub, Azure DevOps, Cost Management)
  connections: Array<{ from: string; to: string; label?: string; band?: string; type?: "sync"|"async"|"optional" }>;
  workflow?: Array<{ step: number; description: string; services: string[] }>;
}

Service "category" MUST be one of:
"app services","databases","storage","networking","compute","containers","ai + machine learning","analytics","identity","monitor","iot","integration","devops","security","web","management + governance"

Rules:
1. Use 3–6 stages. Order them left-to-right by data flow (Ingest → Process → Store → Model → Serve, or domain-equivalent).
2. Each stage holds 1–8 services. Use OFFICIAL Microsoft product names (e.g. "Microsoft Entra ID", not "AAD"; "Azure Cosmos DB", not "Cosmos").
3. Add platformWrappers when the workload sits inside an explicit MS platform (Fabric, Foundry, Synapse, AKS, Power Platform).
4. Use pathBands ONLY when there's a genuine hot (real-time/streaming) AND cool (batch/historical) split.
5. ALWAYS include a foundation entry (the unifying platform layer for the workload — e.g. OneLake, Azure VNet, AKS).
6. ALWAYS include a crossCutting array of 4–10 governance/security services that apply across all stages.
7. Add a dataSources column ONLY when sources are heterogeneous and worth enumerating (apps + DBs + files + events).
8. Add actors when external consumers (Users, Operators, Partners, Devices) are relevant.
9. Connections should be SPECIFIC and SPARSE — show primary data flow only, not every implicit edge. Aim for 8–25 connections. Connect actors and dataSources directly to the first service they hit.
10. Provide 3–7 workflow steps narrating the end-to-end journey.
11. IDs must be lowercase-kebab, unique across stages/actors/datasources.
12. DO NOT include positions/coordinates/widths/heights — the layout engine computes them.

Here are 3 high-quality reference architectures to imitate in structure and density:

${FEW_SHOT_EXAMPLES}

Now generate a reference architecture for the user's request. Return JSON only.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: description },
  ];

  const activeModel = modelOverride?.model || getModelSettings().model;
  const { content, metrics } = await callAzureOpenAI(messages, modelOverride, true);
  console.log(
    `📐 Reference Architecture Response [${MODEL_CONFIG[activeModel].displayName}]: ${content.length} chars`
  );

  let ref: ReferenceArchitecture;
  try {
    ref = JSON.parse(content);
  } catch (e: any) {
    console.error('Failed to parse reference architecture JSON:', content);
    throw new Error(`Invalid JSON in reference architecture response: ${e.message}`);
  }

  // Validate minimum shape
  if (!ref.stages || !Array.isArray(ref.stages) || ref.stages.length === 0) {
    throw new Error('Reference architecture missing required "stages" array.');
  }
  if (!ref.connections || !Array.isArray(ref.connections)) {
    ref.connections = [];
  }

  // Normalize service names against the canonical icon map
  for (const stage of ref.stages) {
    if (!Array.isArray(stage.services)) continue;
    stage.services = stage.services.map((s) => {
      const m = getServiceIconMapping(s.name);
      if (m) {
        return { ...s, name: m.displayName, category: m.category };
      }
      return s;
    });
  }

  ref.metrics = metrics;
  return ref;
}

// ──────────────────────────────────────────────────────────────────────────────
// Week-1 transform: ReferenceArchitecture → existing topology schema
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Convert a ReferenceArchitecture into the {groups, services, connections,
 * workflow, metrics} shape that the existing App.tsx render pipeline accepts.
 *
 * This is a temporary bridge so Week-1 output can be displayed and validated
 * with the existing layout engine. Weeks 2–3 will replace this with a bespoke
 * banded layout + editorial visual theme that consumes the ReferenceArchitecture
 * directly.
 */
export function referenceToTopology(ref: ReferenceArchitecture): {
  groups: Array<{ id: string; label: string }>;
  services: Array<{
    id: string;
    name: string;
    type: string;
    category: string;
    description?: string;
    groupId: string | null;
  }>;
  connections: Array<{ from: string; to: string; label?: string; type?: string }>;
  workflow: Array<{ step: number; description: string; services: string[] }>;
  metrics?: AIMetrics;
  __referenceArchitecture: ReferenceArchitecture;  // preserved for Weeks 2–3
} {
  const groups: Array<{ id: string; label: string }> = [];
  const services: Array<{
    id: string;
    name: string;
    type: string;
    category: string;
    description?: string;
    groupId: string | null;
  }> = [];

  // 1. Stages → groups (with optional path-band prefix)
  const stageBand = new Map<string, RefPathBand>();
  for (const band of ref.pathBands || []) {
    for (const sId of band.stages) stageBand.set(sId, band);
  }
  for (const stage of ref.stages) {
    const band = stageBand.get(stage.id);
    const label = band ? `${band.label} · ${stage.label}` : stage.label;
    groups.push({ id: `stage-${stage.id}`, label });
    for (const svc of stage.services) {
      services.push({
        id: svc.id,
        name: svc.name,
        type: svc.name,
        category: svc.category,
        description: svc.description,
        groupId: `stage-${stage.id}`,
      });
    }
  }

  // 2. dataSources → synthetic services in a "Data sources" group
  if (ref.dataSources && ref.dataSources.length > 0) {
    groups.push({ id: 'group-data-sources', label: 'Data sources' });
    for (const ds of ref.dataSources) {
      for (const item of ds.items) {
        const id = synthId(`ds-${ds.category}-${item}`);
        services.push({
          id,
          name: item,
          type: item,
          category: inferCategoryFromDataSource(ds.category),
          description: ds.category,
          groupId: 'group-data-sources',
        });
      }
    }
  }

  // 3. actors → synthetic services in an "Actors" group
  if (ref.actors && ref.actors.length > 0) {
    groups.push({ id: 'group-actors', label: 'Actors' });
    for (const a of ref.actors) {
      services.push({
        id: a.id,
        name: a.label,
        type: a.label,
        category: 'identity',
        groupId: 'group-actors',
      });
    }
  }

  // 4. foundation → group
  if (ref.foundation && ref.foundation.length > 0) {
    groups.push({ id: 'group-foundation', label: 'Foundation' });
    for (const item of ref.foundation) {
      const m = getServiceIconMapping(item);
      services.push({
        id: synthId(`found-${item}`),
        name: m?.displayName || item,
        type: m?.displayName || item,
        category: m?.category || 'networking',
        groupId: 'group-foundation',
      });
    }
  }

  // 5. crossCutting → group
  if (ref.crossCutting && ref.crossCutting.length > 0) {
    groups.push({ id: 'group-cross-cutting', label: 'Security & Governance' });
    for (const item of ref.crossCutting) {
      const m = getServiceIconMapping(item);
      services.push({
        id: synthId(`cc-${item}`),
        name: m?.displayName || item,
        type: m?.displayName || item,
        category: m?.category || 'security',
        groupId: 'group-cross-cutting',
      });
    }
  }

  // 6. Connections — pass through; drop any whose endpoints don't resolve
  const serviceIds = new Set(services.map((s) => s.id));
  const connections = (ref.connections || [])
    .filter((c) => serviceIds.has(c.from) && serviceIds.has(c.to))
    .map((c) => ({
      from: c.from,
      to: c.to,
      label: c.label,
      type: c.type || 'sync',
    }));

  return {
    groups,
    services,
    connections,
    workflow: ref.workflow || [],
    metrics: ref.metrics,
    __referenceArchitecture: ref,
  };
}

function synthId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function inferCategoryFromDataSource(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('database')) return 'databases';
  if (c.includes('event') || c.includes('messag')) return 'integration';
  if (c.includes('file') || c.includes('api')) return 'integration';
  if (c.includes('business') || c.includes('app')) return 'app services';
  return 'integration';
}
