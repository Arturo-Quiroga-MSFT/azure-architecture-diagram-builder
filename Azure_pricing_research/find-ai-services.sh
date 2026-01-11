#!/bin/bash

# Deep dive into finding AI service pricing
OUTPUT_DIR="./samples"

echo "🔍 Deep Dive: Finding AI Services in Azure Pricing API"
echo "========================================================"
echo ""

# Check Foundry Models and Tools (Azure AI Foundry)
echo "1️⃣  Testing Foundry Models and Tools"
echo "------------------------------------"
for service in "Foundry Models" "Foundry Tools"; do
  echo "📊 Service: $service"
  curl -s -G "https://prices.azure.com/api/retail/prices" \
    --data-urlencode "api-version=2023-01-01-preview" \
    --data-urlencode "\$filter=serviceName eq '$service' and armRegionName eq 'eastus2'" \
    --data-urlencode "\$top=10" | \
    jq '{Count: .Count, Sample: .Items[0] | {productName, skuName, meterName, unitPrice, unitOfMeasure}}'
  echo ""
done

# Search for any service with "intelligence", "cognitive", "vision", "speech" in productName
echo ""
echo "2️⃣  Searching for AI-related products across all services"
echo "----------------------------------------------------------"
curl -s -G "https://prices.azure.com/api/retail/prices" \
  --data-urlencode "api-version=2023-01-01-preview" \
  --data-urlencode "\$filter=armRegionName eq 'eastus2'" \
  --data-urlencode "\$top=500" | \
  jq -r '.Items[] | select(.productName | test("(?i)(intelligence|cognitive|vision|speech|language|translator|openai|recognizer|analytics)")) | "\(.serviceName) | \(.productName)"' | \
  sort -u

echo ""
echo ""
echo "3️⃣  Checking Microsoft Copilot Studio"
echo "--------------------------------------"
curl -s -G "https://prices.azure.com/api/retail/prices" \
  --data-urlencode "api-version=2023-01-01-preview" \
  --data-urlencode "\$filter=serviceName eq 'Microsoft Copilot Studio' and armRegionName eq 'eastus2'" \
  --data-urlencode "\$top=10" | \
  jq '{Count: .Count, Products: [.Items[] | {productName, skuName, meterName, unitPrice}]}'

echo ""
echo ""
echo "4️⃣  Searching without region filter for global AI services"
echo "-----------------------------------------------------------"
for service in "Azure OpenAI" "OpenAI" "Cognitive Services" "AI Services"; do
  echo "Testing: $service"
  count=$(curl -s -G "https://prices.azure.com/api/retail/prices" \
    --data-urlencode "api-version=2023-01-01-preview" \
    --data-urlencode "\$filter=serviceName eq '$service'" \
    --data-urlencode "\$top=1" | jq '.Count')
  echo "  Result: $count items"
done

echo ""
echo "✅ Search complete!"
