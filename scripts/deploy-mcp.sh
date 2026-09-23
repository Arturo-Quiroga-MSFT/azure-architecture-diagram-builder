#!/bin/bash
#
# Deploy the DECOUPLED MCP server as its own Azure Container App (own FQDN).
# ========================================================================
#
# This is the only supported MCP deployment path. It builds the standalone MCP
# image (mcp-server/Dockerfile) and updates only the dedicated MCP Container App.
# The web app is left untouched.
#
# Reuses your existing production infra from .env:
#   RESOURCE_GROUP  - resource group containing the web Container App + ACR
#   ACR_NAME        - Azure Container Registry name
#   ACA_APP_NAME    - the production WEB app (used only to locate its ACA env)
#
# The MCP app lands in the SAME Container Apps environment as the web app.
#
# Auth: a bearer token is generated once and persisted to .env.mcp (gitignored).
# Set it as `Authorization: Bearer <token>` on every /mcp request.
#
# Prereqs: az login; ACR admin user enabled (same as deploy-mcp-instance.sh).
#
# Usage:   ./scripts/deploy-mcp.sh
#
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$SOURCE_DIR/.env"
TOKEN_FILE="$SOURCE_DIR/.env.mcp"

# ── Load .env ───────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ .env not found at $ENV_FILE"; exit 1
fi
export $(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$' | xargs)

for var in RESOURCE_GROUP ACR_NAME ACA_APP_NAME; do
  if [[ -z "${!var:-}" ]]; then echo "❌ Missing $var in .env"; exit 1; fi
done

# ── Config (override MCP_ACA_APP_NAME in .env if desired) ────────────────
MCP_APP="${MCP_ACA_APP_NAME:-azure-diagram-mcp}"
MCP_IMAGE_NAME="azure-diagram-mcp"
ACR_LOGIN_SERVER="${ACR_NAME}.azurecr.io"
TAG="mcp-$(date -u +%Y%m%d-%H%M%S)"
IMAGE="${ACR_LOGIN_SERVER}/${MCP_IMAGE_NAME}:${TAG}"
NPM_REGISTRY="${NPM_REGISTRY:-https://packagefeedproxy.microsoft.io/npm/}"

cd "$SOURCE_DIR"

# ── MCP auth token (generate once, reuse on re-runs) ────────────────────
if [[ -f "$TOKEN_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$TOKEN_FILE"
fi
if [[ -z "${MCP_AUTH_TOKEN:-}" ]]; then
  MCP_AUTH_TOKEN="$(openssl rand -base64 32)"
  echo "MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}" > "$TOKEN_FILE"
  echo "🔑 Generated MCP_AUTH_TOKEN → ${TOKEN_FILE} (gitignored)"
else
  echo "🔑 Reusing MCP_AUTH_TOKEN from ${TOKEN_FILE}"
fi

# ── 1. Build the standalone MCP image in ACR ────────────────────────────
# No VITE build args: the MCP server is deterministic and needs no model config.
# Context is the repo root so the build's sync scripts can read src/data +
# Azure_Public_Service_Icons (single source of truth for icons/pricing).
echo "🔨 [1/4] Building ${MCP_IMAGE_NAME}:${TAG} in ACR ${ACR_NAME}..."
az acr build \
  --registry "$ACR_NAME" \
  --image "${MCP_IMAGE_NAME}:${TAG}" \
  --file mcp-server/Dockerfile \
  --build-arg "NPM_REGISTRY=${NPM_REGISTRY}" \
  "$SOURCE_DIR"

# ── 2. Locate the web app's Container Apps environment ──────────────────
echo "🌐 [2/4] Locating ACA environment from ${ACA_APP_NAME}..."
ENV_ID="$(az containerapp show -n "$ACA_APP_NAME" -g "$RESOURCE_GROUP" \
  --query properties.managedEnvironmentId -o tsv)"
if [[ -z "$ENV_ID" ]]; then echo "❌ Could not resolve ACA environment"; exit 1; fi

# ── 3. ACR admin credentials (same pattern as deploy-mcp-instance.sh) ───
ACR_USER="$(az acr credential show -n "$ACR_NAME" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR_NAME" --query 'passwords[0].value' -o tsv)"

# ── 4. Create / update the MCP Container App (target-port 3030) ─────────
# min=1 avoids cold-start latency. The MCP HTTP transport is stateless, so
# revisions and replicas do not need shared or sticky session state.
if az containerapp show -n "$MCP_APP" -g "$RESOURCE_GROUP" -o none 2>/dev/null; then
  echo "♻️  [4/4] Updating existing Container App ${MCP_APP}..."
  az containerapp secret set -n "$MCP_APP" -g "$RESOURCE_GROUP" \
    --secrets "mcp-auth-token=${MCP_AUTH_TOKEN}" -o none
  az containerapp update -n "$MCP_APP" -g "$RESOURCE_GROUP" \
    --image "$IMAGE" \
    --set-env-vars \
      "MCP_AUTH_TOKEN=secretref:mcp-auth-token" \
      "MCP_HTTP_HOST=0.0.0.0" "MCP_HTTP_PORT=3030" "MCP_HTTP_PATH=/mcp" \
    --revision-suffix "v$(date +%s)" -o none
else
  echo "🆕 [4/4] Creating Container App ${MCP_APP}..."
  az containerapp create -n "$MCP_APP" -g "$RESOURCE_GROUP" --environment "$ENV_ID" \
    --image "$IMAGE" \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 3030 --ingress external \
    --min-replicas 1 --max-replicas 5 \
    --cpu 0.5 --memory 1.0Gi \
    --secrets "mcp-auth-token=${MCP_AUTH_TOKEN}" \
    --env-vars \
      "MCP_AUTH_TOKEN=secretref:mcp-auth-token" \
      "MCP_HTTP_HOST=0.0.0.0" "MCP_HTTP_PORT=3030" "MCP_HTTP_PATH=/mcp" \
    -o none
fi

# ── Result ──────────────────────────────────────────────────────────────
FQDN="$(az containerapp show -n "$MCP_APP" -g "$RESOURCE_GROUP" \
  --query properties.configuration.ingress.fqdn -o tsv)"
echo ""
echo "✅ MCP server deployed (decoupled)."
echo "   Image        : ${IMAGE}"
echo "   MCP endpoint : https://${FQDN}/mcp      (Authorization: Bearer <token in ${TOKEN_FILE}>)"
echo "   Health       : https://${FQDN}/healthz"
echo ""
echo "Point Scout at:  https://${FQDN}/mcp"
echo "Teardown app :   az containerapp delete -n ${MCP_APP} -g ${RESOURCE_GROUP} --yes"
