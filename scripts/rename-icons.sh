#!/bin/bash

# Icon File Renaming Script
# Renames icon files to match Azure service names for direct mapping

ICONS_BASE="/Users/arturoquiroga/GITHUB/AZURE-DIAGRAMS/Azure_Public_Service_Icons/Icons"

echo "🔄 Starting icon file renaming..."
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
    else
        echo "⚠ Warning: $old_path not found"
    fi
}

# AI & Machine Learning
echo "📁 AI & Machine Learning..."
rename_icon "ai + machine learning" "03438-icon-service-Azure-OpenAI.svg" "azure-openai.svg"
rename_icon "ai + machine learning" "00792-icon-service-Computer-Vision.svg" "computer-vision.svg"
rename_icon "ai + machine learning" "00797-icon-service-Speech-Services.svg" "azure-speech.svg"
rename_icon "ai + machine learning" "02876-icon-service-Language.svg" "language.svg"
rename_icon "ai + machine learning" "00800-icon-service-Translator-Text.svg" "translator.svg"
rename_icon "ai + machine learning" "02749-icon-service-Azure-Applied-AI-Services.svg" "document-intelligence.svg"
rename_icon "ai + machine learning" "00793-icon-service-Custom-Vision.svg" "custom-vision.svg"
rename_icon "ai + machine learning" "10166-icon-service-Machine-Learning.svg" "azure-machine-learning.svg"
rename_icon "ai + machine learning" "10162-icon-service-Cognitive-Services.svg" "cognitive-services.svg"

# Integration
echo ""
echo "📁 Integration..."
rename_icon "integration" "10042-icon-service-API-Management-Services.svg" "api-management.svg"
rename_icon "integration" "10207-icon-service-Service-Bus.svg" "service-bus.svg"
rename_icon "integration" "10218-icon-service-Logic-Apps.svg" "logic-apps.svg"

# App Services
echo ""
echo "📁 App Services..."
rename_icon "app services" "10035-icon-service-App-Services.svg" "app-service.svg"

# Compute
echo ""
echo "📁 Compute..."
rename_icon "compute" "10029-icon-service-Function-Apps.svg" "azure-functions.svg"
rename_icon "compute" "10021-icon-service-Virtual-Machine.svg" "virtual-machines.svg"
rename_icon "compute" "10024-icon-service-VM-Scale-Sets.svg" "virtual-machine-scale-sets.svg"

# Containers
echo ""
echo "📁 Containers..."
rename_icon "containers" "10023-icon-service-Kubernetes-Services.svg" "azure-kubernetes-service.svg"
rename_icon "containers" "10104-icon-service-Container-Instances.svg" "container-instances.svg"
rename_icon "containers" "10105-icon-service-Container-Registries.svg" "container-registry.svg"

# Databases
echo ""
echo "📁 Databases..."
rename_icon "databases" "10121-icon-service-Azure-Cosmos-DB.svg" "azure-cosmos-db.svg"
rename_icon "databases" "10132-icon-service-SQL-Database.svg" "sql-database.svg"
rename_icon "databases" "10122-icon-service-Azure-Cache-Redis.svg" "azure-cache-redis.svg"
rename_icon "databases" "10130-icon-service-Azure-Database-PostgreSQL-Server.svg" "azure-database-postgresql.svg"
rename_icon "databases" "10124-icon-service-Azure-Database-MySQL-Server.svg" "azure-database-mysql.svg"

# Storage
echo ""
echo "📁 Storage..."
rename_icon "storage" "10086-icon-service-Storage-Accounts.svg" "storage-account.svg"

# Analytics
echo ""
echo "📁 Analytics..."
rename_icon "analytics" "10209-icon-service-Event-Hubs.svg" "event-hubs.svg"
rename_icon "analytics" "10260-icon-service-Data-Factory.svg" "data-factory.svg"
rename_icon "analytics" "10157-icon-service-Azure-Synapse-Analytics.svg" "azure-synapse-analytics.svg"
rename_icon "analytics" "10163-icon-service-Stream-Analytics.svg" "stream-analytics.svg"

# Monitoring
echo ""
echo "📁 Monitor..."
rename_icon "monitor" "00012-icon-service-Application-Insights.svg" "application-insights.svg"
rename_icon "monitor" "00008-icon-service-Azure-Monitor.svg" "azure-monitor.svg"
rename_icon "monitor" "10233-icon-service-Log-Analytics-Workspaces.svg" "log-analytics.svg"

# Identity
echo ""
echo "📁 Identity..."
rename_icon "identity" "10245-icon-service-Key-Vaults.svg" "key-vault.svg"
rename_icon "identity" "10221-icon-service-Azure-Active-Directory.svg" "azure-active-directory.svg"
rename_icon "identity" "10224-icon-service-Managed-Identities.svg" "managed-identity.svg"

# Networking
echo ""
echo "📁 Networking..."
rename_icon "networking" "10062-icon-service-Front-Doors.svg" "azure-front-door.svg"
rename_icon "networking" "10065-icon-service-Application-Gateways.svg" "application-gateway.svg"
rename_icon "networking" "10067-icon-service-Load-Balancers.svg" "load-balancer.svg"
rename_icon "networking" "10078-icon-service-Virtual-Networks.svg" "virtual-network.svg"
rename_icon "networking" "10073-icon-service-Traffic-Manager-Profiles.svg" "traffic-manager.svg"
rename_icon "networking" "10061-icon-service-CDN-Profiles.svg" "cdn.svg"

# Web
echo ""
echo "📁 Web..."
rename_icon "web" "10132-icon-service-Static-Web-Apps.svg" "static-web-apps.svg"

# IoT
echo ""
echo "📁 IoT..."
rename_icon "iot" "10052-icon-service-IoT-Hub.svg" "iot-hub.svg"
rename_icon "iot" "03312-icon-service-Azure-Digital-Twins.svg" "azure-digital-twins.svg"

# Security
echo ""
echo "📁 Security..."
rename_icon "security" "10243-icon-service-Azure-Sentinel.svg" "azure-sentinel.svg"
rename_icon "security" "10242-icon-service-Security-Center.svg" "security-center.svg"

echo ""
echo "✅ Icon renaming complete!"
echo ""
echo "Next steps:"
echo "1. Update icon loader (src/utils/iconLoader.ts)"
echo "2. Remove normalization code (src/App.tsx)"
echo "3. Test diagram generation"
