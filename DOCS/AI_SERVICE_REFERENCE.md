# Azure Services Icon & Pricing Reference

**For AI/LLM Diagram Generation**

This reference helps AI systems generate accurate Azure architecture diagrams with correct icons and pricing-supported services.

## Services with Real Pricing Data ✅

### AI & Machine Learning (9 services)

| Service Name | Aliases | Has Pricing | Icon | Cost Range |
|--------------|---------|-------------|------|------------|
| **Azure OpenAI** | OpenAI, GPT, ChatGPT | ✅ | 03438-Azure-OpenAI | $1-200/mo |
| **Cognitive Services** | Azure Cognitive Services | ✅ | 10162-Cognitive-Services | $0-500/mo |
| **Computer Vision** | Vision, Azure Vision, Image Analysis | ✅ | 00792-Computer-Vision | $150-1500/mo |
| **Custom Vision** | Azure Custom Vision | ✅ | 00793-Custom-Vision | $0-300/mo |
| **Speech Services** | Speech, Speech-to-Text, Text-to-Speech | ✅ | 00797-Speech-Services | $100-1000/mo |
| **Translator** | Translator Text, Translation | ✅ | 00800-Translator-Text | $100-1000/mo |
| **Language** | Text Analytics, NLP | ✅ | 02876-Language | $25-250/mo |
| **Document Intelligence** | Form Recognizer, Form Processing | ✅ | 02749-Azure-Applied-AI-Services | $0-500/mo |
| **Azure Machine Learning** | ML, AML | ✅ | 10166-Machine-Learning | $0-5000/mo |

### Compute (6 services)

| Service Name | Aliases | Has Pricing | Icon | Cost Range |
|--------------|---------|-------------|------|------------|
| **Virtual Machines** | VM, VMs | ✅ | 10021-Virtual-Machine | $13-17340/mo |
| **App Service** | Web App, Azure App Service | ✅ | 10035-App-Services | $13-730/mo |
| **Azure Functions** | Function App, Serverless | ✅ | 10029-Function-Apps | $0-160/mo |
| **Container Instances** | ACI | ✅ | 10104-Container-Instances | $0-500/mo |
| **Kubernetes Service** | AKS, K8s | ✅ | 10023-Kubernetes-Services | $73/mo + nodes |
| **Container Registry** | ACR | ✅ | 10105-Container-Registries | $5-1000/mo |

### Databases (4 services)

| Service Name | Aliases | Has Pricing | Icon | Cost Range |
|--------------|---------|-------------|------|------------|
| **Azure Cosmos DB** | Cosmos DB, CosmosDB | ✅ | 10121-Azure-Cosmos-DB | $24-29185/mo |
| **SQL Database** | Azure SQL | ✅ | 10132-SQL-Database | $5-43800/mo |
| **PostgreSQL** | Azure Database for PostgreSQL | ✅ | 10130-Azure-Database-PostgreSQL-Server | $5-11240/mo |
| **Redis Cache** | Azure Cache for Redis | ✅ | 10059-Cache-Redis | $16-13600/mo |

### Storage (1 service)

| Service Name | Aliases | Has Pricing | Icon | Cost Range |
|--------------|---------|-------------|------|------------|
| **Storage Account** | Storage, Blob Storage | ✅ | 10086-Storage-Accounts | $0.02-184/mo per GB |

### Networking (3 services)

| Service Name | Aliases | Has Pricing | Icon | Cost Range |
|--------------|---------|-------------|------|------------|
| **Application Gateway** | App Gateway | ✅ | 10065-Application-Gateways | $125-1200/mo |
| **Azure Front Door** | Front Door, AFD | ✅ | 10062-Front-Doors | $35-412/mo + traffic |
| **CDN** | Azure CDN, Content Delivery Network | ✅ | 10061-CDN-Profiles | $0.081-0.20 per GB |

### Analytics & Integration (4 services)

