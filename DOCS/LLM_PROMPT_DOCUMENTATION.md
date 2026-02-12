# Azure Architecture Diagram Builder - LLM Prompt Documentation

## Overview

This document explains the AI/LLM instructions used to generate Azure architecture diagrams from natural language descriptions. The system uses Azure OpenAI (GPT-5.2, GPT-4.1, GPT-4.1 Mini) with structured prompts to convert user requirements into visual architecture diagrams.

## Architecture

The AI generation system consists of two main components:

1. **System Prompt**: Detailed instructions defining the JSON schema, rules, and Azure service mappings
2. **User Input**: Natural language description of the desired architecture

## System Prompt Structure

### 1. Role Definition
```
You are an expert Azure cloud architect. Your task is to analyze architecture 
requirements and return a JSON specification for an Azure architecture diagram 
with logical groupings.
```

### 2. Reference Architecture Context (Dynamic)
The system injects reference architecture patterns to guide service selection and grouping. These are built into the system prompt, not fetched via vector search.

### 3. JSON Output Schema

The LLM must return a JSON object with four main sections:

#### Groups
Logical groupings of services (e.g., Web Tier, Data Layer, Security). Positions and dimensions are **NOT** included — the layout engine calculates these automatically:
```json
{
  "groups": [
    {
      "id": "unique-group-id",
      "label": "Group Name"
    }
  ]
}
```

#### Services
Individual Azure services with metadata:
```json
{
  "services": [
    {
      "id": "unique-id",
      "name": "Service Display Name",
      "type": "Azure service type",
      "category": "icon category",
      "description": "Brief role description",
      "groupId": "group-id or null"
    }
  ]
}
```

#### Connections
Data flows and relationships between services:
```json
{
  "connections": [
    {
      "from": "service-id",
      "to": "service-id",
      "label": "connection description",
      "type": "sync|async|optional",
      "sourcePosition": "right|bottom|left|top",
      "targetPosition": "top|left|right|bottom"
    }
  ]
}
```

#### Workflow
Step-by-step explanation of the architecture flow:
```json
{
  "workflow": [
    {
      "step": 1,
      "description": "Clear description of what happens in this step",
      "services": ["service-id-1", "service-id-2"]
    }
  ]
}
```

## Icon Category Mapping

The prompt includes strict mappings from Azure services to icon categories. This ensures correct visual representation:

| Category | Azure Services |
|----------|----------------|
| `app services` | App Service, Function Apps, Logic Apps, API Management, API Apps |
| `databases` | SQL Database, Cosmos DB, MySQL, PostgreSQL, Database for MariaDB |
| `storage` | Storage Account, Blob Storage, File Storage, Queue Storage, Table Storage |
| `networking` | Virtual Network, Application Gateway, Load Balancer, VPN Gateway, DNS |
| `compute` | Virtual Machines, VM Scale Sets, Batch |
| `containers` | Container Registry, Container Instances, Kubernetes Service (AKS) |
| `ai + machine learning` | Machine Learning, Cognitive Services, AI Studio, Bot Service |
| `analytics` | Stream Analytics, Data Factory, Synapse Analytics, Event Hubs, Data Lake |
| `identity` | Active Directory, Key Vault, Managed Identity |
| `monitor` | Monitor, Application Insights, Log Analytics |
| `iot` | IoT Hub, IoT Central, Digital Twins |
| `integration` | Service Bus, Event Grid, API Management |
| `devops` | DevOps, Pipelines, Repos, Artifacts |
| `security` | Security Center, Sentinel, Key Vault |
| `web` | Static Web Apps, CDN, Front Door |

## 10 Core Rules

### Rule 1: Create 2-5 Logical Groups
Organize services into logical groups following Microsoft reference architecture patterns:
- **Common patterns**: Ingestion, Processing, Data Layer, Web Tier, Security, Monitoring
- **Maximum 6 services per group** to maintain readability

