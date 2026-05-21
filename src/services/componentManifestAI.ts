// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Component Manifest pre-pass.
 *
 * For Both-mode generation we want the topology and blueprint to AGREE on
 * the set of components and zones they cover. Without this, the two LLM
 * calls can diverge (e.g. blueprint includes the on-prem tier while
 * topology omits it). This service does a single small LLM call to extract
 * a canonical manifest from the user's prompt; the manifest is then fed
 * into both the topology and blueprint system prompts as a "REQUIRED
 * COMPONENTS" block.
 *
 * Wall-time budget: ~5–8s. Both mode now becomes:
 *   manifest  ──▶  Promise.all([topology, blueprint])
 *   total ≈ manifest + max(topology, blueprint)
 */

import { callAzureOpenAI, ModelOverride, AIMetrics } from './azureOpenAI';

export interface ManifestZone {
  id: string;
  label: string;
  kind: 'on-prem' | 'azure' | 'vnet' | 'subnet' | 'rg' | 'observability' | 'identity' | 'data' | 'compute' | 'edge' | 'external';
}

export interface ManifestComponent {
  id: string;
  /** Canonical Azure service name (e.g. "Azure IoT Hub") or on-prem actor (e.g. "Industrial Sensors"). */
  name: string;
  /** One-line role description. */
  role: string;
  /** Zone id this component belongs to. */
  zone: string;
  kind?: 'service' | 'persona' | 'cloud' | 'device' | 'database' | 'on-prem-actor';
}

export interface ComponentManifest {
  title: string;
  zones: ManifestZone[];
  components: ManifestComponent[];
  /** Boundary services (ExpressRoute, Site-to-Site VPN, Private Link, Front Door, App Gateway). */
  boundaryConnectors: string[];
  metrics?: AIMetrics;
}

const SYSTEM_PROMPT = `You are an Azure architecture analyst. Read the user's workload description and extract a CANONICAL COMPONENT MANIFEST that two downstream diagram generators (a topology generator and a whiteboard blueprint generator) will both use.

Return ONLY a JSON object (no markdown, no commentary) matching this TypeScript shape:

interface ComponentManifest {
  title: string;                              // short, human-friendly, no "Untitled"
  zones: Array<{
    id: string;                               // kebab-case
    label: string;                            // display name
    kind: "on-prem"|"azure"|"vnet"|"subnet"|"rg"|"observability"|"identity"|"data"|"compute"|"edge"|"external";
  }>;
  components: Array<{
    id: string;                               // kebab-case, unique
    name: string;                             // OFFICIAL Azure service name OR on-prem actor name
    role: string;                             // one-line responsibility
    zone: string;                             // zone id from above
    kind?: "service"|"persona"|"cloud"|"device"|"database"|"on-prem-actor";
  }>;
  boundaryConnectors: string[];               // e.g. ["Azure Private Link","ExpressRoute","Site-to-Site VPN"]
}

Rules:
1. Use OFFICIAL Microsoft product names: "Microsoft Entra ID", "Azure IoT Hub", "Azure Stream Analytics", "Azure Cosmos DB", "Azure Functions", "Azure Container Apps", "Azure Kubernetes Service", "Azure Monitor", "Log Analytics", "Application Insights", "Key Vault", "Azure SQL Database", "Azure Cache for Redis", "Service Bus", "Event Hubs", "Azure Data Lake Storage", "Azure Synapse Analytics", "Azure Machine Learning", "Azure Digital Twins", "Time Series Insights", "Azure API Management", "Azure Front Door", "Azure Application Gateway", "Microsoft Sentinel", "Microsoft Defender for Cloud", "Logic Apps", "Microsoft Fabric", etc.
2. ALWAYS include an on-prem zone if the prompt mentions OT, IT, on-premises, factory floor, edge gateway, sensors, hybrid, datacenter, or similar. Inside it, model the actors (e.g. "Industrial Sensors" with kind "device", "Field Gateway" / "IoT Edge Gateway" with kind "service").
3. ALWAYS include a boundary connector when the prompt mentions network segregation, hybrid connectivity, OT/IT separation, private endpoints, or "secure connection" — pick from {"Azure Private Link","ExpressRoute","Site-to-Site VPN","Azure Front Door","Azure Application Gateway"}.
4. ALWAYS include observability (Azure Monitor + Log Analytics) and identity (Microsoft Entra ID) zones if the prompt mentions monitoring, auditing, RBAC, authentication, or compliance.
5. Personas (end users, admins, operators) belong to the most relevant zone (often on-prem or external) and use kind "persona".
6. Keep total components in the 8–18 range. Avoid duplicates. Avoid invented composite names like "Azure Workloads" — use the real service.
7. zones array MUST contain 3–6 entries. components array MUST be non-empty.
8. id fields are kebab-case and globally unique within their array.

Example output for "IoT predictive maintenance with OT/IT segregation, sensors, real-time scoring, batch analytics, secure provisioning":

{
  "title": "Industrial IoT Predictive Maintenance Platform",
  "zones": [
    { "id": "on-prem", "label": "On-Premises OT Network", "kind": "on-prem" },
    { "id": "ingress", "label": "Ingress & IoT", "kind": "edge" },
    { "id": "processing", "label": "Real-Time Processing", "kind": "compute" },
    { "id": "data", "label": "Data & Analytics", "kind": "data" },
    { "id": "observability", "label": "Observability", "kind": "observability" },
    { "id": "identity", "label": "Identity", "kind": "identity" }
  ],
  "components": [
    { "id": "sensors", "name": "Industrial Sensors", "role": "Generate telemetry every 5s", "zone": "on-prem", "kind": "device" },
    { "id": "edge-gw", "name": "Azure IoT Edge Gateway", "role": "Aggregate and tunnel OT telemetry", "zone": "on-prem" },
    { "id": "private-link", "name": "Azure Private Link", "role": "Private endpoint into VNet", "zone": "ingress", "kind": "cloud" },
    { "id": "iot-hub", "name": "Azure IoT Hub", "role": "Cloud ingestion endpoint", "zone": "ingress" },
    { "id": "dps", "name": "Azure IoT Hub Device Provisioning Service", "role": "Zero-touch device onboarding", "zone": "ingress" },
    { "id": "stream", "name": "Azure Stream Analytics", "role": "Real-time anomaly detection", "zone": "processing" },
    { "id": "ml", "name": "Azure Machine Learning", "role": "Trains and hosts predictive models", "zone": "processing" },
    { "id": "twins", "name": "Azure Digital Twins", "role": "Live facility model", "zone": "processing" },
    { "id": "lake", "name": "Azure Data Lake Storage", "role": "6-month hot + 7-year cold telemetry", "zone": "data" },
    { "id": "synapse", "name": "Azure Synapse Analytics", "role": "Batch trend analysis", "zone": "data" },
    { "id": "tsi", "name": "Time Series Insights", "role": "Operator dashboards", "zone": "data" },
    { "id": "monitor", "name": "Azure Monitor", "role": "Platform metrics + alerts", "zone": "observability" },
    { "id": "log-analytics", "name": "Log Analytics", "role": "Centralized logs", "zone": "observability" },
    { "id": "entra", "name": "Microsoft Entra ID", "role": "Identity and RBAC", "zone": "identity" }
  ],
  "boundaryConnectors": ["Azure Private Link"]
}

Now extract the manifest for the user's request. Return JSON only.`;

