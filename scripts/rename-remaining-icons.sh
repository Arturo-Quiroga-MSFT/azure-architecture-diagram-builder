#!/bin/bash

# Rename remaining icons for services with pricing data
# Focused on actual files that exist

ICONS_BASE="/Users/arturoquiroga/GITHUB/AZURE-DIAGRAMS/Azure_Public_Service_Icons/Icons"

echo "🔄 Renaming remaining service icons..."
echo ""

# Function to rename
rename_icon() {
    local category=$1
    local old_name=$2
    local new_name=$3
    
    local old_path="$ICONS_BASE/$category/$old_name"
    local new_path="$ICONS_BASE/$category/$new_name"
    
    if [ -f "$old_path" ]; then
        mv "$old_path" "$new_path"
        echo "✓ $new_name"
        return 0
    fi
    return 1
}

# Analytics
echo "📁 Analytics..."
rename_icon "analytics" "00039-icon-service-Event-Hubs.svg" "event-hubs.svg"
rename_icon "analytics" "00042-icon-service-Stream-Analytics-Jobs.svg" "stream-analytics.svg"
rename_icon "analytics" "10126-icon-service-Data-Factories.svg" "data-factory.svg"
rename_icon "analytics" "00606-icon-service-Azure-Synapse-Analytics.svg" "azure-synapse-analytics.svg"

# Databases  
echo ""
echo "📁 Databases..."
rename_icon "databases" "10059-icon-service-Azure-Cache-Redis.svg" "azure-cache-redis.svg"
rename_icon "databases" "10130-icon-service-Azure-Database-PostgreSQL-Server.svg" "azure-database-postgresql.svg"

# Networking
echo ""
echo "📁 Networking..."
rename_icon "networking" "10062-icon-service-Azure-Front-Door.svg" "azure-front-door.svg"
rename_icon "networking" "10065-icon-service-Application-Gateway.svg" "application-gateway.svg"
rename_icon "networking" "10061-icon-service-CDN-Profiles.svg" "cdn.svg"
rename_icon "networking" "10067-icon-service-Load-Balancer.svg" "load-balancer.svg"
rename_icon "networking" "10073-icon-service-Traffic-Manager.svg" "traffic-manager.svg"
rename_icon "networking" "10078-icon-service-Virtual-Network.svg" "virtual-network.svg"

# Identity/Security
echo ""
echo "📁 Identity..."
rename_icon "identity" "10245-icon-service-Key-Vault.svg" "key-vault.svg"
rename_icon "identity" "10221-icon-service-Azure-Active-Directory.svg" "azure-active-directory.svg"

# Integration
echo ""
echo "📁 Integration..."
rename_icon "integration" "10207-icon-service-Service-Bus.svg" "service-bus.svg"
rename_icon "integration" "10040-icon-service-Logic-Apps.svg" "logic-apps.svg"

# Web
echo ""
echo "📁 Web..."
rename_icon "web" "10275-icon-service-Static-Apps.svg" "static-web-apps.svg"

# Storage
echo ""
echo "📁 Storage..."
rename_icon "storage" "10143-icon-service-Data-Lake-Analytics.svg" "data-lake-storage.svg"

echo ""
echo "✅ All service icons renamed!"
echo ""
echo "Verifying renamed files..."
find "$ICONS_BASE" -name "*.svg" ! -name "*[0-9]*icon-service*" -type f | wc -l | xargs echo "Total renamed icons:"
