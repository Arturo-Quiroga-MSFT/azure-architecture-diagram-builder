#!/bin/bash

# Comprehensive Icon Renaming Script
# Maps ALL services with pricing data to properly named icon files

ICONS_BASE="/Users/arturoquiroga/GITHUB/AZURE-DIAGRAMS/Azure_Public_Service_Icons/Icons"

echo "🔄 Comprehensive icon file renaming for ALL services with pricing data..."
echo "Base directory: $ICONS_BASE"
echo ""

# Function to rename a file
rename_icon() {
    local category=$1
    local old_name=$2
    local new_name=$3
    
    local old_path="$ICONS_BASE/$category/$old_name"
    local new_path="$ICONS_BASE/$category/$new_name"
    
    if [ -f "$old_path" ]; then
        mv "$old_path" "$new_path"
        echo "✓ $category/$old_name → $new_name"
        return 0
    else
        echo "⚠ Not found: $category/$old_name"
        return 1
    fi
}

# Function to try multiple possible icon filenames
find_and_rename() {
    local category=$1
    local new_name=$2
    shift 2
    local possible_names=("$@")
    
    for old_name in "${possible_names[@]}"; do
        if rename_icon "$category" "$old_name" "$new_name"; then
            return 0
        fi
    done
    return 1
}

# =============================================================================
# AI & MACHINE LEARNING (from Foundry data)
# =============================================================================
echo "📁 AI & Machine Learning..."
find_and_rename "ai + machine learning" "azure-openai.svg" \
    "03438-icon-service-Azure-OpenAI.svg"

find_and_rename "ai + machine learning" "computer-vision.svg" \
    "00792-icon-service-Computer-Vision.svg"

find_and_rename "ai + machine learning" "azure-speech.svg" \
    "00797-icon-service-Speech-Services.svg" \
    "00797-icon-service-Speech.svg"

find_and_rename "ai + machine learning" "language.svg" \
    "02876-icon-service-Language.svg"

find_and_rename "ai + machine learning" "translator.svg" \
    "00800-icon-service-Translator-Text.svg" \
    "00800-icon-service-Translator.svg"

find_and_rename "ai + machine learning" "document-intelligence.svg" \
    "02749-icon-service-Azure-Applied-AI-Services.svg" \
    "02749-icon-service-Form-Recognizer.svg"

find_and_rename "ai + machine learning" "custom-vision.svg" \
    "00793-icon-service-Custom-Vision.svg"

find_and_rename "ai + machine learning" "azure-machine-learning.svg" \
    "10166-icon-service-Machine-Learning.svg"

find_and_rename "ai + machine learning" "cognitive-services.svg" \
    "10162-icon-service-Cognitive-Services.svg"

# =============================================================================
# INTEGRATION
# =============================================================================
echo ""
echo "📁 Integration..."
find_and_rename "integration" "api-management.svg" \
    "10042-icon-service-API-Management-Services.svg"

find_and_rename "integration" "service-bus.svg" \
    "10207-icon-service-Service-Bus.svg"

find_and_rename "integration" "logic-apps.svg" \
    "10040-icon-service-Logic-Apps.svg"

# =============================================================================
# APP SERVICES
# =============================================================================
echo ""
echo "📁 App Services..."
find_and_rename "app services" "app-service.svg" \
    "10035-icon-service-App-Services.svg" \
    "10031-icon-service-App-Service.svg"

# =============================================================================
# COMPUTE
# =============================================================================
echo ""
echo "📁 Compute..."
find_and_rename "compute" "azure-functions.svg" \
    "10029-icon-service-Function-Apps.svg"

find_and_rename "compute" "virtual-machines.svg" \
    "10021-icon-service-Virtual-Machine.svg" \
    "10021-icon-service-Virtual-Machines.svg"

find_and_rename "compute" "virtual-machine-scale-sets.svg" \
    "10024-icon-service-VM-Scale-Sets.svg"

# =============================================================================
# CONTAINERS
# =============================================================================
echo ""
echo "📁 Containers..."
find_and_rename "containers" "azure-kubernetes-service.svg" \
    "10023-icon-service-Kubernetes-Services.svg"

find_and_rename "containers" "container-instances.svg" \
    "10104-icon-service-Container-Instances.svg"

find_and_rename "containers" "container-registry.svg" \
    "10105-icon-service-Container-Registries.svg"

# =============================================================================
# DATABASES
# =============================================================================
echo ""
echo "📁 Databases..."
find_and_rename "databases" "azure-cosmos-db.svg" \
    "10121-icon-service-Azure-Cosmos-DB.svg"

