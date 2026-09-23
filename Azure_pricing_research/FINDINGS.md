# Azure Pricing API Research Findings

## Key Discovery: AI Services Naming

### The Problem
Azure AI services don't exist as separate `serviceName` values in the Azure Retail Prices API. Trying to fetch "Cognitive Services", "Azure OpenAI", "Form Recognizer", etc. returns 0 results.

### The Solution
AI services are grouped under **TWO** umbrella service names:

#### 1. **Foundry Models** (for Azure OpenAI)
- `serviceName`: "Foundry Models"
- Products include:
  - Azure OpenAI
  - Azure OpenAI GPT5
  - Azure OpenAI Media
  - Azure OpenAI Reasoning
- Pricing structure: Per 1K tokens
- Example: gpt4omini-rt tokens @ $0.01/1K

#### 2. **Foundry Tools** (for all other AI services)
- `serviceName`: "Foundry Tools"
- Products include:
  - Azure Language
  - Azure Speech
  - Azure Vision
  - Azure Document Intelligence
  - Azure Custom Vision
  - Translator Text
  - Form Recognizer (legacy name)
  - Language Understanding (LUIS)
- Pricing structures: 
  - Commitment tiers (monthly)
  - Pay-as-you-go (per transaction/unit)

## API Response Structure

Each pricing item contains:
```json
{
  "serviceName": "Foundry Tools",           // Top-level service category
  "productName": "Azure Language",          // Specific product
  "skuName": "Standard S",                  // Pricing tier/SKU
  "meterName": "Standard S Unit",           // What you're charged for
  "retailPrice": 75.0,                      // Price amount
  "unitOfMeasure": "1/Month",               // Billing unit
  "unitPrice": 75.0,                        // Base unit price
  "armRegionName": "eastus2",               // Region
  "type": "Consumption",                    // Pricing model
  "currencyCode": "USD"
}
```

## Important Fields

- **serviceName**: API category (use "Foundry Models" or "Foundry Tools")
- **productName**: User-facing service name (what shows in Azure portal)
- **skuName**: Pricing tier (Free, Standard, S0, S1, etc.)
- **meterName**: Billing metric (tokens, transactions, units, etc.)
- **type**: Usually "Consumption" for AI services
- **armRegionName**: Azure region (eastus2, swedencentral, etc.)

## Pricing Types Found

### Azure OpenAI (Foundry Models)
- Token-based pricing
- Different models have different rates
- Measured in 1K token increments
- Input and output tokens priced separately

### AI Services (Foundry Tools)
1. **Commitment Tiers**: Fixed monthly cost for guaranteed capacity
   - Example: "Commitment Tier TA4H Connected 1M Unit" @ $14,000/month
2. **Pay-As-You-Go**: Per-transaction pricing
   - Example: "Standard S Unit" @ $75/month
3. **Disconnected Tiers**: For air-gapped deployments

## Services with NO Pricing Data

The following services returned 0 items:
- Static Web Apps
- Azure Data Lake Storage (separate from Storage)
- Some CDN variants

These may be:
- Free tier only
- Bundled with other services
- Using different service names we haven't found

## Next Steps

To fetch AI service pricing, update the fetch script to use:
```bash
SERVICES=(
  # ... existing services ...
  "Foundry Models"   # For Azure OpenAI
  "Foundry Tools"    # For Language, Speech, Vision, Document Intelligence, etc.
)
```

Then filter by `productName` in the application code to separate individual AI services.

## Related Services

- **Azure Cognitive Search**: Has its own serviceName "Azure Cognitive Search"
- **Azure Machine Learning**: Has its own serviceName "Azure Machine Learning"
- **Microsoft Copilot Studio**: Has its own serviceName "Microsoft Copilot Studio"
