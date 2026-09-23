# Icon File Renaming Proposal

## Problem
Current icon file names don't match Azure service names, requiring complex normalization mappings:
- Icon: `10042-icon-service-API-Management-Services.svg` → becomes "Api Management Services"  
- Pricing API: "API Management"
- AI generates: "API Management"
- **Result**: Need manual mapping

## Solution
Rename icon files to match the **canonical Azure service names** used in:
1. Azure Pricing API (`serviceName` or `productName` field)
2. Azure documentation
3. AI-generated diagrams

## Proposed Naming Convention

**Format**: `<service-name>.svg` (lowercase with hyphens)

### Benefits:
- Direct 1:1 mapping between service name and icon file
- No normalization needed
- Easy to maintain
- Consistent with Azure naming

## Icon Renaming Map

### AI & Machine Learning
| Current File | Current Parsed Name | Azure Service Name | New File Name |
|-------------|---------------------|-------------------|---------------|
| 03438-icon-service-Azure-OpenAI.svg | Azure Openai | Azure OpenAI | azure-openai.svg |
| 00792-icon-service-Computer-Vision.svg | Computer Vision | Computer Vision | computer-vision.svg |
| 00797-icon-service-Speech-Services.svg | Speech Services | Azure Speech | azure-speech.svg |
| 02876-icon-service-Language.svg | Language | Language | language.svg |
| 00800-icon-service-Translator-Text.svg | Translator Text | Translator | translator.svg |
| 02749-icon-service-Azure-Applied-AI-Services.svg | Azure Applied Ai Services | Document Intelligence | document-intelligence.svg |
| 00793-icon-service-Custom-Vision.svg | Custom Vision | Custom Vision | custom-vision.svg |
| 10166-icon-service-Machine-Learning.svg | Machine Learning | Azure Machine Learning | azure-machine-learning.svg |

### App Services & Integration
| Current File | Current Parsed Name | Azure Service Name | New File Name |
|-------------|---------------------|-------------------|---------------|
| 10042-icon-service-API-Management-Services.svg | Api Management Services | API Management | api-management.svg |
| 10035-icon-service-App-Services.svg | App Services | App Service | app-service.svg |
| 10029-icon-service-Function-Apps.svg | Function Apps | Azure Functions | azure-functions.svg |
| 10040-icon-service-Logic-Apps.svg | Logic Apps | Logic Apps | logic-apps.svg |

### Databases
| Current File | Current Parsed Name | Azure Service Name | New File Name |
|-------------|---------------------|-------------------|---------------|
| 10121-icon-service-Azure-Cosmos-DB.svg | Azure Cosmos Db | Azure Cosmos DB | azure-cosmos-db.svg |
| 10132-icon-service-SQL-Database.svg | Sql Database | SQL Database | sql-database.svg |
| 10122-icon-service-Azure-Cache-Redis.svg | Azure Cache Redis | Azure Cache for Redis | azure-cache-redis.svg |
| 10130-icon-service-Azure-Database-PostgreSQL-Server.svg | Azure Database Postgresql Server | Azure Database for PostgreSQL | azure-database-postgresql.svg |

### Compute
| Current File | Current Parsed Name | Azure Service Name | New File Name |
|-------------|---------------------|-------------------|---------------|
| 10021-icon-service-Virtual-Machine.svg | Virtual Machine | Virtual Machines | virtual-machines.svg |
| 10023-icon-service-Kubernetes-Services.svg | Kubernetes Services | Azure Kubernetes Service | azure-kubernetes-service.svg |
| 10104-icon-service-Container-Instances.svg | Container Instances | Container Instances | container-instances.svg |
| 10105-icon-service-Container-Registries.svg | Container Registries | Container Registry | container-registry.svg |

### Storage
| Current File | Current Parsed Name | Azure Service Name | New File Name |
|-------------|---------------------|-------------------|---------------|
| 10086-icon-service-Storage-Accounts.svg | Storage Accounts | Storage | storage-account.svg |

### Analytics & Integration
| Current File | Current Parsed Name | Azure Service Name | New File Name |
|-------------|---------------------|-------------------|---------------|
| 10209-icon-service-Event-Hubs.svg | Event Hubs | Event Hubs | event-hubs.svg |
| 10207-icon-service-Service-Bus.svg | Service Bus | Service Bus | service-bus.svg |
| 10260-icon-service-Data-Factory.svg | Data Factory | Data Factory | data-factory.svg |

### Monitoring & Security
| Current File | Current Parsed Name | Azure Service Name | New File Name |
|-------------|---------------------|-------------------|---------------|
| 00012-icon-service-Application-Insights.svg | Application Insights | Application Insights | application-insights.svg |
| 10245-icon-service-Key-Vaults.svg | Key Vaults | Key Vault | key-vault.svg |

## Implementation Steps

1. **Create rename script** to batch rename files in `Azure_Public_Service_Icons/Icons/`
2. **Update icon loader** to use new naming scheme (remove number prefix parsing)
3. **Remove normalization mappings** from App.tsx (no longer needed)
4. **Update service icon mapping** to use new file names
5. **Test** diagram generation with new names

## Code Changes Required

### iconLoader.ts
```typescript
// OLD: Complex parsing
const iconName = fileName
  .replace('.svg', '')
  .replace(/^\d+-icon-service-/, '')
  .replace(/-/g, ' ')
  .replace(/\b\w/g, l => l.toUpperCase());

// NEW: Simple parsing
const iconName = fileName
  .replace('.svg', '')
  .replace(/-/g, ' ')
  .split(' ')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');
```

### App.tsx
```typescript
// DELETE entire normalizeServiceName() function
// DELETE correctCategory() overrides for App Services

// Icons will match directly by name
```

## Migration Strategy

**Option A: Rename in place** (Recommended)
- Create bash script to rename all icon files
- Single commit with all changes
- Update code to match

**Option B: Keep both naming schemes temporarily**
- Copy icons with new names
- Update code to use new names
- Delete old icons after verification

## Recommendation

✅ **Proceed with Option A** - clean break, simpler long-term

This eliminates ~50 lines of mapping code and makes the system self-documenting.