### Rule 2: Let the Layout Engine Handle Positioning
- **DO NOT** include position, x, y, width, or height in the JSON output
- The `layoutEngine.ts` (258 lines) and `layoutPresets.ts` (460 lines) handle all positioning automatically
- Groups are sized and positioned based on service count and connections

### Rule 3: Assign Services to Groups
- Use `groupId` to associate services with their logical group
- Services can be ungrouped (`groupId: null`) if they don't fit a pattern

### Rule 4: Use Realistic Azure Service Names
- Match official Azure service naming conventions
- Use display names that users will recognize

### Rule 5: Create Logical Connections
- Base connections on actual data flow patterns
- Include descriptive labels explaining the connection purpose

### Rule 6: Make Group Labels Concise
- Use clear, descriptive names like "Data Layer", "API & Real-time", "Client & Edge Delivery"
- Follow Azure Architecture Center naming conventions

### Rule 7: Layout is Automatic
- Layout engine handles service placement within groups
- Supports multiple layout presets (hierarchical, grid, circular, etc.)
- Prevents visual cramping and allows for future additions

### Rule 8: Specify Connection Positions
Optimize layout by specifying where connections attach:
- **Horizontal flows**: Use `"right"` → `"left"`
- **Vertical flows**: Use `"bottom"` → `"top"`
- Consider logical flow direction for clarity

### Rule 9: Specify Connection Types
Visual differentiation for different communication patterns:

| Type | Appearance | Use Cases |
|------|------------|-----------|
| `sync` | Solid line, animated | HTTP requests, SQL queries, RPC calls, real-time sync |
| `async` | Dashed line, animated | Message queues, events, pub/sub, eventual consistency |
| `optional` | Dotted line, not animated | Fallback paths, conditional flows, optional dependencies |

### Rule 10: Provide Workflow Steps
Generate 5-10 numbered steps that explain the architecture:
- Write like Azure Architecture Center documentation
- Explain what each step does and why
- Reference involved service IDs
- Follow chronological data/request flow

**Example Workflow:**
```json
{
  "step": 1,
  "description": "Client requests the application; Azure Front Door terminates TLS and routes traffic based on path (SPA vs. API).",
  "services": ["svc-frontdoor", "svc-staticwebapp"]
}
```

## Common Grouping Patterns

The prompt suggests standard grouping patterns based on Microsoft Well-Architected Framework:

- **Ingestion/Input Layer**: Web apps, API gateways, event hubs, IoT hubs
- **Processing/Compute Layer**: Azure Functions, App Services, AKS, Container Instances
- **Data Layer/Storage**: Databases, blob storage, cache, data lakes
- **Orchestration/Integration**: Service Bus, Event Grid, Logic Apps, workflow services
- **Analytics/Intelligence**: AI services, Stream Analytics, Data Factory, ML services
- **Security/Identity**: Key Vault, Active Directory, Managed Identity, certificates
- **Monitoring**: Application Insights, Log Analytics, Azure Monitor

## Connection Type Guidelines

### Synchronous Connections (`sync`)
Use for request-response patterns requiring immediate results:
- REST API calls (HTTPS)
- Database queries (SQL, Cosmos DB)
- Direct RPC calls
- Authentication/authorization checks

### Asynchronous Connections (`async`)
Use for decoupled, event-driven patterns:
- Message queue operations (Service Bus, Storage Queue)
- Event publishing/subscription (Event Grid, Event Hubs)
- Background job processing
- Eventual consistency patterns

### Optional Connections (`optional`)
Use for conditional or fallback paths:
- Caching layers (cache miss fallback)
- Secondary/backup endpoints
- Feature flags or A/B testing paths
- Monitoring/telemetry (non-critical)

## ARM Template Import

The system also supports reverse-engineering Azure Resource Manager (ARM) templates:

### ARM Resource Type Mapping
Maps ARM resource types to visual services:

