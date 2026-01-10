import { findSimilarArchitectures } from './referenceArchitectureService';

const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
const deployment = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT;

async function callAzureOpenAI(messages: any[]): Promise<string> {
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI credentials not configured. Please check your .env file.');
  }

  const url = `${endpoint}openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      messages,
      max_completion_tokens: 6000,
      response_format: { type: 'json_object' },
    }),
  });

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
  console.log('API Response length:', content.length, 'chars');
  return content;
}

export async function generateArchitectureWithAI(description: string) {
  // Find similar reference architectures for context
  const similarArchitectures = await findSimilarArchitectures(description, 3);
  
  let contextPrompt = '';
  if (similarArchitectures.length > 0) {
    contextPrompt = `\n\nREFERENCE EXAMPLES (for inspiration and validation):\n${
      similarArchitectures.map((arch, i) => 
        `${i + 1}. ${arch.name}: ${arch.description}\n   Services: ${arch.services.join(', ')}`
      ).join('\n\n')
    }\n\nUse these examples as inspiration but create a solution specific to the user's requirements.`;
  }

  const systemPrompt = `You are an expert Azure cloud architect. Your task is to analyze architecture requirements and return a JSON specification for an Azure architecture diagram with logical groupings.

Based on the user's description, identify the appropriate Azure services and organize them into logical groups (like Microsoft reference architectures).${contextPrompt}

Return ONLY a valid JSON object (no markdown, no explanations) with this exact structure:
{
  "groups": [
    {
      "id": "unique-group-id",
      "label": "Group Name (e.g., Ingestion, Processing, Data Layer, Web Tier)",
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
      "description": "Brief role description",
      "groupId": "group-id or null if not in a group"
    }
  ],
  "connections": [
    {
      "from": "service-id",
      "to": "service-id",
      "label": "connection description",
      "type": "sync|async|optional",
      "sourcePosition": "right|bottom|left|top (optional)",
      "targetPosition": "top|left|right|bottom (optional)"
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
These service names will match icons directly - use these exact names in your response:

AI Services:
- "Azure OpenAI" - for GPT models, chat completions
- "Computer Vision" - for image analysis, OCR
- "Azure Speech" - for speech-to-text, text-to-speech  
- "Language" - for NLP, sentiment analysis, text analytics
- "Translator" - for translation services
- "Document Intelligence" - for form processing, document analysis
- "Custom Vision" - for custom image classification
- "Azure Machine Learning" - for custom ML models
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
2. Position groups with ample spacing (at least 800px apart horizontally, 600px vertically) for readability
3. Assign services to appropriate groups using groupId (max 6 services per group)
4. **CRITICAL**: Use EXACT service names from the "CRITICAL ICON MAPPINGS" section above
   - For Azure OpenAI, use "Azure OpenAI" (NOT "AI Studio", "OpenAI Service", "GPT Service")
   - For web APIs, use "App Service" (NOT "Web App", "Web API", "API Service")
   - For databases, use "Azure Cosmos DB" (NOT just "Cosmos DB" or "CosmosDB")
   - For NLP, use "Language" (NOT "Text Analytics")
   - Check the mappings above for the correct name for every service
5. Create logical connections based on data flow
6. Make group labels concise and descriptive
7. Size groups generously: width 700-900px, height 500-600px based on service count
8. Specify sourcePosition and targetPosition for connections to optimize layout:
   - Use "right" and "left" for horizontal data flows
   - Use "bottom" and "top" for vertical data flows
   - Consider the logical flow direction when choosing positions
9. Specify connection type for each connection:
   - "sync" (solid line) - Synchronous, request-response, real-time communication (HTTP, SQL queries)
   - "async" (dashed line) - Asynchronous, message-based, event-driven (queues, events, pub/sub)
   - "optional" (dotted line) - Optional paths, fallback routes, or conditional flows
10. Provide a workflow array with numbered steps that explain the logical flow:
   - Write clear, technical descriptions like Azure Architecture Center
   - Explain what each step does and why
   - Reference the service IDs involved in each step
   - Make it comprehensive but concise (5-10 steps typically)
   - Follow the data/request flow chronologically

CORRECT SERVICE NAMING EXAMPLES:
✅ CORRECT:
{
  "name": "Azure OpenAI",
  "type": "OpenAI GPT Models",
  "category": "ai + machine learning"
}
{
  "name": "App Service",
  "type": "Web Application",
  "category": "app services"
}
{
  "name": "Azure Cosmos DB",
  "type": "NoSQL Database",
  "category": "databases"
}

❌ INCORRECT (will show wrong icon):
{
  "name": "AI Studio",  ← WRONG! Use "Azure OpenAI"
  "name": "Web API",    ← WRONG! Use "App Service"
  "name": "Cosmos DB",  ← WRONG! Use "Azure Cosmos DB"
}`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description }
    ];

    const content = await callAzureOpenAI(messages);
    
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
  return !!(endpoint && apiKey && deployment);
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

    const content = await callAzureOpenAI(messages);
    
    if (!content) {
      throw new Error('No response from Azure OpenAI');
    }

    const architecture = JSON.parse(content);
    
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
