#!/bin/bash

# Test Azure Retail Prices API
# Simple script to verify API connectivity and understand response structure

echo "🔍 Testing Azure Retail Prices API..."
echo ""

# Test 1: Get first 5 items without filters
echo "Test 1: Basic API call (first 5 items)"
curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$top=5" | jq '.'

echo ""
echo "---"
echo ""

# Test 2: Get pricing for a specific service
echo "Test 2: Virtual Machines in East US"
curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$filter=serviceName eq 'Virtual Machines' and armRegionName eq 'eastus'&\$top=5" | jq '.'

echo ""
echo "---"
echo ""

# Test 3: Count total items
echo "Test 3: Checking total count"
RESPONSE=$(curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$top=1")
COUNT=$(echo "$RESPONSE" | jq -r '.Count // "N/A"')
echo "Total pricing items available: $COUNT"

echo ""
echo "✅ API test complete!"
