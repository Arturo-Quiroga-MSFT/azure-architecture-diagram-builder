#!/usr/bin/env bash
#
# 03-deploy-webapp.sh — Blue/green: build + deploy the web app into the new
# VNet-integrated ACA environment so it reaches Cosmos over the private endpoint.
# ============================================================================
# - Rebuilds the image under a distinct tag (:vnet) so the OLD app's :latest is
#   untouched (clean blue/green). The rebuild bakes the client VITE_* values and
#   picks up the new server-side GET /api/feedback/list admin endpoint.
# - Creates a NEW app (azure-diagram-builder-vnet) in the VNet env, cloning the
#   old app's ingress/scale/identity/secrets/env, plus FEEDBACK_ADMIN_TOKEN.
# - Grants the new managed identity the same data-plane RBAC (Speech + Cosmos).
#
# The OLD app keeps running untouched. Cutover (repoint redirect + delete old)
# is a separate manual step after verification.
#
# Prereqs: 01-network.sh + 02-aca-env.sh done; .env present at repo root.
# Usage:   ./scripts/vnet-migration/03-deploy-webapp.sh
# ============================================================================
set -euo pipefail

RG="azure-diagrams-rg"
LOC="eastus2"
SUB="7a28b21e-0d3e-4435-a686-d92889d4ee96"
NEW_ENV="aca-env-azure-diagrams-vnet"
NEW_APP="azure-diagram-builder-vnet"
ACR="acrazurediagrams1767583743"
IMAGE="azure-diagram-builder"
TAG="vnet"
ACR_IMAGE="$ACR.azurecr.io/$IMAGE:$TAG"

COSMOS_ACCOUNT="aqcosmosdb007"
COSMOS_DATA_CONTRIBUTOR="00000000-0000-0000-0000-000000000002"  # Cosmos DB Built-in Data Contributor
SPEECH_RG="AQ-FOUNDRY-RG"
SPEECH_ACCOUNT="aq-speech-008"

SOURCE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$SOURCE_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo "❌ .env not found at $ENV_FILE"; exit 1; }

get_val() {
  { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; } || true
}

echo "Subscription: $(az account show --query name -o tsv)"

# ── Runtime secret/env values sourced from .env ─────────────────────────────
# azd-prepackage.sh maps VITE_AZURE_OPENAI_API_KEY <- AZURE_OPENAI_API_KEY (same value).
OPENAI_KEY="$(get_val AZURE_OPENAI_API_KEY)"
VITE_ENDPOINT="$(get_val VITE_AZURE_OPENAI_ENDPOINT)"
VITE_DEPLOY52="$(get_val VITE_AZURE_OPENAI_DEPLOYMENT_GPT52)"
[[ -n "$OPENAI_KEY" && -n "$VITE_ENDPOINT" && -n "$VITE_DEPLOY52" ]] \
  || { echo "❌ Missing one of AZURE_OPENAI_API_KEY / VITE_AZURE_OPENAI_ENDPOINT / VITE_AZURE_OPENAI_DEPLOYMENT_GPT52 in .env"; exit 1; }

# Admin token for GET /api/feedback/list — generate + persist to .env if absent.
FEEDBACK_TOKEN="$(get_val FEEDBACK_ADMIN_TOKEN)"
if [[ -z "$FEEDBACK_TOKEN" ]]; then
  FEEDBACK_TOKEN="$(openssl rand -hex 32)"
  printf '\nFEEDBACK_ADMIN_TOKEN=%s\n' "$FEEDBACK_TOKEN" >> "$ENV_FILE"
  echo "🔑 Generated FEEDBACK_ADMIN_TOKEN and appended to .env"
fi

# ── Rebuild image (:vnet) — bakes VITE_* and includes new server endpoint ───
echo "🔨 Building $ACR_IMAGE in ACR (bakes VITE_* + new /api/feedback/list) ..."
APPINSIGHTS_FILE="$SOURCE_DIR/.env.appinsights"
: > "$APPINSIGHTS_FILE"
BUILD_ARGS=()
while IFS='=' read -r key value; do
  if [[ "$key" == VITE_* && -n "$value" ]]; then
    value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
    if [[ "$key" == "VITE_APPINSIGHTS_CONNECTION_STRING" ]]; then
      echo "$key=$value" > "$APPINSIGHTS_FILE"; continue
    fi
    BUILD_ARGS+=(--build-arg "$key=$value")
  fi
done < <(grep -v '^#' "$ENV_FILE" | grep -v '^[[:space:]]*$')

az acr build --registry "$ACR" --image "$IMAGE:$TAG" "${BUILD_ARGS[@]}" "$SOURCE_DIR"

