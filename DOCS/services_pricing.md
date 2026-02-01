# Azure Services with Regional Pricing Data

**Last Updated:** January 31, 2026

This document lists all Azure services that have local pricing data loaded from regional JSON files across all 5 supported regions.

## Coverage Summary

| Region | Files | Pricing Items |
|--------|-------|---------------|
| East US 2 🇺🇸 (HERO) | 39 | ~6,100+ |
| Canada Central 🇨🇦 (HUB) | 39 | ~5,100+ |
| Brazil South 🇧🇷 (HUB) | 39 | ~5,300+ |
| West Europe 🇳🇱 (HUB) | 39 | ~5,900+ |
| Sweden Central 🇸🇪 (HUB) | 39 | ~5,500+ |

## Services with Direct Pricing Data (39 services)

### Compute (9 services)
- **Azure App Service** - Web apps, APIs, mobile backends
- **Virtual Machines** - Windows and Linux VMs (1000+ SKUs)
- **Azure Kubernetes Service (AKS)** - Managed Kubernetes
- **Container Instances** - Serverless containers
- **Container Registry** - Docker container registry
- **Functions** - Serverless compute (Azure Functions)
- **Logic Apps** - Workflow automation
- **Azure Firewall** - Network firewall
- **VPN Gateway** - VPN connectivity

### Databases (5 services)
- **Azure Cosmos DB** - Global NoSQL database
- **SQL Database** - Managed SQL Server
- **Azure Database for PostgreSQL** - Managed PostgreSQL
- **Azure Database for MySQL** - Managed MySQL
- **Redis Cache** - In-memory cache

### Storage (1 service)
- **Storage** - Blob, File, Queue, Table storage (1000+ items)

### Networking (6 services)
- **Application Gateway** - Layer 7 load balancer
- **Azure Front Door Service** - Global HTTP load balancer (341 items)
- **ExpressRoute** - Private Azure connectivity
- **Virtual Network** - VNet peering and services
- **Network Watcher** - Network monitoring
- **Content Delivery Network** - CDN (631 items)

### Analytics & Data (4 services)
- **Azure Data Factory** - ETL/ELT pipelines
- **Azure Synapse Analytics** - Data warehousing
- **Stream Analytics** - Real-time analytics
- **Azure Machine Learning** - ML platform

### AI & Cognitive Services (via Foundry - 14+ services)
- **Foundry Models** - Azure OpenAI, GPT-4, GPT-4o, etc. (750-1000 items/region)
- **Foundry Tools** - Document Intelligence, Vision, Speech, Language, Translator (320-560 items/region)

### Integration & Messaging (4 services)
- **Service Bus** - Message queuing
- **Event Hubs** - Event streaming
- **Event Grid** - Event routing
- **Notification Hubs** - Push notifications

### Monitoring & Management (5 services)
- **Application Insights** - APM
- **Azure Monitor** - Metrics and alerts (200+ items)
- **Log Analytics** - Log management
- **Key Vault** - Secrets management
- **API Management** - API gateway

### Security & Backup (2 services)
- **Microsoft Defender for Cloud** - Security posture
- **Backup** - Azure Backup

### Developer Tools (1 service)
- **Azure DevOps** - CI/CD and repos

## AI Services Mapping

AI services are priced through Foundry data files with intelligent mapping:

| Display Name | Source File | Product Filter |
|-------------|-------------|----------------|
| Azure OpenAI / OpenAI | foundry_models | Azure OpenAI |
| Document Intelligence | foundry_tools | Azure Document Intelligence |
| Form Recognizer | foundry_tools | Form Recognizer |
| Language / Text Analytics | foundry_tools | Azure Language |
| Speech / Speech Services | foundry_tools | Azure Speech |
| Vision / Computer Vision | foundry_tools | Azure Vision |
| Face | foundry_tools | Azure Vision - Face |
| Translator | foundry_tools | Azure Translator |
| Custom Vision | foundry_tools | Azure Custom Vision |
| Content Safety | foundry_tools | Content Safety |

## Fallback Pricing

Services **not** in the regional data files use fallback estimates from `src/data/azurePricing.ts`:
- Static Web Apps (usage-based)
- Azure IoT Hub / IoT Central
- Azure SignalR Service
- Azure Sentinel
- Site Recovery
- Azure Automation
- Load Balancer (consumption-based)
- Traffic Manager (usage-based)

## Data Source

Pricing data is fetched from the [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices):

```bash
cd scripts && ./fetch-multi-region-pricing.sh
```

Script downloads 71 services × 5 regions, filters empty data, and stores in `src/data/pricing/regions/`.

## Regional Pricing

Real regional pricing differences are automatically reflected when switching regions in the UI:
1. Loads from regional JSON files (`src/data/pricing/regions/{region}/`)
2. AI services filter from Foundry files by productName
3. Falls back to static estimates with regional multipliers if no data found