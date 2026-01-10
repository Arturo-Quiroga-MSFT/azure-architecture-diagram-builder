#!/bin/bash

# Fetch Azure pricing for multiple regions
# Downloads pricing data for specified services across 3 regions

# Target regions
REGIONS=("eastus2" "swedencentral" "westeurope")

# Services to fetch (you can expand this list)
SERVICES=(
  "Azure App Service"
  "Virtual Machines"
  "Azure Cosmos DB"
  "Storage"
  "SQL Database"
  "Azure Kubernetes Service"
  "Container Instances"
  "Application Gateway"
  "Azure Machine Learning"
  "Azure Database for PostgreSQL"
  "Key Vault"
  "Application Insights"
  "Azure Monitor"
  "API Management"
  "Functions"
  "Logic Apps"
  "Service Bus"
  "Redis Cache"
  "Azure Data Factory"
  "Event Hubs"
  "Container Registry"
  "Foundry Models"
  "Foundry Tools"
)

# Global services (no region-specific pricing)
GLOBAL_SERVICES=(
  "Azure Front Door Service"
  "Content Delivery Network"
  "CDN"
  "Static Web Apps"
)

# Output directory - use project structure
OUTPUT_DIR="../src/data/pricing/regions"

echo "🌍 Fetching Azure pricing for ${#REGIONS[@]} regions..."
echo "📦 Services: ${#SERVICES[@]}"
echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# Function to fetch pricing for a service in a region
fetch_pricing() {
  local service="$1"
  local region="$2"
  local output_file="$3"
  
  echo "  Fetching: $service in $region..."
  
  # Build filter and properly encode it
  local filter="serviceName eq '$service' and armRegionName eq '$region' and priceType eq 'Consumption'"
  
  # Fetch with pagination (limit to 1000 items per service/region to capture Foundry services)
  # Use --data-urlencode to properly encode the filter parameter
  curl -s -G "https://prices.azure.com/api/retail/prices" \
    --data-urlencode "api-version=2023-01-01-preview" \
    --data-urlencode "\$filter=$filter" \
    --data-urlencode "\$top=1000" \
    -o "$output_file"
  
  # Check if successful
  if [ -s "$output_file" ]; then
    local item_count=$(jq '.Items | length' "$output_file" 2>/dev/null)
    echo "    ✓ Downloaded $item_count items"
  else
    echo "    ✗ Failed to download"
  fi
}

# Function to fetch global service pricing (no region filter)
fetch_global_pricing() {
  local service="$1"
  local output_file="$2"
  
  echo "  Fetching: $service (global)..."
  
  # Build filter without region
  local filter="serviceName eq '$service' and priceType eq 'Consumption'"
  
  # Fetch with pagination
  curl -s -G "https://prices.azure.com/api/retail/prices" \
    --data-urlencode "api-version=2023-01-01-preview" \
    --data-urlencode "\$filter=$filter" \
    --data-urlencode "\$top=1000" \
    -o "$output_file"
  
  # Check if successful
  if [ -s "$output_file" ]; then
    local item_count=$(jq '.Items | length' "$output_file" 2>/dev/null)
    echo "    ✓ Downloaded $item_count items (global)"
  else
    echo "    ✗ Failed to download"
  fi
}

# Iterate through regions and services
for region in "${REGIONS[@]}"; do
  echo ""
  echo "=== Region: $region ==="
  
  region_dir="$OUTPUT_DIR/$region"
  mkdir -p "$region_dir"
  
  for service in "${SERVICES[@]}"; do
    # Create safe filename
    safe_name=$(echo "$service" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    output_file="$region_dir/${safe_name}.json"
    
    fetch_pricing "$service" "$region" "$output_file"
    
    # Small delay to avoid rate limiting
    sleep 0.5
  done
done

# Fetch global services (only once, not per-region)
if [ ${#GLOBAL_SERVICES[@]} -gt 0 ]; then
  echo ""
  echo "=== Global Services ==="
  
  # Save to first region folder for now (they're global anyway)
  global_dir="$OUTPUT_DIR/${REGIONS[0]}"
  
  for service in "${GLOBAL_SERVICES[@]}"; do
    # Create safe filename
    safe_name=$(echo "$service" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    output_file="$global_dir/${safe_name}.json"
    
    fetch_global_pricing "$service" "$output_file"
    
    # Small delay to avoid rate limiting
    sleep 0.5
  done
fi

echo ""
echo "✅ Download complete!"
echo ""
echo "📊 Summary by region:"
for region in "${REGIONS[@]}"; do
  region_dir="$OUTPUT_DIR/$region"
  total_items=0
  
  for file in "$region_dir"/*.json; do
    if [ -f "$file" ]; then
      count=$(jq '.Items | length' "$file" 2>/dev/null || echo 0)
      total_items=$((total_items + count))
    fi
  done
  
  echo "  $region: $total_items total pricing items"
done

echo ""
echo "📁 Data saved in: $OUTPUT_DIR"
