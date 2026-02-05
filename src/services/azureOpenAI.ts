import { findSimilarArchitectures } from './referenceArchitectureService';
import { getModelSettingsForFeature, getDeploymentName, MODEL_CONFIG } from '../stores/modelSettingsStore';

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

async function callAzureOpenAI(messages: any[]): Promise<CallResult> {
  // Get model settings for architecture generation (uses override if set)
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

  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`;

  // Add timeout for large requests (5 minutes for regenerations)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);
  
  // Start timing
  const startTime = performance.now();

  // Build request body based on model type
  const requestBody: any = {
    messages,
    max_completion_tokens: modelConfig.maxCompletionTokens,
    response_format: { type: 'json_object' },
  };
  
  // Add reasoning_effort only for reasoning models (GPT-5.2)
  if (modelConfig.isReasoning) {
    requestBody.reasoning_effort = settings.reasoningEffort;
  }
  
  console.log(`🤖 Using ${modelConfig.displayName}${modelConfig.isReasoning ? ` (reasoning: ${settings.reasoningEffort})` : ''} | max_tokens: ${modelConfig.maxCompletionTokens}`);

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
    const content = data.choices[0]?.message?.content || '';
    
    // Extract token usage from response
    const usage = data.usage || {};
    const metrics: AIMetrics = {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      elapsedTimeMs,
      model: data.model
    };
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Azure OpenAI. The request may have been too large or complex. Try reducing recommendations or using lower reasoning effort.');
    }
    
    console.log('API Response:', content.length, 'chars |', 
      `Tokens: ${metrics.promptTokens} in → ${metrics.completionTokens} out (${metrics.totalTokens} total) |`,
      `Time: ${(metrics.elapsedTimeMs / 1000).toFixed(2)}s`);
    
    return { content, metrics };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timed out after 5 minutes. The request may be too complex. Consider simplifying the architecture or reducing the number of recommendations.');
    }
    
    throw error;
  }
}

export async function generateArchitectureWithAI(description: string, skipReferenceArchitectures: boolean = false) {
  // Skip loading reference architectures for regenerations (they already have an architecture)
  let contextPrompt = '';
  let similarArchitectures: any[] = [];
  
  if (!skipReferenceArchitectures) {
    // Find similar reference architectures for context (only for new generations)
    similarArchitectures = await findSimilarArchitectures(description, 3);
    
    if (similarArchitectures.length > 0) {
      contextPrompt = `\n\nREFERENCE EXAMPLES (for inspiration and validation):\n${
        similarArchitectures.map((arch, i) => 
          `${i + 1}. ${arch.name}: ${arch.description}\n   Services: ${arch.services.join(', ')}`
        ).join('\n\n')
      }\n\nUse these examples as inspiration but create a solution specific to the user's requirements.`;
    }
  }

  const systemPrompt = `You are an expert Azure cloud architect. Your task is to analyze architecture requirements and return a JSON specification for an Azure architecture diagram with logical groupings.

Based on the user's description, identify the appropriate Azure services and organize them into logical groups (like Microsoft reference architectures).${contextPrompt}

**IMPORTANT: DO NOT include position, x, y, width, or height in your response. The layout engine will calculate optimal positions automatically using graph algorithms.**

Return ONLY a valid JSON object (no markdown, no explanations) with this exact structure:
{
  "groups": [
    {
      "id": "unique-group-id",
      "label": "Group Name (e.g., Ingestion, Processing, Data Layer, Web Tier)"
    }
  ],
  "services": [
    {
      "id": "unique-id",
      "name": "Service Display Name",
      "type": "Azure service type",
      "category": "icon category",
      "description": "Brief role description",
      "groupId": "group-id or null if not in a group"
    }
  ],
  "connections": [
    {
      "from": "service-id",
      "to": "service-id",
      "label": "Detailed description of what flows through this connection (e.g., 'Submit batch job per tenant', 'Route request to shared deployment')",
      "type": "sync|async|optional"
    }
  ],
  "workflow": [
    {
      "step": 1,
      "description": "Clear description of what happens in this step",
      "services": ["service-id-1", "service-id-2"]
    }
  ]
}

Common grouping patterns:
- "Ingestion" or "Input Layer" - web apps, API gateways, event hubs
- "Processing" or "Compute Layer" - functions, app services, AKS
- "Data Layer" or "Storage" - databases, blob storage, cache
- "Orchestration" or "Integration" - service bus, event grid, logic apps
- "Analytics" or "Intelligence" - AI services, analytics, data processing
- "Security" or "Identity" - key vault, AD, managed identity
- "Monitoring" - Application Insights, Log Analytics

Icon categories mapping (MUST use these exact values):
- "app services": App Service, Function Apps, Logic Apps, API Management, API Apps
- "databases": SQL Database, Cosmos DB, MySQL, PostgreSQL, Database for MariaDB
- "storage": Storage Account, Blob Storage, File Storage, Queue Storage, Table Storage
- "networking": Virtual Network, Application Gateway, Load Balancer, VPN Gateway, DNS, Traffic Manager
- "compute": Virtual Machines, VM Scale Sets, Batch
- "containers": Container Registry, Container Instances, Kubernetes Service (AKS)
- "ai + machine learning": Machine Learning, Cognitive Services, AI Studio, Bot Service
- "analytics": Stream Analytics, Data Factory, Synapse Analytics, Event Hubs, Data Lake
- "identity": Active Directory, Key Vault, Managed Identity
- "monitor": Monitor, Application Insights, Log Analytics
- "iot": IoT Hub, IoT Central, Digital Twins
- "integration": Service Bus, Event Grid, API Management
- "devops": DevOps, Pipelines, Repos, Artifacts
- "security": Security Center, Sentinel, Key Vault
- "web": Static Web Apps, CDN, Front Door

CRITICAL ICON MAPPINGS - Use EXACT service names:
These service names will match icons directly - use these exact names in your response for BOTH the "name" AND "type" fields:

AI Services:
- "Azure OpenAI" - for GPT models, chat completions
- "Computer Vision" - for image analysis, OCR
- "Azure Speech" - for speech-to-text, text-to-speech  
- "Language" - for NLP, sentiment analysis, text analytics
- "Translator" - for translation services
- "Document Intelligence" - for form processing, document analysis
- "Custom Vision" - for custom image classification
- "Azure Machine Learning" - for ML workspaces, training, inference endpoints, batch/online deployments
- "Cognitive Services" - only for generic multi-service scenarios

Web & API Services:
- "Api Management" - for API gateway and management
- "App Service" - for hosting web apps and APIs
- "Azure Functions" - for serverless compute
- "Logic Apps" - for workflow automation

Databases:
- "Azure Cosmos Db" - for NoSQL database
- "Sql Database" - for relational database

Compute & Containers:
- "Virtual Machines" - for VMs
- "Azure Kubernetes Service" - for container orchestration
- "Container Instances" - for serverless containers
- "Container Registry" - for container images

Rules:
1. Create 2-5 logical groups to organize services
2. Assign services to appropriate groups using groupId (max 6 services per group)
3. **CRITICAL**: Use EXACT service names from the "CRITICAL ICON MAPPINGS" section above
   - For Azure OpenAI, use "Azure OpenAI" (NOT "AI Studio", "OpenAI Service", "GPT Service")
   - For web APIs, use "App Service" (NOT "Web App", "Web API", "API Service")
   - For databases, use "Azure Cosmos DB" (NOT just "Cosmos DB" or "CosmosDB")
   - For NLP, use "Language" (NOT "Text Analytics")
   - Check the mappings above for the correct name for every service
4. **IDENTITY SERVICES**: ALWAYS use "Microsoft Entra ID" for identity and authentication
   - NEVER use "Azure Active Directory", "Active Directory", "Azure AD", or "AAD"
   - Microsoft Entra ID is the current name for Azure's identity platform
   - Use for: authentication, authorization, SSO, user management, RBAC
5. Create logical connections based on data flow
6. Make group labels concise and descriptive
7. **CONNECTION LABELS ARE CRITICAL**: Write detailed, action-oriented labels that describe:
   - What data/requests flow through the connection
   - The purpose or action (e.g., "Submit batch job per tenant", "Route to dedicated deployment", "Read/write tenant-partitioned data")
   - NOT generic labels like "Request", "Response", "Data" - be specific!
8. Do NOT specify sourcePosition or targetPosition - the layout engine will use horizontal flow (right → left) automatically for cleaner diagrams
8. Specify connection type for each connection:
   - "sync" (solid line) - Synchronous, request-response, real-time communication (HTTP, SQL queries)
   - "async" (dashed line) - Asynchronous, message-based, event-driven (queues, events, pub/sub)
   - "optional" (dotted line) - Optional paths, fallback routes, or conditional flows
9. Provide a workflow array with numbered steps that explain the logical flow:
   - Write clear, technical descriptions like Azure Architecture Center
   - Explain what each step does and why
   - Reference the service IDs involved in each step
   - Make it comprehensive but concise (5-10 steps typically)
   - Follow the data/request flow chronologically

CORRECT SERVICE NAMING EXAMPLES:
✅ CORRECT:
{
  "name": "Azure OpenAI",
  "type": "Azure OpenAI",
  "category": "ai + machine learning"
}
{
  "name": "App Service",
  "type": "App Service",
  "category": "app services"
}
{
  "name": "Azure Cosmos DB",
  "type": "Azure Cosmos DB",
  "category": "databases"
}
{
  "name": "Azure Machine Learning",
  "type": "Azure Machine Learning",
  "category": "ai + machine learning"
}

❌ INCORRECT (will show wrong icon):
{
  "name": "AI Studio",  ← WRONG! Use "Azure OpenAI"
  "name": "Web API",    ← WRONG! Use "App Service"
  "name": "Cosmos DB",  ← WRONG! Use "Azure Cosmos DB"
  "name": "Machine Learning",  ← WRONG! Use "Azure Machine Learning"
  "type": "ML Workspace",  ← WRONG! type should also be "Azure Machine Learning"
}`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description }
    ];

    const { content, metrics } = await callAzureOpenAI(messages);
    
    console.log('Azure OpenAI Response:', content);
    
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
    
    // Validate the response structure
    // Add similar architectures metadata for UI display
    architecture.similarArchitectures = similarArchitectures.map(arch => ({
      name: arch.name,
      url: arch.url,
    }));
    
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

  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2025-04-01-preview`;

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

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Analyze this architecture diagram and provide a detailed description that captures all services, connections, groupings, and data flows shown. Be specific and thorough.'
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`,
            detail: 'high'
          }
        }
      ]
    }
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes for image analysis
  
  const startTime = performance.now();

  const requestBody: any = {
    messages,
    max_completion_tokens: 4000, // Enough for a detailed description
  };
  
  // Add reasoning_effort for reasoning models
  if (modelConfig.isReasoning) {
    requestBody.reasoning_effort = settings.reasoningEffort;
  }

  console.log(`🖼️ Analyzing architecture diagram with ${modelConfig.displayName}...`);

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
    const content = data.choices[0]?.message?.content || '';
    
    const usage = data.usage || {};
    const metrics: AIMetrics = {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
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
