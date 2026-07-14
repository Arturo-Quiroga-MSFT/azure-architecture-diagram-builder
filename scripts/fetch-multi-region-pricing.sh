#!/bin/bash

# Fetch Azure pricing for multiple regions
# Downloads pricing data for specified services across 5 regions
# Last updated: March 2026

# Target regions - 8 regions for the Azure Architecture Diagram Builder
# HERO: primary showcase regions (East US 2, Australia East)
# HUB:  regional coverage regions
REGIONS=("eastus2" "swedencentral" "westeurope" "canadacentral" "brazilsouth" "australiaeast" "southeastasia" "mexicocentral")

# =============================================================================
# COMPREHENSIVE SERVICE LIST - 62+ Services
# =============================================================================
SERVICES=(
  # Compute
  "Azure App Service"
  "Virtual Machines"
  "Azure Kubernetes Service"
  "Container Instances"
  "Container Registry"
  "Functions"
  "Logic Apps"
  
  # Databases
  "Azure Cosmos DB"
  "SQL Database"
  "Azure Database for PostgreSQL"
  "Azure Database for MySQL"
  "Azure Cache for Redis"
  "Redis Cache"
  
  # Storage
  "Storage"
  "Azure Data Lake Storage"
  
  # Networking
  "Application Gateway"
  "Azure Front Door Service"
  "Azure Service Bus"
  "Event Hubs"
  "Azure Event Hubs"
  "Service Bus"
  
  # Analytics
  "Azure Data Factory"
  "Azure Synapse Analytics"
  "Stream Analytics"
  "Azure Machine Learning"
  "Microsoft Fabric"
  
  # AI & Cognitive Services
  "Cognitive Services"
  "Azure OpenAI Service"
  "Azure AI Document Intelligence"
  "Azure AI Language"
  "Azure AI Speech"
  "Azure AI Vision"
  "Azure AI Translator"
  "Computer Vision"
  "Form Recognizer"
  "Speech Services"
  "Text Analytics"
  "Translator"
  "Foundry Models"
  "Foundry Tools"
  
  # Monitoring & Management
  "Application Insights"
  "Azure Monitor"
  "Log Analytics"
  "Key Vault"
  "Azure Key Vault"
  "API Management"
  
  # CDN & Edge
  "Content Delivery Network"
  "Azure CDN"
  "CDN"
  "Static Web Apps"
  
  # IoT
  "Azure IoT Hub"
  "Azure IoT Central"
  
  # Security
  "Microsoft Defender for Cloud"
  "Azure Sentinel"
  
  # Integration
  "Azure SignalR Service"
  "Notification Hubs"
  "Event Grid"
  "Azure Event Grid"
  
  # Backup & Recovery
  "Backup"
  "Azure Backup"
  "Site Recovery"
  
  # Developer Tools
  "Azure DevOps"
  "Azure Automation"
  
  # Networking (Additional)
  "VPN Gateway"
  "Virtual Network"
  "Load Balancer"
  "Azure Load Balancer"
  "Traffic Manager"
  "Azure Traffic Manager"
  "ExpressRoute"
  "Network Watcher"
  "Azure Firewall"
)

# Global services (no region-specific pricing - copy to all regions)
GLOBAL_SERVICES=(
  "Azure Front Door Service"
  "Content Delivery Network"
  "CDN"
  "Static Web Apps"
  "Azure DevOps"
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
  # Retry on rate-limiting / non-JSON bodies so we never persist an error string
  # (e.g. "Too many requests...") into a pricing file, which would break the build.
  local attempt
  for attempt in 1 2 3 4 5; do
    curl -s -G "https://prices.azure.com/api/retail/prices" \
      --data-urlencode "api-version=2023-01-01-preview" \
      --data-urlencode "\$filter=$filter" \
      --data-urlencode "\$top=1000" \
      -o "$output_file"

    if [ -s "$output_file" ] && jq -e '.Items' "$output_file" >/dev/null 2>&1; then
      local item_count=$(jq '.Items | length' "$output_file" 2>/dev/null)
      echo "    ✓ Downloaded $item_count items"
      return 0
    fi
    echo "    ⚠ attempt $attempt: invalid/rate-limited response, retrying..."
    sleep 5
  done
  echo "    ✗ Failed to download valid JSON for $service in $region"
  return 1
}

# Function to fetch global service pricing (no region filter)
fetch_global_pricing() {
  local service="$1"
  local output_file="$2"
  
  echo "  Fetching: $service (global)..."
  
  # Build filter without region
  local filter="serviceName eq '$service' and priceType eq 'Consumption'"
  
  # Retry on rate-limiting / non-JSON bodies (same guard as fetch_pricing).
  local attempt
  for attempt in 1 2 3 4 5; do
    curl -s -G "https://prices.azure.com/api/retail/prices" \
      --data-urlencode "api-version=2023-01-01-preview" \
      --data-urlencode "\$filter=$filter" \
      --data-urlencode "\$top=1000" \
      -o "$output_file"

    if [ -s "$output_file" ] && jq -e '.Items' "$output_file" >/dev/null 2>&1; then
      local item_count=$(jq '.Items | length' "$output_file" 2>/dev/null)
      echo "    ✓ Downloaded $item_count items (global)"
      return 0
    fi
    echo "    ⚠ attempt $attempt: invalid/rate-limited response, retrying..."
    sleep 5
  done
  echo "    ✗ Failed to download valid JSON for $service (global)"
  return 1
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
  echo "=== Global Services (copying to all regions) ==="
  
  # Fetch once to temp file
  temp_dir=$(mktemp -d)
  
  for service in "${GLOBAL_SERVICES[@]}"; do
    # Create safe filename
    safe_name=$(echo "$service" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
    temp_file="$temp_dir/${safe_name}.json"
    
    fetch_global_pricing "$service" "$temp_file"
    
    # Copy to all regions
    for region in "${REGIONS[@]}"; do
      region_dir="$OUTPUT_DIR/$region"
      cp "$temp_file" "$region_dir/${safe_name}.json" 2>/dev/null
    done
    
    # Small delay to avoid rate limiting
    sleep 0.5
  done
  
  # Cleanup temp dir
  rm -rf "$temp_dir"
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

# Stamp the "Prices as of" date so cost exports reflect this refresh.
PRICING_TS_FILE="../src/data/azurePricing.ts"
TODAY=$(date +%Y-%m-%d)
if [ -f "$PRICING_TS_FILE" ]; then
  # Portable in-place edit (works on both BSD/macOS and GNU sed)
  tmp_ts=$(mktemp)
  sed "s/export const PRICING_DATA_AS_OF = '[0-9-]*';/export const PRICING_DATA_AS_OF = '$TODAY';/" "$PRICING_TS_FILE" > "$tmp_ts" && mv "$tmp_ts" "$PRICING_TS_FILE"
  echo "🗓️  Stamped PRICING_DATA_AS_OF = $TODAY in azurePricing.ts"
fi
