// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getModelSettingsForFeature, getModelSettings, getDeploymentName, MODEL_CONFIG, ModelType, ReasoningEffort } from '../stores/modelSettingsStore';
import { getServiceIconMapping, SERVICE_ICON_MAP } from '../data/serviceIconMapping';
import { trackAIModelUsage } from './telemetryService';
import { buildApiUrl, buildRequestBody, parseApiResponse } from './apiHelper';

const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;

// Token usage metrics returned from Azure OpenAI API
export interface AIMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  elapsedTimeMs: number;
  model?: string;
}

interface CallResult {
  content: string;
  metrics: AIMetrics;
}

export interface ModelOverride {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
}

async function callAzureOpenAI(messages: any[], modelOverride?: ModelOverride): Promise<CallResult> {
  // Use explicit model override if provided, otherwise read from store
  const storeSettings = getModelSettingsForFeature('architectureGeneration');
  const rawStore = getModelSettings();
  const settings = modelOverride || storeSettings;
  const modelConfig = MODEL_CONFIG[settings.model];
  
  console.log(`📋 Model: using ${settings.model} | dropdown=${rawStore.model} | featureOverride=${rawStore.featureOverrides?.architectureGeneration?.model || 'none'} | source=${modelOverride ? 'explicit' : 'store'}`);

  
  let deployment: string;
  try {
    deployment = getDeploymentName(settings.model);
  } catch (e) {
    throw new Error(`No deployment configured for ${settings.model}. Please check your .env file.`);
  }

  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI credentials not configured. Please check your .env file.');
  }

  // Determine API format (Responses for OpenAI models, Chat Completions for third-party)
  const apiFormat = modelConfig.apiFormat || 'responses';
  const url = buildApiUrl(endpoint, deployment, apiFormat);

  // Add timeout for large requests (5 minutes for regenerations)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);
  
  // Start timing
  const startTime = performance.now();

  // Build request body using the appropriate API format
  const requestBody = buildRequestBody({
    deployment,
    messages,
    maxTokens: modelConfig.maxCompletionTokens,
    apiFormat,
    isReasoning: modelConfig.isReasoning,
    reasoningEffort: settings.reasoningEffort,
  });
  
  console.log(`🤖 Using ${modelConfig.displayName} [deployment: ${deployment}]${modelConfig.isReasoning ? ` (reasoning: ${settings.reasoningEffort})` : ''} | max_tokens: ${modelConfig.maxCompletionTokens} | API: ${apiFormat === 'chat-completions' ? 'Chat Completions' : 'Responses'}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    // Calculate elapsed time
    const elapsedTimeMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const error = await response.text();
      console.error('Azure OpenAI API error:', response.status, error);
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Azure OpenAI credentials.');
      }
      if (response.status === 404) {
        throw new Error('Deployment not found. Please check your model deployment name.');
      }
      throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    
    // Parse response using the appropriate API format
    const parsed = parseApiResponse(data, apiFormat);
    const content = parsed.content;
    const metrics: AIMetrics = {
      promptTokens: parsed.promptTokens,
      completionTokens: parsed.completionTokens,
      totalTokens: parsed.totalTokens,
      elapsedTimeMs,
      model: data.model
    };
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Azure OpenAI. The request may have been too large or complex. Try reducing recommendations or using lower reasoning effort.');
    }
    
    console.log(`API Response: ${content.length} chars | Tokens: ${metrics.promptTokens} in → ${metrics.completionTokens} out (${metrics.totalTokens} total) | Time: ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s | Model: ${modelConfig.displayName}`);
    
    // Track model usage telemetry
    trackAIModelUsage({
      model: modelConfig.displayName,
      operation: 'architecture_generation',
      reasoningEffort: modelConfig.isReasoning ? settings.reasoningEffort : undefined,
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens,
      totalTokens: metrics.totalTokens,
      elapsedTimeMs: metrics.elapsedTimeMs,
    });
    
    return { content, metrics };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 5 minutes. The request may be too complex. Consider simplifying the architecture or reducing the number of recommendations.');
    }
    
    throw error;
  }
}

export async function generateArchitectureWithAI(description: string, modelOverride?: ModelOverride) {
  // Build a compact list of known service display names for the prompt
  const knownServices = Object.entries(SERVICE_ICON_MAP)
    .map(([, m]) => `${m.displayName} (${m.category})`)
    .join(', ');

  const systemPrompt = `You are an expert Azure cloud architect. Analyze architecture requirements and return a JSON specification for an Azure architecture diagram with logical groupings.

**IMPORTANT: DO NOT include position, x, y, width, or height in your response. The layout engine will calculate optimal positions automatically.**

Return ONLY a valid JSON object (no markdown, no explanations) with this structure:
{
  "groups": [{ "id": "unique-group-id", "label": "Group Name" }],
  "services": [{ "id": "unique-id", "name": "Service Display Name", "type": "Azure service type", "category": "icon category", "description": "Brief role", "groupId": "group-id or null" }],
  "connections": [{ "from": "service-id", "to": "service-id", "label": "Detailed action description", "type": "sync|async|optional" }],
  "workflow": [{ "step": 1, "description": "What happens in this step", "services": ["service-id-1", "service-id-2"] }]
}

KNOWN SERVICES (use these exact names for "name" and "type" fields):
${knownServices}

Icon categories (use for "category" field):
"app services", "databases", "storage", "networking", "compute", "containers", "ai + machine learning", "analytics", "identity", "monitor", "iot", "integration", "devops", "security", "web", "management + governance"

Rules:
1. Create 2-5 logical groups. Max 6 services per group.
2. Use EXACT service names from the KNOWN SERVICES list above for both "name" and "type". If a required service is NOT in the list, use its official Azure service name and set category to the closest match.
3. For identity/auth, use "Microsoft Entra ID" (never "Azure Active Directory" or "AAD").
4. Connection labels MUST be specific and action-oriented (e.g., "Submit batch job per tenant"), NOT generic ("Request", "Data").
5. Do NOT specify sourcePosition or targetPosition.
6. Connection types: "sync" (solid, HTTP/SQL), "async" (dashed, queues/events), "optional" (dotted, fallback).
7. Provide 5-10 workflow steps following the data flow chronologically. Each step's "services" array MUST list ALL service IDs involved in that step (typically 2-3 services per step, not just one).

LAYOUT READABILITY — CRITICAL:
8. **Directional group flow.** Arrange groups in a clear left-to-right pipeline: Ingress/Edge → Application/Compute → Data/Storage. Place Identity/Security as a separate group at the bottom-left. Place Monitoring/Observability as a separate group at the bottom-right.
9. **Hub-and-spoke for monitoring.** Do NOT draw individual edges from every service to Log Analytics or Azure Monitor. Instead, connect ONLY the primary compute service to Azure Monitor, then a SINGLE edge from Azure Monitor to Log Analytics. Maximum 2-3 edges involving monitoring services total.
10. **Limit total connections to 12-18.** Only include connections that represent the PRIMARY data or control flow. Omit obvious implicit relationships (e.g., every service using Key Vault — show only 1 representative Key Vault edge). Omit diagnostic/telemetry edges except the hub-and-spoke pattern in rule 9.
11. **Minimize cross-group edges.** Place tightly-coupled services in the SAME group. If two services exchange data frequently, they belong together. Cross-group connections cause visual clutter — aim for no more than 1-2 outgoing edges per group to other groups.
12. **Total service count: 8-12 max** unless the user's description explicitly names more services. Include every service the user mentions. Only add EXTRA security/identity services (Key Vault, Entra ID, DDoS, WAF) beyond what the user asked for when the architecture critically depends on them.
13. **Dashboard & visualization services.** When the user mentions dashboards, reporting, visualization, or analytics UIs, include a dedicated visualization service such as Azure Managed Grafana, Power BI Embedded, Azure Dashboard, or Azure Workbooks — do NOT substitute a generic compute/web service for the dashboard role.`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description }
    ];

    const activeModel = modelOverride?.model || getModelSettings().model;
    const { content, metrics } = await callAzureOpenAI(messages, modelOverride);
    
    console.log(`Azure OpenAI Response [${MODEL_CONFIG[activeModel].displayName}]:`, content);
    
    if (!content) {
      throw new Error('No response from Azure OpenAI. The model may have timed out or returned empty content.');
    }

    let architecture;
    try {
      architecture = JSON.parse(content);
    } catch (parseError: any) {
      console.error('Failed to parse JSON response:', content);
      throw new Error(`Invalid JSON response from Azure OpenAI: ${parseError.message}`);
    }
    
    // Post-process: normalize service names and categories against SERVICE_ICON_MAP
    if (architecture.services && Array.isArray(architecture.services)) {
      architecture.services = architecture.services.map((service: any) => {
        // Try to match against known service mappings
        let mapping = getServiceIconMapping(service.name) || getServiceIconMapping(service.type);
        if (mapping) {
          console.log(`  🔧 Normalized "${service.name}" → "${mapping.displayName}" (${mapping.category})`);
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

    // Add AI metrics to the response
    architecture.metrics = metrics;

    if (!architecture.services || !Array.isArray(architecture.services)) {
      throw new Error('Invalid response format: missing services array');
    }
    
    if (!architecture.connections || !Array.isArray(architecture.connections)) {
      architecture.connections = [];
    }

    if (!architecture.groups || !Array.isArray(architecture.groups)) {
      architecture.groups = [];
    }

    // Normalize groups: some models return plain strings instead of objects
    // e.g. ["dmz-primary", "app-tier"] → [{id: "dmz-primary", label: "DMZ Primary"}, ...]
    architecture.groups = architecture.groups.map((g: any) => {
      if (typeof g === 'string') {
        return {
          id: g,
          label: g.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        };
      }
      // Strip groupId from group objects to prevent circular parent refs
      const { groupId, ...cleanGroup } = g;
      return cleanGroup;
    });

    // Build valid group ID set and resolve conflicts
    const groupIds = new Set(architecture.groups.map((g: any) => g.id));
    const serviceIds = new Set(architecture.services.map((s: any) => s.id));

    // Prevent ID collisions between groups and services (causes ReactFlow circular refs)
    for (const gid of groupIds) {
      if (serviceIds.has(gid)) {
        console.warn(`⚠️ Group ID "${gid}" collides with a service ID — prefixing group`);
        const group = architecture.groups.find((g: any) => g.id === gid);
        const newId = `group-${gid}`;
        group.id = newId;
        // Update service references
        architecture.services.forEach((s: any) => {
          if (s.groupId === gid) s.groupId = newId;
        });
      }
    }

    // Clear invalid groupId references on services to prevent "parent not found" crashes
    const validGroupIds = new Set(architecture.groups.map((g: any) => g.id));
    architecture.services.forEach((s: any) => {
      if (s.groupId && !validGroupIds.has(s.groupId)) {
        console.warn(`⚠️ Service "${s.id}" references unknown group "${s.groupId}" — clearing`);
        s.groupId = null;
      }
    });

    return architecture;
  } catch (error: any) {
    console.error('Azure OpenAI Error:', error);
    
    if (error.message?.includes('credentials not configured')) {
      throw new Error('Azure OpenAI is not configured. Please check your environment variables.');
    }
    
    if (error.status === 401) {
      throw new Error('Invalid API key. Please check your Azure OpenAI credentials.');
    }
    
    if (error.status === 404) {
      throw new Error('Deployment not found. Please check your model deployment name.');
    }
    
    throw new Error(`Failed to generate architecture: ${error.message || 'Unknown error'}`);
  }
}

export function isAzureOpenAIConfigured(): boolean {
  // Check if at least one model is available
  const hasEndpoint = !!endpoint;
  const hasApiKey = !!apiKey;
  
  // Check for specific model deployments (no longer using legacy default)
  const hasGpt51 = !!import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_GPT51;
  const hasGpt52 = !!import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_GPT52;
  const hasDeepSeek = !!import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK;
  const hasGrok = !!import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST;
  
  return hasEndpoint && hasApiKey && (hasGpt51 || hasGpt52 || hasDeepSeek || hasGrok);
}

/**
 * Analyzes an architecture diagram image and generates a detailed text description
 * that can be used as input for the AI architecture generator.
 * 
 * Phase 1 implementation: Image → Text Description → Existing Generation Pipeline
 */
export async function analyzeArchitectureDiagramImage(imageBase64: string, mimeType: string = 'image/png'): Promise<{ description: string; metrics: AIMetrics }> {
  const settings = getModelSettingsForFeature('architectureGeneration');
  const modelConfig = MODEL_CONFIG[settings.model];
  
  // Vision is only supported by OpenAI models (Responses API)
  if (modelConfig.supportsVision === false) {
    throw new Error(`${modelConfig.displayName} does not support image analysis. Please select an OpenAI model (GPT-5.x) for diagram-to-architecture conversion.`);
  }

  let deployment: string;
  try {
    deployment = getDeploymentName(settings.model);
  } catch (e) {
    throw new Error(`No deployment configured for ${settings.model}. Please check your .env file.`);
  }

  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI credentials not configured. Please check your .env file.');
  }

  // Responses API endpoint
  const url = `${endpoint}openai/v1/responses`;

  const systemPrompt = `You are an expert Azure cloud architect specializing in analyzing architecture diagrams.

Your task is to analyze the provided architecture diagram image and create a detailed, comprehensive text description that can be used to recreate this architecture.

IMPORTANT: Extract and describe:
1. **All services/components visible** - Identify each Azure service, third-party service, or component shown
2. **Service relationships and connections** - How services connect to each other, data flow direction
3. **Groupings and tiers** - Any logical groupings (e.g., "Web Tier", "Data Layer", "Security")
4. **Connection types** - Whether connections appear to be synchronous (solid lines), asynchronous (dashed), or optional (dotted)
5. **Labels and annotations** - PRESERVE THE EXACT TEXT of any labels on connections or services - these are critical!
6. **Data flow** - The overall flow of data through the system
7. **Security components** - Identity, authentication, firewalls, etc.
8. **Monitoring/observability** - Any monitoring or logging services shown

AZURE MACHINE LEARNING GRANULAR COMPONENTS:
If the diagram shows detailed AML architecture, identify these SPECIFIC component types:
- "AML Online Endpoint" - for real-time inference endpoints
- "AML Batch Endpoint" - for batch inference endpoints
- "AML Deployment" (shared or dedicated) - for model deployments
- "AML Managed Compute" - for compute instances/clusters
- "Batch Compute Pool" - for batch processing pools
Using these specific names helps with accurate cost estimation (endpoints are $0, compute has cost).

CRITICAL FOR CONNECTION LABELS:
- If the diagram has text labels on the arrows/connections, include those EXACT labels in your description
- Labels like "Submit batch job per tenant" or "Route to dedicated deployment" must be preserved verbatim
- These labels are essential for recreating the diagram accurately

OUTPUT FORMAT:
Write a detailed paragraph description that fully captures the architecture shown in the image. Include:
- All services by name (use official Azure service names where recognizable)
- How they connect and interact
- The purpose/role of each component
- Any groupings or organizational structure
- The overall workflow from input to output

Be thorough and specific. The description will be used to automatically generate a diagram, so accuracy is critical.

If you cannot identify a specific Azure service, describe it by its apparent function (e.g., "a database service", "an API gateway", "a message queue").

If the image is not an architecture diagram or is unclear, describe what you can see and note any limitations.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes for image analysis
  
  const startTime = performance.now();

  // Responses API request body with image input
  const requestBody: any = {
    model: deployment,
    instructions: systemPrompt,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Analyze this architecture diagram and provide a detailed description that captures all services, connections, groupings, and data flows shown. Be specific and thorough.'
          },
          {
            type: 'input_image',
            image_url: `data:${mimeType};base64,${imageBase64}`,
          }
        ]
      }
    ],
    max_output_tokens: 4000,
    store: false,
  };
  
  // Add reasoning config for reasoning models (skip when effort is 'none')
  if (modelConfig.isReasoning && settings.reasoningEffort !== 'none') {
    requestBody.reasoning = { effort: settings.reasoningEffort };
  }

  console.log(`🖼️ Analyzing architecture diagram with ${modelConfig.displayName}... | API: Responses`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const elapsedTimeMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const error = await response.text();
      console.error('Azure OpenAI Vision API error:', response.status, error);
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Azure OpenAI credentials.');
      }
      if (response.status === 404) {
        throw new Error('Deployment not found. Please check your model deployment name.');
      }
      if (response.status === 400 && error.includes('image')) {
        throw new Error('The selected model may not support image analysis. Try using GPT-4o or GPT-5.2.');
      }
      throw new Error(`Azure OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    
    // Responses API: extract text from output
    let content = data.output_text || '';
    if (!content && data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const part of item.content) {
            if (part.type === 'output_text') {
              content += part.text;
            }
          }
        }
      }
    }
    
    // Responses API uses input_tokens/output_tokens
    const usage = data.usage || {};
    const metrics: AIMetrics = {
      promptTokens: usage.input_tokens || 0,
      completionTokens: usage.output_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      elapsedTimeMs,
      model: data.model
    };
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Azure OpenAI. The image may be too complex or unclear.');
    }
    
    console.log('🖼️ Image analysis complete:', content.length, 'chars |', 
      `Tokens: ${metrics.promptTokens} in → ${metrics.completionTokens} out |`,
      `Time: ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s`);
    
    return { description: content, metrics };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Image analysis timed out. The image may be too large or complex.');
    }
    
    throw error;
  }
}

// ─── IaC Template Import (Bicep, Terraform, ARM) ─────────────────────

export type IaCFormat = 'arm' | 'bicep' | 'terraform-hcl' | 'terraform-state';

export interface IaCImportInput {
  format: IaCFormat;
  /** For ARM/tfstate: parsed JSON object. For Bicep/HCL: raw text content. */
  content: string | object;
  /** Original filename(s) for context in the prompt */
  filenames: string[];
}

/** Shared output schema instruction block reused by all format prompts */
const IAC_SHARED_OUTPUT_SCHEMA = `Return ONLY a valid JSON object (no markdown, no explanations) with this exact structure:
{
  "groups": [
    {
      "id": "unique-group-id",
      "label": "Group Name (e.g., Web Tier, Data Layer, Networking)",
      "position": {"x": 100, "y": 100},
      "width": 700,
      "height": 500
    }
  ],
  "services": [
    {
      "id": "unique-id",
      "name": "Service Display Name",
      "type": "Azure service type",
      "category": "icon category",
      "description": "Role in architecture",
      "groupId": "group-id or null"
    }
  ],
  "connections": [
    {
      "from": "service-id",
      "to": "service-id",
      "label": "connection type",
      "type": "sync|async|optional",
      "sourcePosition": "right|bottom|left|top",
      "targetPosition": "top|left|right|bottom"
    }
  ]
}

Icon category mapping (MUST use these exact values):
- "app services": App Service, Function Apps, Logic Apps, API Management
- "databases": SQL Database, Cosmos DB, MySQL, PostgreSQL
- "storage": Storage Account, Blob Storage, File Storage, Queue Storage
- "networking": Virtual Network, Application Gateway, Load Balancer, VPN Gateway
- "compute": Virtual Machines, VM Scale Sets, Batch, Container Instances
- "containers": Container Registry, Kubernetes Service (AKS)
- "ai + machine learning": Machine Learning, Cognitive Services, OpenAI
- "analytics": Stream Analytics, Data Factory, Synapse Analytics, Event Hubs
- "identity": Active Directory, Key Vault, Managed Identity
- "monitor": Monitor, Application Insights, Log Analytics
- "iot": IoT Hub, IoT Central
- "integration": Service Bus, Event Grid
- "security": Key Vault, Security Center
- "web": Static Web Apps, CDN, Front Door`;

function buildARMSystemPrompt(): string {
  return `You are an expert Azure cloud architect specializing in reverse engineering ARM templates into architecture diagrams.

Your task is to analyze an Azure ARM template JSON and convert it into a visual architecture diagram specification with logical groupings.

${IAC_SHARED_OUTPUT_SCHEMA}

ARM Resource Type to Service Mapping:
- Microsoft.Web/sites → App Service (app services)
- Microsoft.Web/sites/functions → Function App (app services)
- Microsoft.DocumentDB/databaseAccounts → Cosmos DB (databases)
- Microsoft.Sql/servers/databases → SQL Database (databases)
- Microsoft.Storage/storageAccounts → Storage Account (storage)
- Microsoft.Network/virtualNetworks → Virtual Network (networking)
- Microsoft.Network/applicationGateways → Application Gateway (networking)
- Microsoft.Network/loadBalancers → Load Balancer (networking)
- Microsoft.Compute/virtualMachines → Virtual Machine (compute)
- Microsoft.ContainerRegistry/registries → Container Registry (containers)
- Microsoft.ContainerInstance/containerGroups → Container Instances (containers)
- Microsoft.ContainerService/managedClusters → AKS (containers)
- Microsoft.KeyVault/vaults → Key Vault (identity)
- Microsoft.Insights/components → Application Insights (monitor)
- Microsoft.ServiceBus/namespaces → Service Bus (integration)
- Microsoft.EventGrid/topics → Event Grid (integration)
- Microsoft.CognitiveServices/accounts → Cognitive Services (ai + machine learning)
- Microsoft.MachineLearningServices/workspaces → Machine Learning (ai + machine learning)

Instructions:
1. Parse the ARM template resources array
2. Identify resource types and map to Azure services
3. Use dependsOn arrays to infer connections between resources
4. Group related resources logically (e.g., web tier, data tier, networking)
5. Create realistic connection labels based on resource relationships
6. Use sync/async/optional connection types appropriately
7. Extract meaningful names from resource names (remove template expressions)`;
}

function buildBicepSystemPrompt(): string {
  return `You are an expert Azure cloud architect specializing in reverse engineering Bicep templates into architecture diagrams.

Your task is to analyze Bicep (.bicep) Infrastructure-as-Code files and convert them into a visual architecture diagram specification with logical groupings.

${IAC_SHARED_OUTPUT_SCHEMA}

Bicep Resource Type to Service Mapping (the API version after @ should be ignored):
- Microsoft.Web/sites → App Service (app services)
- Microsoft.Web/sites (kind: 'functionapp') → Function App (app services)
- Microsoft.ApiManagement/service → API Management (app services)
- Microsoft.Web/sites (kind: 'app,linux') → App Service (app services)
- Microsoft.DocumentDB/databaseAccounts → Cosmos DB (databases)
- Microsoft.Sql/servers → SQL Server (databases)
- Microsoft.Sql/servers/databases → SQL Database (databases)
- Microsoft.DBforPostgreSQL/flexibleServers → PostgreSQL (databases)
- Microsoft.DBforMySQL/flexibleServers → MySQL (databases)
- Microsoft.Cache/redis → Azure Cache for Redis (databases)
- Microsoft.Storage/storageAccounts → Storage Account (storage)
- Microsoft.Network/virtualNetworks → Virtual Network (networking)
- Microsoft.Network/applicationGateways → Application Gateway (networking)
- Microsoft.Network/loadBalancers → Load Balancer (networking)
- Microsoft.Network/frontDoors → Front Door (web)
- Microsoft.Cdn/profiles → CDN (web)
- Microsoft.Network/privateDnsZones → Private DNS Zone (networking)
- Microsoft.Network/privateEndpoints → Private Endpoint (networking)
- Microsoft.Network/networkSecurityGroups → NSG (networking)
- Microsoft.Compute/virtualMachines → Virtual Machine (compute)
- Microsoft.Compute/virtualMachineScaleSets → VM Scale Set (compute)
- Microsoft.ContainerRegistry/registries → Container Registry (containers)
- Microsoft.ContainerService/managedClusters → AKS (containers)
- Microsoft.App/managedEnvironments → Container Apps Environment (containers)
- Microsoft.App/containerApps → Container App (containers)
- Microsoft.KeyVault/vaults → Key Vault (identity)
- Microsoft.ManagedIdentity/userAssignedIdentities → Managed Identity (identity)
- Microsoft.Insights/components → Application Insights (monitor)
- Microsoft.OperationalInsights/workspaces → Log Analytics (monitor)
- Microsoft.Insights/diagnosticSettings → Monitor Diagnostics (monitor)
- Microsoft.ServiceBus/namespaces → Service Bus (integration)
- Microsoft.EventGrid/topics → Event Grid (integration)
- Microsoft.EventHub/namespaces → Event Hubs (analytics)
- Microsoft.CognitiveServices/accounts → Cognitive Services (ai + machine learning)
- Microsoft.MachineLearningServices/workspaces → Machine Learning (ai + machine learning)
- Microsoft.Search/searchServices → Azure AI Search (ai + machine learning)
- Microsoft.SignalRService/signalR → SignalR (web)
- Microsoft.Web/staticSites → Static Web App (web)

Instructions:
1. Parse all resource declarations (resource keyword with type string and API version)
2. Parse module declarations to understand modular structure
3. Identify resource types and map to Azure services using the table above
4. Infer connections from: dependsOn, parameter passing between modules, property references (e.g., storageAccount.properties.primaryEndpoints)
5. Group related resources logically by module or by tier (web, data, networking, etc.)
6. Extract meaningful display names from resource symbolic names
7. Use sync/async/optional connection types appropriately based on the relationship`;
}

function buildTerraformHCLSystemPrompt(): string {
  return `You are an expert Azure cloud architect specializing in reverse engineering Terraform configurations into architecture diagrams.

Your task is to analyze Terraform (.tf) HCL files using the AzureRM provider and convert them into a visual architecture diagram specification with logical groupings.

${IAC_SHARED_OUTPUT_SCHEMA}

Terraform AzureRM Resource Type to Service Mapping:
- azurerm_resource_group → Resource Group (use as a grouping container, not as a service node)
- azurerm_linux_web_app / azurerm_windows_web_app → App Service (app services)
- azurerm_linux_function_app / azurerm_windows_function_app → Function App (app services)
- azurerm_api_management → API Management (app services)
- azurerm_logic_app_workflow → Logic App (app services)
- azurerm_service_plan → App Service Plan (app services) — group with its web/function apps
- azurerm_cosmosdb_account → Cosmos DB (databases)
- azurerm_mssql_server → SQL Server (databases)
- azurerm_mssql_database → SQL Database (databases)
- azurerm_postgresql_flexible_server → PostgreSQL (databases)
- azurerm_mysql_flexible_server → MySQL (databases)
- azurerm_redis_cache → Azure Cache for Redis (databases)
- azurerm_storage_account → Storage Account (storage)
- azurerm_storage_container → Blob Container (storage) — group with its storage account
- azurerm_virtual_network → Virtual Network (networking)
- azurerm_subnet → Subnet (networking) — group with its VNet
- azurerm_application_gateway → Application Gateway (networking)
- azurerm_lb → Load Balancer (networking)
- azurerm_frontdoor → Front Door (web)
- azurerm_cdn_profile → CDN (web)
- azurerm_private_dns_zone → Private DNS Zone (networking)
- azurerm_private_endpoint → Private Endpoint (networking)
- azurerm_network_security_group → NSG (networking)
- azurerm_linux_virtual_machine / azurerm_windows_virtual_machine → Virtual Machine (compute)
- azurerm_virtual_machine_scale_set → VM Scale Set (compute)
- azurerm_container_registry → Container Registry (containers)
- azurerm_kubernetes_cluster → AKS (containers)
- azurerm_container_app → Container App (containers)
- azurerm_container_app_environment → Container Apps Environment (containers)
- azurerm_key_vault → Key Vault (identity)
- azurerm_user_assigned_identity → Managed Identity (identity)
- azurerm_application_insights → Application Insights (monitor)
- azurerm_log_analytics_workspace → Log Analytics (monitor)
- azurerm_servicebus_namespace → Service Bus (integration)
- azurerm_eventgrid_topic → Event Grid (integration)
- azurerm_eventhub_namespace → Event Hubs (analytics)
- azurerm_cognitive_account → Cognitive Services (ai + machine learning)
- azurerm_machine_learning_workspace → Machine Learning (ai + machine learning)
- azurerm_search_service → Azure AI Search (ai + machine learning)
- azurerm_signalr_service → SignalR (web)
- azurerm_static_web_app → Static Web App (web)

Instructions:
1. Parse all resource blocks (resource "azurerm_*" "name" { ... })
2. Identify resource types and map to Azure services using the table above
3. Infer connections from: depends_on blocks, implicit references (e.g., azurerm_subnet.main.id), and attribute references between resources
4. Use azurerm_resource_group as logical grouping containers
5. Group related resources by tier (web, data, networking) or by resource group
6. Extract meaningful display names from resource labels (the second string in resource declarations)
7. Collapse child resources with their parents (e.g., storage_container inside storage_account)
8. Use sync/async/optional connection types based on the relationship`;
}

function buildTerraformStateSystemPrompt(): string {
  return `You are an expert Azure cloud architect specializing in reverse engineering Terraform state files into architecture diagrams.

Your task is to analyze a Terraform state file (terraform.tfstate) JSON and convert it into a visual architecture diagram specification with logical groupings. The state file represents actually deployed infrastructure.

${IAC_SHARED_OUTPUT_SCHEMA}

The Terraform state file has this structure:
- resources[]: Array of resource objects
  - type: The Terraform resource type (e.g., "azurerm_linux_web_app")
  - name: The Terraform resource label
  - provider: The provider path
  - instances[]: Array of deployed instances with attributes

Use the same resource type mapping as Terraform HCL (azurerm_* types).

Instructions:
1. Parse the resources array from the state file
2. Map each resource type to an Azure service
3. Infer connections from attribute values that reference other resource IDs
4. Group resources by resource group (look for resource_group_name attribute in instances)
5. Extract display names from the name field or from instance attributes
6. Use sync/async/optional connection types appropriately`;
}

function buildARMUserMessage(armTemplate: any): string {
  const resources = armTemplate.resources || [];
  const resourceSummary = resources.map((r: any) => ({
    type: r.type,
    name: r.name,
    location: r.location,
    dependsOn: r.dependsOn || [],
    properties: Object.keys(r.properties || {})
  }));

  return `Parse this ARM template and generate an architecture diagram:

Template Summary:
- Total Resources: ${resources.length}
- Resource Types: ${[...new Set(resources.map((r: any) => r.type))].join(', ')}

Detailed Resources:
${JSON.stringify(resourceSummary, null, 2)}

Full ARM Template:
${JSON.stringify(armTemplate, null, 2)}`;
}

function buildBicepUserMessage(content: string, filenames: string[]): string {
  return `Parse this Bicep template and generate an architecture diagram:

Files: ${filenames.join(', ')}
File Count: ${filenames.length}

Bicep Source:
${content}`;
}

function buildTerraformHCLUserMessage(content: string, filenames: string[]): string {
  return `Parse this Terraform configuration and generate an architecture diagram:

Files: ${filenames.join(', ')}
File Count: ${filenames.length}

Terraform HCL Source:
${content}`;
}

function buildTerraformStateUserMessage(stateJson: any): string {
  const resources = stateJson.resources || [];
  return `Parse this Terraform state file and generate an architecture diagram:

State Summary:
- Terraform Version: ${stateJson.terraform_version || 'unknown'}
- Total Resources: ${resources.length}
- Resource Types: ${[...new Set(resources.map((r: any) => r.type))].join(', ')}

Full State:
${JSON.stringify(stateJson, null, 2)}`;
}

/** Post-process the architecture response to normalize groups and resolve conflicts */
function normalizeArchitectureResponse(architecture: any): any {
  // Validate response structure
  if (!architecture.services || !Array.isArray(architecture.services)) {
    throw new Error('Invalid response: missing services array');
  }

  if (!architecture.connections) {
    architecture.connections = [];
  }

  if (!architecture.groups) {
    architecture.groups = [];
  }

  // Normalize groups: some models return plain strings instead of objects
  architecture.groups = architecture.groups.map((g: any) => {
    if (typeof g === 'string') {
      return {
        id: g,
        label: g.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      };
    }
    // Strip groupId from group objects to prevent circular parent refs
    const { groupId, ...cleanGroup } = g;
    return cleanGroup;
  });

  // Build valid group ID set and resolve conflicts
  const groupIds = new Set(architecture.groups.map((g: any) => g.id));
  const serviceIds = new Set(architecture.services.map((s: any) => s.id));

  // Prevent ID collisions between groups and services (causes ReactFlow circular refs)
  for (const gid of groupIds) {
    if (serviceIds.has(gid)) {
      console.warn(`⚠️ Group ID "${gid}" collides with a service ID — prefixing group`);
      const group = architecture.groups.find((g: any) => g.id === gid);
      const newId = `group-${gid}`;
      group.id = newId;
      architecture.services.forEach((s: any) => {
        if (s.groupId === gid) s.groupId = newId;
      });
    }
  }

  // Clear invalid groupId references on services to prevent "parent not found" crashes
  const validGroupIds = new Set(architecture.groups.map((g: any) => g.id));
  architecture.services.forEach((s: any) => {
    if (s.groupId && !validGroupIds.has(s.groupId)) {
      console.warn(`⚠️ Service "${s.id}" references unknown group "${s.groupId}" — clearing`);
      s.groupId = null;
    }
  });

  return architecture;
}

const FORMAT_LABELS: Record<IaCFormat, string> = {
  'arm': 'ARM',
  'bicep': 'Bicep',
  'terraform-hcl': 'Terraform',
  'terraform-state': 'Terraform State',
};

/**
 * Unified IaC template import: generates an architecture diagram from
 * Bicep, Terraform HCL, Terraform state, or ARM template files.
 */
export async function generateArchitectureFromIaC(input: IaCImportInput) {
  const label = FORMAT_LABELS[input.format];
  console.log(`📄 Parsing ${label} template (${input.filenames.length} file(s))...`);

  let systemPrompt: string;
  let userMessage: string;

  switch (input.format) {
    case 'arm':
      systemPrompt = buildARMSystemPrompt();
      userMessage = buildARMUserMessage(input.content);
      break;
    case 'bicep':
      systemPrompt = buildBicepSystemPrompt();
      userMessage = buildBicepUserMessage(input.content as string, input.filenames);
      break;
    case 'terraform-hcl':
      systemPrompt = buildTerraformHCLSystemPrompt();
      userMessage = buildTerraformHCLUserMessage(input.content as string, input.filenames);
      break;
    case 'terraform-state':
      systemPrompt = buildTerraformStateSystemPrompt();
      userMessage = buildTerraformStateUserMessage(input.content);
      break;
    default:
      throw new Error(`Unsupported IaC format: ${input.format}`);
  }

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const { content, metrics } = await callAzureOpenAI(messages);

    if (!content) {
      throw new Error('No response from Azure OpenAI');
    }

    const architecture = JSON.parse(content);
    architecture.metrics = metrics;

    return normalizeArchitectureResponse(architecture);
  } catch (error: any) {
    console.error(`${label} parsing error:`, error);
    throw new Error(`Failed to parse ${label} template: ${error.message}`);
  }
}

/**
 * Legacy wrapper — kept for backward compatibility.
 * Delegates to the unified generateArchitectureFromIaC().
 */
export async function generateArchitectureFromARM(armTemplate: any) {
  return generateArchitectureFromIaC({
    format: 'arm',
    content: armTemplate,
    filenames: ['template.json'],
  });
}