```
Microsoft.Web/sites → App Service (app services)
Microsoft.DocumentDB/databaseAccounts → Cosmos DB (databases)
Microsoft.Storage/storageAccounts → Storage Account (storage)
Microsoft.ContainerService/managedClusters → AKS (containers)
Microsoft.KeyVault/vaults → Key Vault (identity)
... (20+ mappings)
```

### ARM Parsing Process
1. Extracts resource types from `resources[]` array
2. Uses `dependsOn` to infer connections
3. Groups related resources logically
4. Generates connection labels based on resource relationships

## Example Prompts

### Web Application
```
A web application with a React frontend, Node.js backend API, 
PostgreSQL database, and blob storage for images
```

**Expected Output:**
- Groups: Web Tier, Application Tier, Data Layer
- Services: Static Web Apps, App Service, PostgreSQL, Blob Storage
- Connections: HTTPS (sync), database queries (sync), blob access (sync)

### IoT Solution
```
An IoT solution that collects data from devices, processes it with 
Azure Functions, stores in Cosmos DB, and visualizes with Power BI
```

**Expected Output:**
- Groups: Ingestion, Processing, Data Layer, Analytics
- Services: IoT Hub, Functions, Cosmos DB, Power BI
- Connections: Device telemetry (async), function triggers (async), data reads (sync)

### Microservices
```
A microservices architecture with container apps, API gateway, 
message queue, and Redis cache
```

**Expected Output:**
- Groups: API Gateway, Compute, Integration, Data Layer
- Services: API Management, Container Apps, Service Bus, Redis Cache
- Connections: API routing (sync), message publishing (async), cache access (sync)

## Configuration

### Environment Variables
```bash
VITE_AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
VITE_AZURE_OPENAI_API_KEY=your-api-key
VITE_AZURE_OPENAI_DEPLOYMENT=your-default-deployment
VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=your-gpt52-deployment
VITE_AZURE_OPENAI_DEPLOYMENT_GPT41=your-gpt41-deployment
VITE_AZURE_OPENAI_DEPLOYMENT_GPT41MINI=your-gpt41mini-deployment
VITE_REASONING_EFFORT=medium
```

### API Configuration
- **Max tokens**: Per-model (GPT-5.2: 16,000 | GPT-4.1: 10,000 | GPT-4.1 Mini: 8,000)
- **Response format**: `json_object` (ensures valid JSON)
- **API version**: `2025-04-01-preview`
- **Model selection**: Runtime via `ModelSelector` dropdown with `ModelOverride`

## Best Practices

### For Users
1. **Be specific**: Include service types, data flow, and requirements
2. **Mention scale**: Specify if high availability, multi-region, etc.
3. **Include constraints**: Security requirements, compliance, budget
4. **Use examples**: Reference similar architectures or patterns

### For Developers
1. **Validate JSON**: Always parse and validate the LLM response
2. **Handle errors**: Provide clear error messages for invalid responses
3. **Log responses**: Keep diagnostic logs for debugging
4. **Test edge cases**: Empty descriptions, very complex architectures

## Limitations

1. **Token limit**: Very large architectures may exceed model-specific limits
2. **Icon availability**: Limited to 713 icons across 29 categories
3. **Connection complexity**: Cannot represent all possible Azure connection types
4. **Model variance**: GPT-4.1 Mini may occasionally misidentify services

## Future Enhancements

Potential improvements to the prompt:
- Cost estimation hints
- Compliance framework mapping (HIPAA, PCI-DSS, etc.)
- Multi-cloud hybrid scenarios
- Custom prompt templates

## References

- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)
- [Azure OpenAI Service](https://learn.microsoft.com/azure/ai-services/openai/)
- [ReactFlow Documentation](https://reactflow.dev/)

---

**Version**: 2.0  
**Last Updated**: February 12, 2026  
**Models**: GPT-5.2, GPT-4.1, GPT-4.1 Mini (Azure OpenAI)
