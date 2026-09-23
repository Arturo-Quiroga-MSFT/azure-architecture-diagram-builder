#!/bin/bash
#
# Deploy the MCP-enabled Diagram Builder to a SEPARATE, isolated ACA instance
# ===========================================================================
#
# Creates a standalone Azure Container App (in its own resource group + ACA
# environment) running this branch's image: the Vite web UI + the Diagram
# Builder MCP server (Streamable-HTTP at /mcp, Bearer-token protected).
#
# This is intentionally kept separate from the production app
# (azure-diagram-builder in azure-diagrams-rg) so the SRE Agent integration
# experiment can be torn down in one shot:  az group delete -n azure-diagrams-mcp-rg
#
# Scope (per decision): MCP server + web UI only. No Cosmos feedback wiring,
# no speech/avatar runtime env. VITE_* build args are still passed so the UI
# renders; the MCP tools themselves are deterministic and need no LLM.
#
# Prereqs: az login; .env in repo root with the VITE_* vars; ACR admin enabled.
#
# Usage:   ./scripts/deploy-mcp-instance.sh
#
set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────
RG="azure-diagrams-mcp-rg"
LOCATION="eastus2"
ACR="acrazurediagrams1767583743"
ACR_LOGIN_SERVER="acrazurediagrams1767583743.azurecr.io"
ENV_NAME="aca-env-mcp"
APP="azure-diagram-builder-mcp"
IMAGE_TAG="azure-diagram-builder-mcp:latest"
IMAGE="${ACR_LOGIN_SERVER}/${IMAGE_TAG}"
TOKEN_FILE=".env.mcp-instance"

cd "$(dirname "$0")/.."

# Load build-time Vite vars from .env
set -a && source .env && set +a

# ── MCP auth token (persist so re-runs reuse the same token) ────────────
if [ -f "$TOKEN_FILE" ]; then
  # shellcheck disable=SC1090
  source "$TOKEN_FILE"
fi
if [ -z "${MCP_AUTH_TOKEN:-}" ]; then
  MCP_AUTH_TOKEN="$(openssl rand -base64 32)"
  echo "MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}" > "$TOKEN_FILE"
  echo "🔑 Generated MCP_AUTH_TOKEN → ${TOKEN_FILE} (gitignored)"
else
  echo "🔑 Reusing MCP_AUTH_TOKEN from ${TOKEN_FILE}"
fi

# ── App Insights glob workaround (keeps the Dockerfile COPY happy) ───────
# The Dockerfile COPYs .env.build* .env.appinsights*; at least one must exist.
grep '^VITE_APPINSIGHTS_CONNECTION_STRING' .env | tr -d '"' > .env.appinsights 2>/dev/null || true
[ -s .env.appinsights ] || echo "# none" > .env.appinsights

# ── 1. Build the image in the existing ACR (new image name) ─────────────
echo "🚀 [1/5] Building ${IMAGE_TAG} in ACR ${ACR}..."
az acr build --registry "$ACR" --image "$IMAGE_TAG" \
  --build-arg "VITE_AZURE_OPENAI_ENDPOINT=$VITE_AZURE_OPENAI_ENDPOINT" \
  --build-arg "VITE_AZURE_OPENAI_API_KEY=${VITE_AZURE_OPENAI_API_KEY:-}" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT51=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT51" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT54=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT54" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI=$VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK=$VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO=$VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST=$VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_GROK43=$VITE_AZURE_OPENAI_DEPLOYMENT_GROK43" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3=$VITE_AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3" \
  --build-arg "VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK25=$VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK25" \
  --build-arg "VITE_SPEECH_REGION=$VITE_SPEECH_REGION" \
  .

# ── 2. Resource group ───────────────────────────────────────────────────
echo "📦 [2/5] Resource group ${RG}..."
az group create -n "$RG" -l "$LOCATION" -o none

# ── 3. ACA environment ──────────────────────────────────────────────────
if az containerapp env show -n "$ENV_NAME" -g "$RG" -o none 2>/dev/null; then
  echo "🌐 [3/5] ACA environment ${ENV_NAME} already exists."
else
  echo "🌐 [3/5] Creating ACA environment ${ENV_NAME}..."
  az containerapp env create -n "$ENV_NAME" -g "$RG" -l "$LOCATION" -o none
fi

# ── 4. ACR admin credentials (same pattern as the prod app) ─────────────
ACR_USER="$(az acr credential show -n "$ACR" --query username -o tsv)"
ACR_PASS="$(az acr credential show -n "$ACR" --query 'passwords[0].value' -o tsv)"

# ── 5. Create / update the Container App ────────────────────────────────
# min=max=1: the MCP HTTP transport keeps session state in memory, so a single
# always-on replica avoids scale-to-zero dropping active MCP sessions.
if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  echo "♻️  [5/5] Updating existing Container App ${APP}..."
  az containerapp update -n "$APP" -g "$RG" \
    --image "$IMAGE" \
    --set-env-vars "MCP_AUTH_TOKEN=secretref:mcp-auth-token" \
    --revision-suffix "v$(date +%s)" -o none
else
  echo "🆕 [5/5] Creating Container App ${APP}..."
  az containerapp create -n "$APP" -g "$RG" --environment "$ENV_NAME" \
    --image "$IMAGE" \
    --registry-server "$ACR_LOGIN_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 80 --ingress external \
    --min-replicas 1 --max-replicas 1 \
    --cpu 0.5 --memory 1.0Gi \
    --secrets "mcp-auth-token=${MCP_AUTH_TOKEN}" \
    --env-vars "MCP_AUTH_TOKEN=secretref:mcp-auth-token" \
    -o none
fi

# ── Result ──────────────────────────────────────────────────────────────
FQDN="$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
echo ""
echo "✅ Deployed."
echo "   Web UI : https://${FQDN}"
echo "   MCP    : https://${FQDN}/mcp   (Authorization: Bearer <token from ${TOKEN_FILE}>)"
echo "   Health : https://${FQDN}/mcp/healthz"
echo ""
echo "Teardown when done:  az group delete -n ${RG} --yes --no-wait"
