#!/bin/bash

# Variables - customize these
RESOURCE_GROUP="azure-diagrams-rg"
LOCATION="eastus2"
ACR_NAME="acrazurediagrams$(date +%s)"  # Unique ACR name
ACA_ENV_NAME="aca-env-azure-diagrams"
ACA_APP_NAME="azure-diagram-builder"
IMAGE_NAME="azure-diagram-builder"

echo "🚀 Starting deployment to Azure Container Apps..."
echo ""

# 1. Create Resource Group
echo "📦 Creating resource group: $RESOURCE_GROUP"
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --output table

# 2. Create Azure Container Registry
echo ""
echo "🐳 Creating Azure Container Registry: $ACR_NAME"
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true \
  --output table

# 3. Load environment variables from .env file
echo ""
echo "📝 Loading Azure OpenAI credentials from .env file..."
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
  echo "✓ Environment variables loaded"
else
  echo "⚠️  Warning: .env file not found. AI features may not work."
fi

# 3. Build image using ACR Build with build args
echo ""
echo "🔨 Building container image using ACR Build..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:latest \
  --file Dockerfile \
  --build-arg VITE_AZURE_OPENAI_ENDPOINT="$VITE_AZURE_OPENAI_ENDPOINT" \
  --build-arg VITE_AZURE_OPENAI_API_KEY="$VITE_AZURE_OPENAI_API_KEY" \
  --build-arg VITE_AZURE_OPENAI_DEPLOYMENT="$VITE_AZURE_OPENAI_DEPLOYMENT" \
  . \
  --output table

# 4. Create Azure Container Apps Environment
echo ""
echo "🌐 Creating Azure Container Apps Environment: $ACA_ENV_NAME"
az containerapp env create \
  --name $ACA_ENV_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --output table

# 5. Get ACR credentials
echo ""
echo "🔑 Getting ACR credentials..."
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query "loginServer" -o tsv)

# 6. Create Azure Container App
echo ""
echo "🚢 Deploying to Azure Container App: $ACA_APP_NAME"
az containerapp create \
  --name $ACA_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ACA_ENV_NAME \
  --image "$ACR_LOGIN_SERVEGE_NAME:latest" \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 80 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --output table

# 7. Get the app URL
echo ""
echo "✅ Deployment complete!"
echo ""
APP_URL=$(az containerapp show \
  --name $ACA_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo "🌍 Your app is available at: https://$APP_URL"
echo ""
echo "📊 Resource Summary:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  ACR: $ACR_NAME"
echo "  ACA Environment: $ACA_ENV_NAME"
echo "  ACA App: $ACA_APP_NAME"
echo ""
echo "💡 To update the app, run:"
echo "   az acr build --registry $ACR_NAME --image $IMAGE_NAME:latest \\"
echo "     --build-arg VITE_AZURE_OPENAI_ENDPOINT=\"\$VITE_AZURE_OPENAI_ENDPOINT\" \\"
echo "     --build-arg VITE_AZURE_OPENAI_API_KEY=\"\$VITE_AZURE_OPENAI_API_KEY\" \\"
echo "     --build-arg VITE_AZURE_OPENAI_DEPLOYMENT=\"\$VITE_AZURE_OPENAI_DEPLOYMENT\" ."
echo "   az containerapp update --name $ACA_APP_NAME --resource-group $RESOURCE_GROUP --image $ACR_LOGIN_SERVER/$IMAGE_NAME:latest"
echo ""
echo "⚠️  Note: Azure OpenAI credentials are embedded in the container image at build time."
