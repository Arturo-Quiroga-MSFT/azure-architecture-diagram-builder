#!/bin/bash

# Discover all available services from the API
# No region filter - shows all services globally

echo "🔍 Discovering all available Azure services from Pricing API..."
echo ""

OUTPUT_FILE="available_services_$(date +%Y%m%d_%H%M%S).txt"

# Fetch a large sample to get service names
echo "Fetching sample data (1000 items)..."
RESPONSE=$(curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$top=1000")

# Extract unique service names
SERVICES=$(echo "$RESPONSE" | jq -r '.Items[].serviceName' | sort -u)

# Save to file
echo "$SERVICES" > "$OUTPUT_FILE"

# Count
COUNT=$(echo "$SERVICES" | wc -l | tr -d ' ')

echo "✅ Found $COUNT unique services"
echo ""
echo "Services:"
echo "$SERVICES"
echo ""
echo "📁 Saved to: $OUTPUT_FILE"

# Also save as JSON array
JSON_OUTPUT="available_services_$(date +%Y%m%d_%H%M%S).json"
echo "$SERVICES" | jq -R . | jq -s . > "$JSON_OUTPUT"
echo "📁 JSON saved to: $JSON_OUTPUT"
