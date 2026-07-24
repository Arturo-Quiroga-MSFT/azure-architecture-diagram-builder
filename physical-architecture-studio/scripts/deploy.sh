#!/usr/bin/env bash
# Build, push, and deploy the Physical Architecture Studio to Azure Container
# Apps. GATED: requires PAS_DEPLOY_CONFIRM=yes to run, per the approval gate in
# .azure/deployment-plan.md. Reuses the existing ACR and Container Apps env.
#
# Usage:
#   PAS_DEPLOY_CONFIRM=yes \
#   RESOURCE_GROUP=azure-diagrams-rg \
#   ACR_NAME=acrazurediagrams1767583743 \
#   ACA_ENV_ID=<managed-environment-resource-id> \
#   ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${PAS_DEPLOY_CONFIRM:-}" != "yes" ]]; then
  echo "Deployment is gated. Set PAS_DEPLOY_CONFIRM=yes to proceed." >&2
  echo "This deploys a new Container App; review .azure/deployment-plan.md first." >&2
  exit 1
fi

: "${RESOURCE_GROUP:?set RESOURCE_GROUP}"
: "${ACR_NAME:?set ACR_NAME}"
: "${ACA_ENV_ID:?set ACA_ENV_ID}"
APP_NAME="${APP_NAME:-physical-architecture-studio}"
TAG="${TAG:-$(date +%Y%m%d%H%M%S)}"

ACR_LOGIN_SERVER="$(az acr show -n "$ACR_NAME" --query loginServer -o tsv)"
IMAGE="${ACR_LOGIN_SERVER}/${APP_NAME}:${TAG}"

echo "==> Local validation before deploy"
./scripts/validate-local.sh

echo "==> Building and pushing image via ACR build: ${IMAGE}"
az acr build --registry "$ACR_NAME" --image "${APP_NAME}:${TAG}" .

echo "==> Deploying Bicep"
az deployment group create \
  --resource-group "$RESOURCE_GROUP" \
  --template-file infra/main.bicep \
  --parameters \
      appName="$APP_NAME" \
      managedEnvironmentId="$ACA_ENV_ID" \
      acrLoginServer="$ACR_LOGIN_SERVER" \
      image="$IMAGE"

echo "==> Done. Configure Entra (assignment-required) auth on the Container App"
echo "    via 'az containerapp auth' before sharing the URL."