find_and_rename "databases" "sql-database.svg" \
    "02390-icon-service-Azure-SQL.svg" \
    "10132-icon-service-SQL-Database.svg"

find_and_rename "databases" "azure-cache-redis.svg" \
    "10059-icon-service-Cache-Redis.svg" \
    "10122-icon-service-Azure-Cache-Redis.svg"

find_and_rename "databases" "azure-database-postgresql.svg" \
    "10130-icon-service-Azure-Database-PostgreSQL-Server.svg"

find_and_rename "databases" "azure-database-mysql.svg" \
    "10122-icon-service-Azure-Database-MySQL-Server.svg"

# =============================================================================
# STORAGE
# =============================================================================
echo ""
echo "📁 Storage..."
find_and_rename "storage" "storage-account.svg" \
    "10086-icon-service-Storage-Accounts.svg"

find_and_rename "storage" "data-lake-storage.svg" \
    "10089-icon-service-Data-Lake-Storage-Gen1.svg" \
    "03429-icon-service-Azure-Data-Lake-Storage.svg"

# =============================================================================
# ANALYTICS
# =============================================================================
echo ""
echo "📁 Analytics..."
find_and_rename "analytics" "event-hubs.svg" \
    "10209-icon-service-Event-Hubs.svg"

find_and_rename "analytics" "data-factory.svg" \
    "10260-icon-service-Data-Factory.svg"

find_and_rename "analytics" "azure-synapse-analytics.svg" \
    "10157-icon-service-Azure-Synapse-Analytics.svg"

find_and_rename "analytics" "stream-analytics.svg" \
    "10163-icon-service-Stream-Analytics.svg"

# =============================================================================
# MONITORING
# =============================================================================
echo ""
echo "📁 Monitor..."
find_and_rename "monitor" "application-insights.svg" \
    "00012-icon-service-Application-Insights.svg"

find_and_rename "monitor" "azure-monitor.svg" \
    "00008-icon-service-Azure-Monitor.svg"

find_and_rename "monitor" "log-analytics.svg" \
    "10233-icon-service-Log-Analytics-Workspaces.svg"

# =============================================================================
# IDENTITY & SECURITY
# =============================================================================
echo ""
echo "📁 Identity..."
find_and_rename "identity" "key-vault.svg" \
    "10245-icon-service-Key-Vaults.svg"

find_and_rename "identity" "azure-active-directory.svg" \
    "10221-icon-service-Azure-Active-Directory.svg"

find_and_rename "identity" "managed-identity.svg" \
    "10224-icon-service-Managed-Identities.svg"

# =============================================================================
# NETWORKING
# =============================================================================
echo ""
echo "📁 Networking..."
find_and_rename "networking" "azure-front-door.svg" \
    "10062-icon-service-Front-Doors.svg" \
    "10062-icon-service-Front-Door.svg"

find_and_rename "networking" "application-gateway.svg" \
    "10065-icon-service-Application-Gateways.svg" \
    "10065-icon-service-Application-Gateway.svg"

find_and_rename "networking" "load-balancer.svg" \
    "10067-icon-service-Load-Balancers.svg"

find_and_rename "networking" "virtual-network.svg" \
    "10078-icon-service-Virtual-Networks.svg"

find_and_rename "networking" "traffic-manager.svg" \
    "10073-icon-service-Traffic-Manager-Profiles.svg"

find_and_rename "networking" "cdn.svg" \
    "10061-icon-service-CDN-Profiles.svg"

# =============================================================================
# WEB
# =============================================================================
echo ""
echo "📁 Web..."
find_and_rename "web" "static-web-apps.svg" \
    "03513-icon-service-Static-Web-Apps.svg" \
    "10276-icon-service-Static-Web-Apps.svg"

# =============================================================================
# IoT
# =============================================================================
echo ""
echo "📁 IoT..."
find_and_rename "iot" "iot-hub.svg" \
    "10052-icon-service-IoT-Hub.svg"

find_and_rename "iot" "azure-digital-twins.svg" \
    "03312-icon-service-Azure-Digital-Twins.svg"

# =============================================================================
# SECURITY
# =============================================================================
echo ""
echo "📁 Security..."
find_and_rename "security" "azure-sentinel.svg" \
    "10243-icon-service-Azure-Sentinel.svg"

find_and_rename "security" "security-center.svg" \
    "10242-icon-service-Security-Center.svg"

echo ""
echo "✅ Comprehensive icon renaming complete!"
echo ""
echo "Summary: All services with pricing data now have properly named icon files"
echo ""
echo "Next steps:"
echo "1. Verify renamed icons: ls Azure_Public_Service_Icons/Icons/*/*.svg | grep -v '^[0-9]'"
echo "2. Test diagram generation with all services"
