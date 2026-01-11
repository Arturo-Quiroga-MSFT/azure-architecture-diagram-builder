#!/bin/bash

# Analyze existing downloaded pricing data
# This will help understand what we already have

PRICING_DIR="../src/data/pricing/regions"

echo "🔍 Analyzing Existing Pricing Data"
echo "===================================="
echo ""

if [ ! -d "$PRICING_DIR" ]; then
  echo "❌ Pricing directory not found: $PRICING_DIR"
  exit 1
fi

echo "📊 Data by Region:"
echo "------------------"
for region_dir in "$PRICING_DIR"/*; do
  if [ -d "$region_dir" ]; then
    region=$(basename "$region_dir")
    file_count=$(ls -1 "$region_dir"/*.json 2>/dev/null | wc -l | tr -d ' ')
    total_items=0
    
    echo ""
    echo "Region: $region ($file_count files)"
    
    # Analyze each file
    for file in "$region_dir"/*.json; do
      if [ -f "$file" ]; then
        filename=$(basename "$file" .json)
        count=$(jq '.Count // 0' "$file" 2>/dev/null)
        total_items=$((total_items + count))
        
        if [ "$count" -gt 0 ]; then
          echo "  ✅ $filename: $count items"
          
          # Show sample price types and products
          price_types=$(jq -r '.Items[]? | .priceType' "$file" 2>/dev/null | sort -u | tr '\n' ', ' | sed 's/,$//')
          if [ -n "$price_types" ]; then
            echo "     Price types: $price_types"
          fi
          
          # Show price range
          min_price=$(jq '[.Items[]? | .retailPrice] | min' "$file" 2>/dev/null)
          max_price=$(jq '[.Items[]? | .retailPrice] | max' "$file" 2>/dev/null)
          if [ "$min_price" != "null" ] && [ "$max_price" != "null" ]; then
            echo "     Price range: \$$min_price - \$$max_price"
          fi
        else
          echo "  ⚠️  $filename: empty"
        fi
      fi
    done
    
    echo "  📈 Total items in region: $total_items"
  fi
done

echo ""
echo ""
echo "🎯 Services with Data (Successful Downloads):"
echo "----------------------------------------------"
find "$PRICING_DIR" -name "*.json" -exec sh -c '
  count=$(jq ".Count // 0" "$1" 2>/dev/null)
  if [ "$count" -gt 0 ]; then
    basename "$1" .json
  fi
' _ {} \; | sort -u

echo ""
echo ""
echo "⚠️  Services with No Data (Failed/Empty):"
echo "------------------------------------------"
find "$PRICING_DIR" -name "*.json" -exec sh -c '
  count=$(jq ".Count // 0" "$1" 2>/dev/null)
  if [ "$count" -eq 0 ]; then
    basename "$1" .json
  fi
' _ {} \; | sort -u

echo ""
echo "✅ Analysis complete!"
