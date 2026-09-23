#!/bin/bash

# Fetch ALL available services with pagination
# This script discovers all unique services and downloads complete pricing

OUTPUT_FILE="all_services_pricing_$(date +%Y%m%d_%H%M%S).json"
TEMP_DIR="temp_pricing_$$"
mkdir -p "$TEMP_DIR"

REGION="${1:-eastus2}"  # Default to eastus2, or use first argument

echo "🔄 Fetching all Azure pricing for region: $REGION"
echo "⚠️  This may take several minutes and download ~100MB+ of data"
echo ""

# Initialize variables
SKIP=0
PAGE_SIZE=100
TOTAL_ITEMS=0
PAGE_NUM=1

# Start building the combined JSON
echo '{"BillingCurrency":"USD","Items":[' > "$OUTPUT_FILE"

while true; do
  echo "📄 Fetching page $PAGE_NUM (skip: $SKIP)..."
  
  # Fetch one page
  RESPONSE=$(curl -s "https://prices.azure.com/api/retail/prices?api-version=2023-01-01-preview&\$filter=armRegionName eq '$REGION' and priceType eq 'Consumption'&\$skip=$SKIP&\$top=$PAGE_SIZE")
  
  # Check if we got data
  ITEMS=$(echo "$RESPONSE" | jq '.Items')
  ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
  
  if [ "$ITEM_COUNT" -eq "0" ]; then
    echo "✅ No more items. Pagination complete."
    break
  fi
  
  # Save page temporarily
  echo "$ITEMS" | jq -c '.[]' >> "$TEMP_DIR/items.jsonl"
  
  TOTAL_ITEMS=$((TOTAL_ITEMS + ITEM_COUNT))
  echo "   Downloaded: $ITEM_COUNT items (total: $TOTAL_ITEMS)"
  
  # Check if there's a NextPageLink
  NEXT_LINK=$(echo "$RESPONSE" | jq -r '.NextPageLink // empty')
  
  if [ -z "$NEXT_LINK" ]; then
    echo "✅ No more pages."
    break
  fi
  
  # Increment skip
  SKIP=$((SKIP + PAGE_SIZE))
  PAGE_NUM=$((PAGE_NUM + 1))
  
  # Small delay to be nice to the API
  sleep 0.3
  
  # Safety limit (remove this if you want to download everything)
  if [ $PAGE_NUM -gt 50 ]; then
    echo "⚠️  Reached page limit (50 pages = ~5000 items). Remove this limit if needed."
    break
  fi
done

# Combine all items into one JSON
echo "🔨 Combining items into single JSON file..."

# Convert JSONL to JSON array
cat "$TEMP_DIR/items.jsonl" | jq -s '.' | jq -c '.[]' | \
  awk '{if(NR>1)print "," $0; else print $0}' >> "$OUTPUT_FILE"

# Close the JSON
echo ']}' >> "$OUTPUT_FILE"

# Cleanup temp directory
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Download complete!"
echo "📊 Total items: $TOTAL_ITEMS"
echo "📁 Saved to: $OUTPUT_FILE"
echo "💾 File size: $(du -h "$OUTPUT_FILE" | cut -f1)"

# Extract unique services
echo ""
echo "🔍 Analyzing services..."
SERVICES=$(jq -r '.Items[].serviceName' "$OUTPUT_FILE" | sort -u)
SERVICE_COUNT=$(echo "$SERVICES" | wc -l | tr -d ' ')

echo "📦 Found $SERVICE_COUNT unique services:"
echo "$SERVICES" | head -20
if [ "$SERVICE_COUNT" -gt 20 ]; then
  echo "   ... and $((SERVICE_COUNT - 20)) more"
fi
