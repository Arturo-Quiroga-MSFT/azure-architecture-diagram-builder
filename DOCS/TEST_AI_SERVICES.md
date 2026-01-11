# AI Services Pricing Integration Test

## What Was Changed

### 1. Regional Pricing Service (`src/services/regionalPricingService.ts`)
- Added `AI_SERVICE_PRODUCT_MAP` to map display names to Foundry productNames
- Added `isAIService()` function to detect AI services
- Modified `loadServiceData()` to:
  - Load `foundry_models.json` or `foundry_tools.json` for AI services
  - Filter by `productName` field (e.g., "Azure OpenAI", "Azure Language")
  - Cache filtered results
- Updated `parsePricingTiers()` to handle different billing units:
  - Monthly pricing: `/Month`, `1/Month` (commitment tiers)
  - Daily pricing: `/Day`, `1/Day` (multiply by 30)
  - Per-1K pricing: `1K`, `1000` (estimate 100K trans/month)
  - Hourly pricing: default (multiply by 730)

### 2. Service Name Mappings (`src/data/azurePricing.ts`)
- Updated AI service mappings to use simplified names:
  - "Azure AI Document Intelligence" → "Document Intelligence"
  - "Azure AI Language" → "Language"
  - "Azure AI Speech" → "Speech"
  - "Azure AI Vision" → "Vision"
  - "Azure AI Translator" → "Translator"
- These names match the keys in `AI_SERVICE_PRODUCT_MAP`

### 3. Default Tiers
- All AI services now default to "Standard" tier
- This provides reasonable estimates for typical usage

## How It Works

### For Azure OpenAI:
1. User adds "Azure OpenAI" node to diagram
2. Service name mapped to "Azure OpenAI" (via SERVICE_NAME_MAPPING)
3. Regional pricing service loads `foundry_models.json`
4. Filters items where `productName === "Azure OpenAI"`
5. Selects SKUs containing "gpt4omini" or "Standard"
6. Calculates monthly cost based on token pricing (per 1K)

### For Other AI Services (Language, Speech, Vision, etc.):
1. User adds AI service node (e.g., "Language")
2. Service name mapped to "Language" (via SERVICE_NAME_MAPPING)
3. Regional pricing service loads `foundry_tools.json`
4. Filters items where `productName === "Azure Language"`
5. Selects "Standard" SKU or similar
6. Calculates monthly cost based on unit of measure

## Test Instructions

1. **Open the app**: http://localhost:3000
2. **Add AI service nodes** from the icon palette:
   - Azure OpenAI
   - Document Intelligence
   - Language
   - Speech
   - Vision
   - Translator
   
3. **Check pricing badges**:
   - All should show blue ⚡ badge (usage-based)
   - Hover to see estimated monthly cost
   - Costs should be realistic (not $0, not fallback estimates)

4. **Open browser console** and look for:
   ```
   🤖 AI Service detected: Language → Loading from foundry_tools, filtering by productName: Azure Language
   📦 Loaded AI service Language for eastus2: XX items (filtered from 559)
   ```

5. **Export cost breakdown** (CSV button):
   - Should show real pricing data
   - "Pricing Type" column should say "Usage-Based"
   - Costs should match Foundry pricing data

## Expected Pricing Ranges (per month, typical usage)

- **Azure OpenAI**: $1-100 (depends on token usage)
- **Document Intelligence**: $0-500 (Free tier or Standard)
- **Language**: $25-250 (Standard to S1)
- **Speech**: $100-1000 (Standard to S1)
- **Vision**: $150-1500 (Standard to S1)
- **Translator**: $100-1000 (Standard)

## Troubleshooting

### If pricing shows $0 or fallback estimates:
1. Check browser console for errors
2. Verify Foundry files exist: `ls src/data/pricing/regions/eastus2/foundry_*.json`
3. Check file size: `du -h src/data/pricing/regions/eastus2/foundry_*.json`
   - foundry_models.json should be ~450KB
   - foundry_tools.json should be ~300KB

### If services don't appear:
1. Check SERVICE_NAME_MAPPING in azurePricing.ts
2. Check AI_SERVICE_PRODUCT_MAP in regionalPricingService.ts
3. Ensure service name matches exactly (case-sensitive)

## Known Limitations

1. **Multiple SKUs**: Real data has hundreds of SKUs per service
   - We pick first matching "Standard" or similar
   - Users can't select specific model/tier yet

2. **Commitment Tiers**: Very expensive monthly commitments included
   - Filter logic prefers standard pay-as-you-go pricing
   - High-volume users would want commitment tiers

3. **Usage Estimation**: Monthly cost is estimated
   - Token-based: assumes 100K tokens/month
   - Transaction-based: assumes 100K transactions/month
   - Actual usage varies greatly

4. **Free Tier**: Some services have Free tier in data
   - Currently not prioritized in tier selection
   - Would show $0 if selected

## Success Criteria

✅ AI services load pricing from Foundry files
✅ Pricing badges show realistic costs (not fallback)
✅ Blue ⚡ badge indicates usage-based pricing
✅ Console logs show "AI Service detected" messages
✅ CSV export includes real pricing data
✅ Different regions show different costs (if available)
