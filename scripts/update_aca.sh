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
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT52: GPT-5.2 deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT41: GPT-4.1 deployment name (build-time)
# - VITE_AZURE_OPENAI_DEPLOYMENT_GPT41MINI: GPT-4.1-mini deployment name (build-time)
# - AZURE_COSMOS_ENDPOINT: Cosmos DB endpoint (runtime)
# - COSMOS_DATABASE_ID: Cosmos DB database ID (runtime)
# - COSMOS_CONTAINER_ID: Cosmos DB container ID (runtime)
#
# Note: Vite environment variables must be passed as build arguments because they are
# embedded at build time via import.meta.env, not available at runtime.
#
# Usage:
#   ./scripts/update_aca.sh
#

export $(cat .env | grep -v '^#' | xargs) && az acr build --registry acrazurediagrams1767583743 \
    --image azure-diagram-builder:latest \
    --build-arg VITE_AZURE_OPENAI_ENDPOINT="$VITE_AZURE_OPENAI_ENDPOINT" \
    --build-arg VITE_AZURE_OPENAI_API_KEY="$VITE_AZURE_OPENAI_API_KEY" \
    --build-arg VITE_AZURE_OPENAI_DEPLOYMENT_GPT52="$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52" \
    --build-arg VITE_AZURE_OPENAI_DEPLOYMENT_GPT41="$VITE_AZURE_OPENAI_DEPLOYMENT_GPT41" \
    --build-arg VITE_AZURE_OPENAI_DEPLOYMENT_GPT41MINI="$VITE_AZURE_OPENAI_DEPLOYMENT_GPT41MINI" \
    --build-arg VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX="$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX" \
    --build-arg VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX="$VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX" . \
&& az containerapp update --name azure-diagram-builder \
    --resource-group azure-diagrams-rg \
    --image acrazurediagrams1767583743.azurecr.io/azure-diagram-builder:latest \
    --set-env-vars \
        AZURE_COSMOS_ENDPOINT="$AZURE_COSMOS_ENDPOINT" \
        COSMOS_DATABASE_ID="$COSMOS_DATABASE_ID" \
        COSMOS_CONTAINER_ID="$COSMOS_CONTAINER_ID" \
        PUBLIC_URL="https://azure-diagram-builder.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io" \
    --revision-suffix v$(date +%s)