#!/bin/bash

# Compare pricing across three regions for key services
# Generates a comparison report showing price differences

REGIONS=("eastus2" "swedencentral" "westeurope")
SERVICES=("Azure App Service" "Virtual Machines" "Storage" "SQL Database" "Azure Cosmos DB")

OUTPUT_FILE="pricing_comparison_$(date +%Y%m%d_%H%M%S).txt"

echo "💰 Azure Regional Pricing Comparison" > "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "Regions: ${REGIONS[*]}" >> "$OUTPUT_FILE"
echo "==========================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for service in "${SERVICES[@]}"; do
  echo "" >> "$OUTPUT_FILE"
  echo "📦 Service: $service" >> "$OUTPUT_FILE"
  echo "---" >> "$OUTPUT_FILE"
  
  for region in "${REGIONS[@]}"; do
    echo "  Region: $region" >> "$OUTPUT_FILE"
    
    # Fetch first item for this service/region
    filter="serviceName eq '$service' and armRegionName eq '$region' and priceType eq 'Consumption'"
    response=$(curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$filter=$filter&\$top=3")
    
    # Extract pricing info
    items=$(echo "$response" | jq -c '.Items[]' 2>/dev/null)
    
    if [ -n "$items" ]; then
      echo "$items" | while IFS= read -r item; do
        sku=$(echo "$item" | jq -r '.skuName')
        price=$(echo "$item" | jq -r '.retailPrice')
        unit=$(echo "$item" | jq -r '.unitOfMeasure')
        
        echo "    - $sku: \$$price per $unit" >> "$OUTPUT_FILE"
      done
    else
      echo "    - No pricing data available" >> "$OUTPUT_FILE"
    fi
    
    sleep 0.3
  done
done

echo "" >> "$OUTPUT_FILE"
echo "✅ Comparison complete!" >> "$OUTPUT_FILE"

# Display the report
cat "$OUTPUT_FILE"

echo ""
echo "📁 Report saved to: $OUTPUT_FILE"
