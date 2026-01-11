# AI Instructions Documentation

**Last Updated**: January 11, 2026  
**Model Used**: GPT-5.2 (Azure OpenAI Deployment)

This document details the AI instructions (system prompts) for all three GPT-5.2 agents in the Azure Architecture Diagram Builder application.

---

## Overview

All three agents use the **same GPT-5.2 deployment** configured via environment variables:
- `VITE_AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `VITE_AZURE_OPENAI_API_KEY` - API authentication key
- `VITE_AZURE_OPENAI_DEPLOYMENT` - Model deployment name (GPT-5.2)

---

## 1. Main Diagram Generator (GPT-5.2)

**File**: `src/services/azureOpenAI.ts`  
**Function**: `generateArchitectureWithAI(description: string)`  
**Max Tokens**: 6,000  
**Response Format**: JSON Object

### Purpose
Generate Azure architecture diagrams with logical service groupings based on natural language descriptions.

### Key Instructions

#### Architecture Generation
- Analyze user requirements and identify appropriate Azure services
- Organize services into logical groups (following Microsoft reference architecture patterns)
- **DO NOT** include position, x, y, width, or height (layout engine calculates automatically)
- Use RAG (Retrieval-Augmented Generation) with similar reference architectures for context

#### Grouping Patterns
- **Ingestion/Input Layer**: Web apps, API gateways, Event Hubs
- **Processing/Compute Layer**: Functions, App Services, AKS
- **Data Layer/Storage**: Databases, Blob Storage, Cache
- **Orchestration/Integration**: Service Bus, Event Grid, Logic Apps
- **Analytics/Intelligence**: AI services, Analytics, Data processing
- **Security/Identity**: Key Vault, Active Directory, Managed Identity
- **Monitoring**: Application Insights, Log Analytics

#### Icon Categories (Exact Mappings Required)
- `app services`: App Service, Function Apps, Logic Apps, API Management
- `databases`: SQL Database, Cosmos DB, MySQL, PostgreSQL
- `storage`: Blob Storage, File Storage, Queue Storage, Table Storage
- `networking`: Virtual Network, Application Gateway, Load Balancer
- `compute`: Virtual Machines, VM Scale Sets, Batch
- `containers`: Container Registry, Container Instances, AKS
- `ai + machine learning`: Machine Learning, Cognitive Services, Bot Service
- `analytics`: Stream Analytics, Data Factory, Event Hubs, Data Lake
- `identity`: Active Directory, Key Vault, Managed Identity
- `monitor`: Monitor, Application Insights, Log Analytics
- `iot`: IoT Hub, IoT Central, Digital Twins
- `integration`: Service Bus, Event Grid, API Management
- `devops`: DevOps, Pipelines, Repos, Artifacts
- `security`: Security Center, Sentinel, Key Vault
- `web`: Static Web Apps, CDN, Front Door

#### Critical Service Name Mappings
**AI Services**:
- "Azure OpenAI" - GPT models, chat completions
- "Computer Vision" - Image analysis, OCR
- "Azure Speech" - Speech-to-text, text-to-speech
- "Language" - NLP, sentiment analysis, text analytics
- "Translator" - Translation services
- "Document Intelligence" - Form processing, document analysis
- "Custom Vision" - Custom image classification
- "Azure Machine Learning" - Custom ML models

**Web & API**:
- "Api Management" - API gateway
- "App Service" - Web apps and APIs
- "Azure Functions" - Serverless compute
- "Logic Apps" - Workflow automation

**Databases**:
- "Azure Cosmos Db" - NoSQL database
- "Sql Database" - Relational database

#### JSON Response Structure
```json
{
  "groups": [
    {
      "id": "unique-group-id",
      "label": "Group Name"
    }
  ],
  "services": [
    {
      "id": "unique-id",
      "name": "Service Display Name",
      "type": "Azure service type",
      "category": "icon category",
      "description": "Brief role description",
      "groupId": "group-id or null"
    }
  ],
  "connections": [
    {
      "from": "service-id",
      "to": "service-id",
      "label": "connection description",
      "type": "sync|async|optional",
      "sourcePosition": "right|bottom|left|top",
      "targetPosition": "top|left|right|bottom"
    }
  ],
  "workflow": [
    {
      "step": 1,
      "description": "Step description",
      "services": ["service-id-1", "service-id-2"]
    }
  ]
}
```

#### Service Selection Guidelines
- Use managed services over IaaS when possible
- Include monitoring (Application Insights) for production architectures
- Add API Management for public APIs
- Include Key Vault for secrets management
- Use managed identities for authentication
- Consider Azure Front Door/CDN for global deployments
- Include backup/disaster recovery services for critical workloads

---

## 2. Architecture Validator Agent (GPT-5.2)

**File**: `src/services/architectureValidator.ts`  
**Function**: `validateArchitecture(...)`  
**Max Tokens**: 8,000  
**Temperature**: 0.3  
**Response Format**: JSON Object

### Purpose
Validate Azure architectures against the **Azure Well-Architected Framework** (5 pillars) and provide actionable recommendations.

### Five Pillars of Assessment

#### 1. Reliability
- Resiliency patterns and fault tolerance
- High availability configurations
- Disaster recovery strategies
- Backup and restore procedures
- Zone redundancy and multi-region setups

#### 2. Security
- Identity and access management (Azure AD, RBAC)
- Data protection (encryption at rest/in transit)
- Network security (NSGs, firewalls, private endpoints)
- Key management (Key Vault, managed identities)
- Threat protection and monitoring

#### 3. Cost Optimization
- Right-sizing recommendations
- Reserved instances and savings plans
- Consumption patterns analysis
- Auto-scaling configurations
- Storage tier optimization
- Serverless vs. provisioned capacity

#### 4. Operational Excellence
- Monitoring and alerting (Application Insights)
- Logging and diagnostics
- Automation and IaC (ARM, Bicep, Terraform)
- DevOps practices and CI/CD
- Health checks and auto-healing

#### 5. Performance Efficiency
- Scaling strategies (horizontal/vertical)
- Caching implementations (Redis, CDN)
- Database optimization
- Network performance (latency, bandwidth)
- Resource optimization

### Key Instructions

#### Validation Approach
- Analyze the architecture holistically across all five pillars
- Provide specific, actionable recommendations (not generic advice)
- Identify affected resources explicitly
- Prioritize findings by severity (critical, high, medium, low)
- Include "Quick Wins" - high-impact, easy-to-implement changes

#### Severity Levels
- **Critical**: Security vulnerabilities, single points of failure, data loss risks
- **High**: Significant cost inefficiencies, performance bottlenecks, poor resilience
- **Medium**: Best practice violations, moderate improvements
- **Low**: Optional optimizations, minor enhancements

#### Scoring System
- Overall score: 0-100 (weighted average of five pillars)
- Each pillar scored independently: 0-100
- Score ranges:
  - 80-100: Excellent (Green)
  - 60-79: Good (Yellow)
  - 40-59: Needs improvement (Orange)
  - 0-39: Poor (Red)

#### JSON Response Structure
```json
{
  "overallScore": 75,
  "summary": "Overall assessment summary",
  "pillars": [
    {
      "pillar": "Reliability",
      "score": 80,
      "findings": [
        {
          "severity": "high",
          "category": "High Availability",
          "issue": "Specific issue description",
          "recommendation": "Detailed, actionable recommendation",
          "resources": ["affected-service-1", "affected-service-2"],
          "actionable": true
        }
      ]
    }
  ],
  "quickWins": [
    {
      "severity": "high",
      "category": "Category",
      "recommendation": "Quick win recommendation",
      "actionable": true
    }
  ]
}
```

#### Common Validation Patterns
- Missing monitoring → Add Application Insights
- No backup strategy → Configure backup policies
- Single region deployment → Multi-region for DR
- Public endpoints → Private endpoints
- No auto-scaling → Configure autoscale rules
- Missing Key Vault → Centralize secrets management
- No managed identities → Replace keys with managed identities
- Inadequate caching → Add Redis Cache or CDN
- Over-provisioned resources → Right-size recommendations

---

## 3. Deployment Guide Generator (GPT-5.2)

**File**: `src/services/deploymentGuideGenerator.ts`  
**Function**: `generateDeploymentGuide(...)`  
**Max Tokens**: 10,000  
**Temperature**: 0.3  
**Response Format**: JSON Object

### Purpose
Generate comprehensive, production-ready deployment documentation including prerequisites, step-by-step instructions, configuration, and troubleshooting.

### Key Instructions

#### Documentation Sections

**1. Prerequisites**
- Azure CLI installation and configuration
- Required Azure subscriptions and permissions
- Development tools and SDKs
- Service principal creation
- Required PowerShell modules

**2. Estimated Time**
- Realistic time estimate for complete deployment
- Includes provisioning, configuration, and testing
- Considers Azure resource provisioning times

**3. Deployment Steps** (Detailed)
- **Title**: Clear step name
- **Description**: Detailed explanation of what and why
- **Commands**: Actual Azure CLI/PowerShell commands (copy-paste ready)
- **Azure Portal Steps**: Alternative UI-based instructions
- **Notes**: Important considerations, warnings, or tips

**4. Configuration**
- Service-specific settings grouped by section
- Each setting includes:
  - Name (property name)
  - Value (default or recommended)
  - Description (purpose and impact)

**5. Post-Deployment**
- Verification steps
- Testing procedures
- Monitoring setup
- Security hardening checklist

**6. Troubleshooting**
- Common issues with specific solutions
- Error messages and resolution steps
- Diagnostic commands
- Support resources

**7. Estimated Cost**
- Monthly cost estimation with breakdown
- Assumptions and variables affecting cost
- Cost optimization recommendations

#### Command Generation Guidelines
- Use Azure CLI format (preferred for automation)
- Include resource group, location, and naming conventions
- Add comments explaining complex commands
- Use consistent naming patterns (lowercase, hyphens)
- Include required parameters explicitly
- Add `--output table` for better readability
- Show both create and configure commands

#### Example Command Patterns
```bash
# Create resource group
az group create \
  --name rg-myapp-prod \
  --location eastus2