# ── ACR admin creds (old app used admin-cred pull) ──────────────────────────
ACR_USER="$(az acr credential show -n "$ACR" --query username -o tsv)"
ACR_PW="$(az acr credential show -n "$ACR" --query 'passwords[0].value' -o tsv)"

# ── Create the new app in the VNet env ──────────────────────────────────────
if az containerapp show -n "$NEW_APP" -g "$RG" -o none 2>/dev/null; then
  echo "✓ App $NEW_APP already exists — updating image to $ACR_IMAGE"
  az containerapp registry set -n "$NEW_APP" -g "$RG" \
    --server "$ACR.azurecr.io" --username "$ACR_USER" --password "$ACR_PW" -o none
  az containerapp update -n "$NEW_APP" -g "$RG" --image "$ACR_IMAGE" -o none
else
  echo "🚀 Creating $NEW_APP in $NEW_ENV ..."
  az containerapp create -n "$NEW_APP" -g "$RG" \
    --environment "$NEW_ENV" \
    --image "$ACR_IMAGE" \
    --registry-server "$ACR.azurecr.io" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PW" \
    --system-assigned \
    --ingress external --target-port 80 --transport auto \
    --min-replicas 1 --max-replicas 1 \
    --cpu 0.5 --memory 1Gi \
    --secrets \
        vite-azure-openai-api-key="$OPENAI_KEY" \
        vite-azure-openai-endpoint="$VITE_ENDPOINT" \
        vite-azure-openai-deployment-gpt52="$VITE_DEPLOY52" \
        feedback-admin-token="$FEEDBACK_TOKEN" \
    --env-vars \
        AZURE_COSMOS_ENDPOINT="https://aqcosmosdb007.documents.azure.com:443/" \
        COSMOS_DATABASE_ID="diagrams-db" \
        COSMOS_CONTAINER_ID="diagrams" \
        COSMOS_FEEDBACK_CONTAINER_ID="feedback" \
        AZURE_SPEECH_REGION="westus2" \
        AZURE_SPEECH_RESOURCE_ID="/subscriptions/$SUB/resourceGroups/$SPEECH_RG/providers/Microsoft.CognitiveServices/accounts/$SPEECH_ACCOUNT" \
        AZURE_OPENAI_ENDPOINT="https://r2d2-foundry-001.openai.azure.com/" \
        AZURE_OPENAI_API_KEY="$OPENAI_KEY" \
        VITE_AZURE_OPENAI_ENDPOINT=secretref:vite-azure-openai-endpoint \
        VITE_AZURE_OPENAI_API_KEY=secretref:vite-azure-openai-api-key \
        VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=secretref:vite-azure-openai-deployment-gpt52 \
        FEEDBACK_ADMIN_TOKEN=secretref:feedback-admin-token \
        PUBLIC_URL="https://pending.invalid" \
    -o none
fi

# ── PUBLIC_URL = own FQDN ───────────────────────────────────────────────────
FQDN="$(az containerapp show -n "$NEW_APP" -g "$RG" --query 'properties.configuration.ingress.fqdn' -o tsv)"
az containerapp update -n "$NEW_APP" -g "$RG" --set-env-vars "PUBLIC_URL=https://$FQDN" -o none

# ── Grant data-plane RBAC to the new managed identity ───────────────────────
PRINCIPAL="$(az containerapp show -n "$NEW_APP" -g "$RG" --query identity.principalId -o tsv)"
echo "🔐 Granting RBAC to MI $PRINCIPAL ..."

SPEECH_ID="$(az cognitiveservices account show -n "$SPEECH_ACCOUNT" -g "$SPEECH_RG" --query id -o tsv)"
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Cognitive Services Speech User" --scope "$SPEECH_ID" -o none 2>/dev/null \
  && echo "  ✓ Speech User on $SPEECH_ACCOUNT" || echo "  • Speech role already present"

COSMOS_ID="$(az cosmosdb show -n "$COSMOS_ACCOUNT" -g "$RG" --query id -o tsv)"
az cosmosdb sql role assignment create -a "$COSMOS_ACCOUNT" -g "$RG" \
  --role-definition-id "$COSMOS_DATA_CONTRIBUTOR" \
  --principal-id "$PRINCIPAL" --scope "$COSMOS_ID" -o none 2>/dev/null \
  && echo "  ✓ Cosmos Data Contributor on $COSMOS_ACCOUNT" || echo "  • Cosmos role already present"

echo ""
echo "✅ New web app deployed (blue/green — old app untouched):"
echo "   https://$FQDN"
echo ""
echo "Next: verify a feedback WRITE lands in Cosmos over the PE, read it back via"
echo "  curl -H \"Authorization: Bearer \$FEEDBACK_ADMIN_TOKEN\" https://$FQDN/api/feedback/list"
echo "Then run cutover (repoint aka.ms/diagram-builder + delete old app)."
