# Usage-Based Pricing Implementation

## Overview
Enhanced the cost estimation system to properly identify and display usage-based Azure services (consumption pricing) with visual indicators and realistic estimates.

## Changes Made

### 1. Type Definitions (`src/types/pricing.ts`)
- Added `isUsageBased?: boolean` to `NodePricingConfig` interface
- Tracks whether a service uses consumption-based pricing vs fixed monthly fees

### 2. Service Identification (`src/data/azurePricing.ts`)
- Added `USAGE_BASED_SERVICES` array containing services with variable costs:
  - Storage services (Storage Account, Blob Storage, Data Lake)
  - CDN and Static Web Apps
  - Azure Functions (consumption plan)
  - Event Hubs and Service Bus
  - Cosmos DB (usage-based RU/s)

### 3. Cost Estimation Service (`src/services/costEstimationService.ts`)
- Import and check `USAGE_BASED_SERVICES` during pricing initialization
- Set `isUsageBased: true` for matching services in all return paths:
  - API pricing with $0 base cost
  - API pricing with non-zero cost
  - Fallback pricing
  - Error fallback pricing

### 4. Visual Display (`src/components/AzureNode.tsx`)
- Added **⚡ lightning bolt icon** (Zap from lucide-react) for usage-based services
- **Blue gradient badge** for usage-based services vs green gradient for fixed pricing
- **~ prefix** on cost estimates for usage-based services (e.g., "~$14.60/mo")
- **Enhanced tooltips** explaining:
  - "Usage-based pricing estimate"
  - "Based on typical usage patterns"
  - "Actual cost varies with consumption"
  - Shows tier and region information

### 5. CSV Export (`src/services/costEstimationService.ts`, `src/App.tsx`)
- Added "Pricing Type" column to CSV export
- Shows "Usage-based (estimate)" or "Fixed" for each service
- Pass `nodes` array to export function to access pricing metadata

## User Experience

### Visual Indicators
```
Fixed Pricing:      [💲$69.35/mo]     (green gradient)
Usage-based:        [⚡~$14.60/mo]    (blue gradient)
```

### Tooltip Examples

**Fixed Pricing Service:**
```
Estimated monthly cost
Tier: S1
Quantity: 1
Region: eastus2
Auto-calculated
```

**Usage-Based Service:**
```
Usage-based pricing estimate
~$14.60/month
Based on typical usage patterns
Actual cost varies with consumption

Tier: Standard
Region: eastus2
```

### CSV Export Example
```csv
Service Name,Service Type,Tier,Quantity,Monthly Cost,Pricing Type
"Order Processor",Function Apps,Standard,1,$159.35,Fixed
"Blob Storage",Storage Account,Standard,1,$14.60,Usage-based (estimate)
```

## Benefits

1. **Transparency**: Users clearly see which costs are estimates vs fixed
2. **Accuracy**: Sets proper expectations for variable pricing
3. **Trust**: Honest about consumption-based nature of certain services
4. **Planning**: Users can identify which services need usage monitoring

## Services Affected

### Fixed Pricing (Examples)
- App Services
- SQL Database
- Virtual Machines
- Application Gateway
- Redis Cache
- AKS

### Usage-Based (Now Flagged)
- Storage (per GB)
- CDN (per GB bandwidth)
- Functions (per execution/GB-s)
- Static Web Apps (per GB bandwidth)
- Cosmos DB (per RU/s)
- Event Hubs (per throughput unit)
- Service Bus (per message)

## Implementation Date
January 9, 2026