export async function generateComponentManifest(
  description: string,
  modelOverride?: ModelOverride,
): Promise<ComponentManifest> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: description },
  ];

  const { content, metrics } = await callAzureOpenAI(messages, modelOverride, true);
  console.log(`📋 Component Manifest: ${content.length} chars`);

  let manifest: ComponentManifest;
  try {
    manifest = JSON.parse(content);
  } catch (e: any) {
    console.error('Failed to parse component manifest JSON:', content);
    throw new Error(`Invalid JSON in component manifest response: ${e.message}`);
  }

  if (!Array.isArray(manifest.zones) || manifest.zones.length === 0) {
    throw new Error('Component manifest missing required "zones" array.');
  }
  if (!Array.isArray(manifest.components) || manifest.components.length === 0) {
    throw new Error('Component manifest missing required "components" array.');
  }
  if (!Array.isArray(manifest.boundaryConnectors)) {
    manifest.boundaryConnectors = [];
  }
  if (!manifest.title) {
    manifest.title = 'Architecture';
  }

  manifest.metrics = metrics;
  return manifest;
}

/**
 * Render the manifest as a deterministic system-prompt block to inject into
 * the topology and blueprint prompts. Both downstream generators will be
 * told this is the canonical set they MUST cover.
 */
export function renderManifestForPrompt(manifest: ComponentManifest): string {
  const zonesLines = manifest.zones
    .map((z) => `  - ${z.id} (${z.kind}): ${z.label}`)
    .join('\n');
  const componentLines = manifest.components
    .map((c) => `  - ${c.name} [zone=${c.zone}${c.kind ? `, kind=${c.kind}` : ''}] — ${c.role}`)
    .join('\n');
  const boundaries = manifest.boundaryConnectors.length
    ? manifest.boundaryConnectors.join(', ')
    : '(none)';

  return [
    'REQUIRED COMPONENTS — The user has been pre-analyzed and the following canonical manifest has been extracted. Your diagram MUST include EVERY component below, mapped to the indicated zones. You MAY add a small number of additional supporting services if the workload genuinely needs them, but you may NOT drop any required component.',
    '',
    `Title: ${manifest.title}`,
    '',
    'Zones (use these labels and approximate semantics):',
    zonesLines,
    '',
    'Components (every one of these is mandatory):',
    componentLines,
    '',
    `Boundary connectors (must be present if listed): ${boundaries}`,
    '',
  ].join('\n');
}
