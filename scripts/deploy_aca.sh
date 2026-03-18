#!/bin/bash
#
# Azure Container App Deployment Script (Configurable)
# =====================================================
#
# Generic deployment script that reads ALL configuration from your .env file.
# No hardcoded resource names — clone the repo, fill in .env, and deploy.
#
# Prerequisites:
# 1. Azure CLI installed and authenticated (az login)
# 2. .env file in project root with required variables (see .env.example)
# 3. An Azure Container Registry (ACR) already created
# 4. An Azure Container Apps environment and app already created
# 5. ACR admin credentials configured on the Container App
#
# Required .env variables:
#   ACR_NAME          - Azure Container Registry name (e.g. myacr123)
#   ACA_APP_NAME      - Container App name (e.g. azure-diagram-builder)
#   RESOURCE_GROUP    - Resource group containing the ACA app
#   IMAGE_NAME        - Docker image name (e.g. azure-diagram-builder)
#
#   VITE_AZURE_OPENAI_ENDPOINT       - Azure OpenAI endpoint URL
#   VITE_AZURE_OPENAI_API_KEY        - Azure OpenAI API key
#   VITE_AZURE_OPENAI_DEPLOYMENT_*   - Model deployment names (at least one)
#
# Usage:
#   chmod +x scripts/deploy_aca.sh
#   ./scripts/deploy_aca.sh
#

set -euo pipefail

# ─── Load .env ───────────────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ .env file not found at $ENV_FILE"
    echo "   Copy .env.example to .env and fill in your values."
    exit 1
fi

export $(cat "$ENV_FILE" | grep -v '^#' | grep -v '^\s*$' | xargs)

# ─── Validate required variables ────────────────────────────────────
MISSING=()
for var in ACR_NAME ACA_APP_NAME RESOURCE_GROUP IMAGE_NAME \
           VITE_AZURE_OPENAI_ENDPOINT VITE_AZURE_OPENAI_API_KEY; do
    if [[ -z "${!var:-}" ]]; then
        MISSING+=("$var")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    echo "❌ Missing required .env variables:"
    for v in "${MISSING[@]}"; do
        echo "   - $v"
    done
    exit 1
fi

# Check that at least one model deployment is configured
MODEL_COUNT=0
for var in VITE_AZURE_OPENAI_DEPLOYMENT_GPT51 VITE_AZURE_OPENAI_DEPLOYMENT_GPT52 \
           VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX \
           VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI \
           VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST; do
    if [[ -n "${!var:-}" ]]; then
        ((MODEL_COUNT++))
    fi
done

if [[ $MODEL_COUNT -eq 0 ]]; then
    echo "❌ No model deployments configured. Set at least one VITE_AZURE_OPENAI_DEPLOYMENT_* in .env"
    exit 1
fi

# ─── Build arguments ────────────────────────────────────────────────
# Collect all VITE_ variables as --build-arg flags
BUILD_ARGS=""
while IFS='=' read -r key value; do
    if [[ "$key" == VITE_* && -n "$value" ]]; then
        BUILD_ARGS="$BUILD_ARGS --build-arg $key=\"$value\""
    fi
done < <(cat "$ENV_FILE" | grep -v '^#' | grep -v '^\s*$')

ACR_IMAGE="$ACR_NAME.azurecr.io/$IMAGE_NAME:latest"

echo "🔨 Building image in ACR: $ACR_NAME"
echo "   Image: $IMAGE_NAME:latest"
echo "   Models configured: $MODEL_COUNT"
echo ""

# ─── Build in ACR ────────────────────────────────────────────────────
eval az acr build \
    --registry "$ACR_NAME" \
    --image "$IMAGE_NAME:latest" \
    $BUILD_ARGS \
    "$(dirname "$0")/.."

# ─── Get ACA FQDN ───────────────────────────────────────────────────
FQDN=$(az containerapp show \
    -g "$RESOURCE_GROUP" \
    -n "$ACA_APP_NAME" \
    --query 'properties.configuration.ingress.fqdn' -o tsv 2>/dev/null || echo "")

# ─── Update Container App ───────────────────────────────────────────
echo ""
echo "🚀 Updating Container App: $ACA_APP_NAME"

SET_ENV_VARS="PUBLIC_URL=https://$FQDN"

az containerapp update \
    --name "$ACA_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$ACR_IMAGE" \
    --set-env-vars $SET_ENV_VARS \
    --revision-suffix "v$(date +%s)"

echo ""
echo "✅ Deployment complete!"
if [[ -n "$FQDN" ]]; then
    echo "   URL: https://$FQDN"
fi