| Service Name | Aliases | Has Pricing | Icon | Cost Range |
|--------------|---------|-------------|------|------------|
| **Data Factory** | Azure Data Factory, ADF | ✅ | 10260-Data-Factory | $0.50-2.50/1K activities |
| **Event Hubs** | Azure Event Hubs | ✅ | 10209-Event-Hubs | $11-6849/mo |
| **Service Bus** | Azure Service Bus | ✅ | 10207-Service-Bus | $0-10/mo + messages |
| **Logic Apps** | Azure Logic Apps | ✅ | 10218-Logic-Apps | $0-1000/mo |

### Management & Security (3 services)

| Service Name | Aliases | Has Pricing | Icon | Cost Range |
|--------------|---------|-------------|------|------------|
| **Key Vault** | Azure Key Vault, Secrets | ✅ | 10245-Key-Vaults | $0.03/10K ops |
| **Application Insights** | App Insights, Monitoring | ✅ | 00012-Application-Insights | $2.30 per GB |
| **API Management** | APIM, API Gateway | ✅ | 10042-API-Management-Services | $50-2800/mo |

---

## AI Diagram Generation Guidelines

### For AI/LLM Systems:

1. **Use official service names** from the "Service Name" column
2. **Aliases are recognized** - any alias will map to the correct service
3. **All listed services have real pricing data** - costs are automatically calculated
4. **Icon files are automatically resolved** - you don't need to specify icon paths

### Example Prompts That Work Well:

```
"Create a diagram with Azure OpenAI, Speech Services, and Language connected to Cosmos DB"
```
✅ All services recognized, correct icons, real pricing

```
"Build an architecture using GPT, Text Analytics, and Azure SQL"
```
✅ Aliases resolved to Azure OpenAI, Language, SQL Database

```
"Design a system with Computer Vision analyzing images stored in Blob Storage"
```
✅ Computer Vision + Storage Account (Blob is an alias)

### Service Categories:

- **Usage-Based** 💡: Azure OpenAI, Functions, Storage, Cosmos DB, CDN (costs scale with usage)
- **Fixed-Price** 💵: Virtual Machines, App Service, SQL Database (monthly per-instance)

### Important Notes:

1. **Cognitive Services** is an umbrella service that includes:
   - Computer Vision, Speech, Language, Translator, Custom Vision
   - Use specific services (e.g., "Computer Vision") for better cost accuracy

2. **Azure OpenAI** pricing is token-based:
   - Actual cost depends on model used (GPT-4, GPT-4 Mini, etc.)
   - Default estimate assumes GPT-4 Mini

3. **All AI services** are usage-based:
   - Costs shown are estimates for typical monthly usage
   - Actual costs vary significantly based on transaction volume

4. **Regional pricing available** for:
   - East US 2 (Virginia, USA) 🇺🇸
   - Sweden Central (Gävle, Sweden) 🇸🇪
   - West Europe (Netherlands) 🇳🇱

---

## Usage in Code

```typescript
import { getServiceIconMapping, hasRealPricingData } from './serviceIconMapping';

// Check if service has pricing
const hasPrice = hasRealPricingData('Azure OpenAI'); // true

// Get icon and details
const mapping = getServiceIconMapping('GPT'); // resolves alias to Azure OpenAI
console.log(mapping?.iconFile); // '03438-icon-service-Azure-OpenAI'
console.log(mapping?.hasPricingData); // true
console.log(mapping?.costRange); // '$1-200/mo (token-based)'
```

---

## Total Coverage

- ✅ **30 services with real pricing data**
- ✅ **9 AI & Machine Learning services**
- ✅ **100+ service name aliases recognized**
- ✅ **Icon files mapped for all services**
- ✅ **Cost ranges provided for estimation**

---

**Last Updated**: January 10, 2026  
**Pricing Data Source**: Azure Retail Prices API  
**Icon Library**: Azure Public Service Icons (Official)
