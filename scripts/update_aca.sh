#!/bin/bash
#
# Azure Container App Deployment Script
# ======================================
#
# This script builds and deploys the Azure Diagram Builder application to Azure Container Apps (ACA).
#
# What it does:
# 1. Loads environment variables from .env file
# 2. Builds Docker image in Azure Container Registry with build-time Vite environment variables
# 3. Updates the Azure Container App with the new image and runtime environment variables
#
# Prerequisites:
# - Azure CLI installed and authenticated (az login)
# - .env file in project root with required variables
# - Proper permissions for ACR and ACA resources
#
# Required .env variables:
# - VITE_AZURE_OPENAI_ENDPOINT: Azure OpenAI endpoint URL (build-time)
# - VITE_AZURE_OPENAI_API_KEY: Azure OpenAI API key (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT51: GPT-5.1 deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT52: GPT-5.2 deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX: GPT-5.2 Codex deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX: GPT-5.3 Codex deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT54: GPT-5.4 deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI: GPT-5.4 Mini deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK: DeepSeek V3.2 Speciale deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST: Grok 4.1 Fast deployment name (build-time)
# - VITE_APPINSIGHTS_CONNECTION_STRING: Application Insights connection string (build-time, optional)
# - VITE_SPEECH_REGION: Azure Speech region (build-time, enables avatar Present button)
# - AZURE_COSMOS_ENDPOINT: Cosmos DB endpoint (runtime)
# - COSMOS_DATABASE_ID: Cosmos DB database ID (runtime)
# - COSMOS_CONTAINER_ID: Cosmos DB container ID (runtime)
# - AZURE_SPEECH_REGION: Azure Speech region (runtime, used by token-server.js)
# - AZURE_SPEECH_RESOURCE_ID: Azure Speech resource ID (runtime, used by token-server.js)
#
# Note: Vite environment variables must be passed as build arguments because they are
# embedded at build time via import.meta.env, not available at runtime.
#
# IMPORTANT — App Insights connection string workaround:
#   The VITE_APPINSIGHTS_CONNECTION_STRING value contains semicolons (;) which break
#   `az acr build --build-arg`. ACR Tasks forwards build args to a remote Docker agent
#   via shell commands, and semicolons are interpreted as shell command separators —
#   causing "docker build requires exactly 1 argument" errors.
#
#   Workaround: This script extracts the connection string from .env into a separate
#   file (.env.appinsights), which is NOT excluded by .dockerignore. The Dockerfile
#   then COPYs this file and sources it in the same RUN layer as `npm run build`.
#   The file is gitignored since it's auto-generated at deploy time.
#
# Usage:
#   ./scripts/update_aca.sh
#

set -euo pipefail

# Load environment variables (handles semicolons and special chars in values)
set -a && source .env && set +a

# Extract App Insights connection string to a separate file for Docker build
# (az acr build --build-arg can't handle semicolons in values)
grep '^VITE_APPINSIGHTS_CONNECTION_STRING' .env | sed 's/^//' | tr -d '"' > .env.appinsights 2>/dev/null || true
echo "📎 App Insights env file: $(cat .env.appinsights 2>/dev/null || echo 'not set')"

echo "🚀 Building image in ACR..."
az acr build --registry acrazurediagrams1767583743 \
    --image azure-diagram-builder:latest \
    --build-arg "VITE_AZURE_OPENAI_ENDPOINT=$VITE_AZURE_OPENAI_ENDPOINT" \
    --build-arg "VITE_AZURE_OPENAI_API_KEY=$VITE_AZURE_OPENAI_API_KEY" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT51=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT51" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT54=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT54" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK=$VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK" \
    --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST=$VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST" \
    --build-arg "VITE_SPEECH_REGION=$VITE_SPEECH_REGION" \
    .

echo "🔄 Updating Container App..."
az containerapp update --name azure-diagram-builder \
    --resource-group azure-diagrams-rg \
    --image acrazurediagrams1767583743.azurecr.io/azure-diagram-builder:latest \
    --set-env-vars \
        "AZURE_COSMOS_ENDPOINT=$AZURE_COSMOS_ENDPOINT" \
        "COSMOS_DATABASE_ID=$COSMOS_DATABASE_ID" \
        "COSMOS_CONTAINER_ID=$COSMOS_CONTAINER_ID" \
        "PUBLIC_URL=https://azure-diagram-builder.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io" \
        "AZURE_SPEECH_REGION=$AZURE_SPEECH_REGION" \
        "AZURE_SPEECH_RESOURCE_ID=$AZURE_SPEECH_RESOURCE_ID" \
    --revision-suffix "v$(date +%s)"

echo "✅ Deployment complete!"