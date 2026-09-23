#!/bin/bash

# Research script to understand Azure Retail Prices API structure
# This will fetch sample data and analyze the response structure

OUTPUT_DIR="./samples"
mkdir -p "$OUTPUT_DIR"

echo "🔍 Azure Retail Prices API Research"
echo "===================================="
echo ""

# Function to fetch and analyze a service
analyze_service() {
  local service="$1"
  local region="${2:-eastus2}"
  local filename=$(echo "$service" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
  
  echo "📊 Analyzing: $service (region: $region)"
  echo "   Fetching data..."
  
  # Fetch without priceType filter to see all pricing models
  local response=$(curl -s -G "https://prices.azure.com/api/retail/prices" \
    --data-urlencode "api-version=2023-01-01-preview" \
    --data-urlencode "\$filter=serviceName eq '$service' and armRegionName eq '$region'" \
    --data-urlencode "\$top=20")
  
  echo "$response" > "$OUTPUT_DIR/${filename}_${region}.json"
  
  local count=$(echo "$response" | jq '.Count')
  echo "   ✓ Found $count items"
  
  if [ "$count" -gt 0 ]; then
    echo "   📋 Sample item structure:"
    echo "$response" | jq '.Items[0]' > "$OUTPUT_DIR/${filename}_sample.json"
    
    echo "   🏷️  Unique product names:"
    echo "$response" | jq -r '.Items[] | .productName' | sort -u | head -5
    
    echo "   💰 Price types:"
    echo "$response" | jq -r '.Items[] | .priceType' | sort -u
    
    echo "   📦 SKU names:"
    echo "$response" | jq -r '.Items[] | .skuName' | sort -u | head -5
    
    echo "   📏 Meter names:"
    echo "$response" | jq -r '.Items[] | .meterName' | sort -u | head -5
    
    echo ""
  else
    echo "   ⚠️  No data found"
    echo ""
  fi
}

# Test popular services that definitely work
echo "1️⃣  Testing well-known services"
echo "--------------------------------"
analyze_service "Storage"
analyze_service "Virtual Machines"
analyze_service "Azure Cosmos DB"

echo ""
echo "2️⃣  Testing AI-related services"
echo "--------------------------------"

# Test different possible AI service names
for service_name in \
  "Cognitive Services" \
  "Azure OpenAI" \
  "Azure OpenAI Service" \
  "Azure AI Services" \
  "Applied AI Services" \
  "Azure Cognitive Search"
do
  analyze_service "$service_name"
done

echo ""
echo "3️⃣  Discovering all available service names"
echo "--------------------------------------------"
echo "   Fetching first 200 items from eastus2..."

curl -s -G "https://prices.azure.com/api/retail/prices" \
  --data-urlencode "api-version=2023-01-01-preview" \
  --data-urlencode "\$filter=armRegionName eq 'eastus2'" \
  --data-urlencode "\$top=200" | \
  jq -r '.Items[] | .serviceName' | \
  sort -u > "$OUTPUT_DIR/all_service_names.txt"

echo "   ✓ Saved to: $OUTPUT_DIR/all_service_names.txt"
echo ""
echo "   🔎 Searching for AI/ML related services:"
cat "$OUTPUT_DIR/all_service_names.txt" | grep -iE "ai|cognitive|openai|machine|learning|intelligence|vision|speech|language|translator|bot"

echo ""
echo "✅ Research complete!"
echo "📁 Data saved to: $OUTPUT_DIR/"
echo ""
echo "📊 Summary files created:"
ls -lh "$OUTPUT_DIR"/ | tail -n +2
