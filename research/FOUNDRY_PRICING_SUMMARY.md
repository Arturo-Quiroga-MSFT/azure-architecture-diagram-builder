# Foundry Pricing Data Summary

## Successfully Downloaded

### Foundry Models (Azure OpenAI)
- **eastus2**: 738 items
- **swedencentral**: 737 items  
- **westeurope**: 737 items

Products include:
- Azure OpenAI (GPT-4, GPT-4 Mini, etc.)
- Azure OpenAI GPT5
- Azure OpenAI Media (image/video models)
- Azure OpenAI Reasoning

**Pricing Structure**: Token-based (per 1K tokens)
- Input tokens: $0.01 - $8.80 per 1K
- Output tokens: $0.002 - $2.64 per 1K
- Cached tokens: $0.000605 per 1K (cheaper)

### Foundry Tools (AI Services)
- **eastus2**: 559 items
- **swedencentral**: 543 items
- **westeurope**: 559 items

Products include:
- **Azure Language** - Text analytics, sentiment, NER, etc.
- **Azure Speech** - Speech-to-text, text-to-speech
- **Azure Vision** - Computer vision, image analysis
- **Azure Vision - Face** - Facial recognition
- **Azure Document Intelligence** - Form/document processing
- **Azure Custom Vision** - Custom image classification
- **Azure Translator** - Text translation
- **Content Safety** - Content moderation
- **Anomaly Detector** - Time-series anomaly detection
- **Form Recognizer** (legacy name for Document Intelligence)
- **Language Understanding** (LUIS)
- **Personalizer** - Reinforcement learning recommendations

**Pricing Structures**:
1. **Free Tier**: $0 (limited usage)
2. **Standard Pay-As-You-Go**: 
   - Per transaction: $0.20 - $2.00 per 1K transactions
   - Per hour: $0.195 - $0.62 per hour (speech)
   - Per day: $1.29 - $8.06 per day
3. **Commitment Tiers**: 
   - Monthly: $4,080 - $14,000/month for guaranteed capacity
   - Overage charges: $0.20 - $0.70 per 1K over limit

## Usage in Application

### Mapping Display Names to API Products

| User-Facing Name | API productName | Notes |
|-----------------|-----------------|-------|
| Azure OpenAI | Azure OpenAI | From Foundry Models |
| Document Intelligence | Azure Document Intelligence | From Foundry Tools |
| Form Recognizer | Form Recognizer | Legacy name, same as Document Intelligence |
| Language | Azure Language | From Foundry Tools |
| Speech | Azure Speech | From Foundry Tools |
| Vision | Azure Vision | From Foundry Tools |
| Computer Vision | Azure Vision | Same as Vision |
| Face | Azure Vision - Face | Separate product for face detection |
| Translator | Azure Translator, Translator Text | From Foundry Tools |
| Custom Vision | Azure Custom Vision | From Foundry Tools |

### Recommended Default Tiers for Estimation

Based on the pricing data:

- **Azure OpenAI**: Use GPT-4 Mini input tokens @ $0.01/1K
- **Azure Language**: S1 tier @ ~$8/day or Standard @ $2/1K
- **Azure Speech**: S0/S1 @ ~$1.29/day
- **Azure Vision**: Standard pay-as-you-go @ varies by operation
- **Azure Document Intelligence**: Standard @ varies by page
- **Azure Translator**: Standard @ $0.20-$0.70/1K characters

## Key Insights

1. **Most AI services have multiple pricing tiers**: Free, Standard, S0, S1, Commitment Tiers
2. **Commitment tiers offer cost savings** for high-volume usage (monthly contracts)
3. **Different billing units**: tokens, transactions, hours, days, pages, characters
4. **Disconnected variants** exist for air-gapped/offline deployments (higher pricing)
5. **Regional pricing** varies slightly across regions

## Next Steps

Update `src/data/azurePricing.ts` to:
1. Map service names to correct productName in Foundry Models/Tools
2. Filter pricing data by productName instead of serviceName
3. Select appropriate default SKUs (Standard, S0, S1)
4. Calculate monthly estimates based on typical usage patterns
