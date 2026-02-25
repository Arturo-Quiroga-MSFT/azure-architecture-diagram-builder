// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getModelSettingsForFeature, getModelSettings, getDeploymentName, MODEL_CONFIG, ModelType, ReasoningEffort } from '../stores/modelSettingsStore';
import { getServiceIconMapping, SERVICE_ICON_MAP } from '../data/serviceIconMapping';

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

  // Responses API endpoint (replaces Chat Completions)
  const url = `${endpoint}openai/v1/responses`;

  // Add timeout for large requests (5 minutes for regenerations)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);
  
  // Start timing
  const startTime = performance.now();

  // Build Responses API request body
  // Pass all messages (including system) as input — json_object format
  // requires the word 'json' to appear in input messages
  const requestBody: any = {
    model: deployment,
    input: messages,
    max_output_tokens: modelConfig.maxCompletionTokens,
    text: { format: { type: 'json_object' } },
    store: false,
  };
  
  // Add reasoning config for reasoning models
  if (modelConfig.isReasoning) {
    requestBody.reasoning = { effort: settings.reasoningEffort };
  }
  
  console.log(`🤖 Using ${modelConfig.displayName} [deployment: ${deployment}]${modelConfig.isReasoning ? ` (reasoning: ${settings.reasoningEffort})` : ''} | max_tokens: ${modelConfig.maxCompletionTokens} | API: Responses`);

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
    
    // Responses API: extract text from output
    // output_text is a convenience field; fall back to parsing output[].content[] if missing
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
      throw new Error('Empty response from Azure OpenAI. The request may have been too large or complex. Try reducing recommendations or using lower reasoning effort.');
    }
    
    console.log(`API Response: ${content.length} chars | Tokens: ${metrics.promptTokens} in → ${metrics.completionTokens} out (${metrics.totalTokens} total) | Time: ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s | Model: ${modelConfig.displayName}`);
    
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
  const hasGpt52 = !!import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_GPT52;
  const hasGpt41 = !!import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_GPT41;
  const hasGpt41Mini = !!import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_GPT41MINI;
  
  return hasEndpoint && hasApiKey && (hasGpt52 || hasGpt41 || hasGpt41Mini);
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
  
  // Add reasoning config for reasoning models
  if (modelConfig.isReasoning) {
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

export async function generateArchitectureFromARM(armTemplate: any) {
  // Extract key information from ARM template
  const resources = armTemplate.resources || [];
  
  // Create a summary of the template
  const resourceSummary = resources.map((r: any) => ({
    type: r.type,
    name: r.name,
    location: r.location,
    dependsOn: r.dependsOn || [],
    properties: Object.keys(r.properties || {})
  }));

  const systemPrompt = `You are an expert Azure cloud architect specializing in reverse engineering ARM templates into architecture diagrams.

Your task is to analyze an Azure ARM template JSON and convert it into a visual architecture diagram specification with logical groupings.

Return ONLY a valid JSON object (no markdown, no explanations) with this exact structure:
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
      "name": "Service Display Name (from ARM template)",
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
- "web": Static Web Apps, CDN, Front Door

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

  try {
    const userMessage = `Parse this ARM template and generate an architecture diagram:

Template Summary:
- Total Resources: ${resources.length}
- Resource Types: ${[...new Set(resources.map((r: any) => r.type))].join(', ')}

Detailed Resources:
${JSON.stringify(resourceSummary, null, 2)}

Full ARM Template:
${JSON.stringify(armTemplate, null, 2)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const { content, metrics } = await callAzureOpenAI(messages);
    
    if (!content) {
      throw new Error('No response from Azure OpenAI');
    }

    const architecture = JSON.parse(content);
    
    // Add AI metrics to the response
    architecture.metrics = metrics;
    
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

    return architecture;
  } catch (error: any) {
    console.error('ARM parsing error:', error);
    throw new Error(`Failed to parse ARM template: ${error.message}`);
  }
}