# Create App Service plan
az appservice plan create \
  --name plan-myapp-prod \
  --resource-group rg-myapp-prod \
  --sku P1V2 \
  --is-linux

# Create App Service
az webapp create \
  --name app-myapp-prod \
  --resource-group rg-myapp-prod \
  --plan plan-myapp-prod \
  --runtime "NODE|18-lts"
```

#### JSON Response Structure
```json
{
  "title": "Deployment Guide: [Architecture Name]",
  "overview": "High-level deployment overview",
  "prerequisites": [
    "Prerequisite item 1",
    "Prerequisite item 2"
  ],
  "estimatedTime": "30-45 minutes",
  "deploymentSteps": [
    {
      "step": 1,
      "title": "Step title",
      "description": "Detailed description",
      "commands": [
        "az command 1",
        "az command 2"
      ],
      "azurePortalSteps": [
        "Portal step 1",
        "Portal step 2"
      ],
      "notes": [
        "Important note 1"
      ]
    }
  ],
  "configuration": [
    {
      "section": "App Service Configuration",
      "settings": [
        {
          "name": "SETTING_NAME",
          "value": "value",
          "description": "What this setting does"
        }
      ]
    }
  ],
  "postDeployment": [
    "Verification step 1",
    "Testing procedure 2"
  ],
  "troubleshooting": [
    {
      "issue": "Common issue description",
      "solution": "Step-by-step solution"
    }
  ],
  "estimatedCost": "$150-300/month based on...",
  "timestamp": "2026-01-11T02:00:00.000Z"
}
```

#### Best Practices to Include
- Use infrastructure as code (ARM templates, Bicep, or Terraform)
- Implement CI/CD pipelines
- Enable monitoring from day one
- Use managed identities instead of connection strings
- Store secrets in Key Vault
- Enable diagnostic logging
- Configure alerts and notifications
- Implement automated backups
- Set up staging environments
- Document rollback procedures

---

## Token Allocation Strategy

### GPT-5.2 Reasoning Tokens
GPT-5.2 uses **reasoning tokens** internally (not visible in output) to process complex requests. Token allocation accounts for this:

| Agent | Max Completion Tokens | Reasoning Budget | Output Budget |
|-------|----------------------|------------------|---------------|
| **Diagram Generator** | 6,000 | ~1,500-2,000 | ~4,000-4,500 |
| **Architecture Validator** | 8,000 | ~3,000-3,500 | ~4,500-5,000 |
| **Deployment Guide** | 10,000 | ~3,000-4,000 | ~6,000-7,000 |

### Why Different Token Limits?
- **Diagram Generator**: Smaller JSON output, focused structure
- **Architecture Validator**: Complex analysis across 5 pillars, detailed findings
- **Deployment Guide**: Extensive documentation with commands, notes, and steps

---

## API Configuration

### Request Parameters
```typescript
{
  messages: [...],
  max_completion_tokens: 6000-10000,  // Agent-specific
  temperature: 0.3,                    // Consistent, focused responses
  response_format: { type: 'json_object' }  // Enforces valid JSON
}
```

### API Version
`2024-08-01-preview` - Supports GPT-5.2 with reasoning tokens

### Error Handling
- 401: Invalid API key
- 404: Deployment not found
- 429: Rate limit exceeded
- 500: Azure service error

---

## Markdown Export Features

### Architecture Validator Report
Generated by `formatValidationReport(validation)`:
- Executive summary with overall score
- Visual score representation (emoji status indicators)
- Pillar-by-pillar breakdown with scores table
- Detailed findings with severity badges (🔴🟠🟡🟢)
- Quick wins section
- Microsoft Learn resource links
- Timestamp and metadata

### Deployment Guide Export
Generated by `formatDeploymentGuide(guide)`:
- Complete deployment documentation
- Code blocks for copy-paste commands
- Numbered steps with descriptions
- Configuration tables
- Troubleshooting section
- Cost estimates
- Timestamp and metadata

---

## Usage Examples

### Main Diagram Generator
```typescript
const result = await generateArchitectureWithAI(
  "Build a serverless e-commerce platform with AI recommendations"
);
// Returns: { groups, services, connections, workflow }
```

### Architecture Validator
```typescript
const validation = await validateArchitecture(
  services,      // Array of service objects
  connections,   // Array of connection objects
  groups,        // Optional groups array
  "E-commerce platform"  // Description
);
// Returns: { overallScore, summary, pillars, quickWins, timestamp }
```

### Deployment Guide Generator
```typescript
const guide = await generateDeploymentGuide(
  services,
  connections,
  groups,
  "E-commerce platform",
  250  // Estimated monthly cost
);
// Returns: Full deployment guide JSON
```

---

## Future Enhancements

### Potential Improvements
1. **Agent Comparison**: A/B testing different models (GPT-4 vs GPT-5.2)
2. **Cost Tracking**: Monitor token usage per agent
3. **Caching**: Cache common validation patterns
4. **Streaming**: Real-time response streaming for better UX
5. **Multi-language**: Support for non-English documentation
6. **Custom Templates**: User-defined instruction templates
7. **Feedback Loop**: Learn from user corrections and ratings

---

## Maintenance Notes

### When to Update Instructions
- New Azure services released
- Well-Architected Framework updates
- Model performance issues
- User feedback indicating incorrect guidance
- Azure naming convention changes

### Testing Recommendations
- Test with various architecture types (web, data, AI, IoT)
- Validate JSON schema compliance
- Check markdown rendering quality
- Verify command accuracy (run actual deployments)
- Monitor token usage and adjust limits

---

**Document Version**: 1.0  
**Model**: GPT-5.2 (Azure OpenAI)  
**Last Tested**: January 11, 2026
