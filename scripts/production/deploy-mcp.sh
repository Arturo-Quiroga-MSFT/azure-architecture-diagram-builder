#!/usr/bin/env bash
#
# deploy-mcp.sh — build and roll out the remote MCP server to a target.
# ============================================================================
# The MCP server runs as its own Container App (own FQDN) in the target's ACA
# environment, next to the web app.
#
# - Immutable image tag from the Git commit; refuses a dirty mcp-server/ tree.
# - Managed identity with AcrPull (no registry admin credentials).
# - Auth: Microsoft Entra OAuth (MCP_ENTRA_CLIENT_ID from the target file) for
#   VS Code / GitHub Copilot, plus a static bearer token fallback for clients
#   that cannot do OAuth. The static token is generated once and kept in
#   .env.mcp.<target> (gitignored).
# - Verifies health, Protected Resource Metadata and the 401 challenge after
#   the rollout; keeps the previous revision for rollback.
#
# Usage:  AADB_TARGET=fdpo ./scripts/production/deploy-mcp.sh
# ============================================================================
set -euo pipefail

source "$(dirname "$0")/target.sh"
SOURCE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
NPM_REGISTRY="${NPM_REGISTRY:-https://packagefeedproxy.microsoft.io/npm/}"
MCP_IMAGE="${MCP_IMAGE:-azure-diagram-mcp}"
TOKEN_FILE="$SOURCE_DIR/.env.mcp.$AADB_TARGET"

[[ -n "${MCP_APP:-}" ]] || { echo "❌ MCP_APP is not set for target $AADB_TARGET" >&2; exit 1; }
if [[ -n "$(git -C "$SOURCE_DIR" status --porcelain -- mcp-server src/data src/services/armExtractor.ts)" ]]; then
  echo "❌ Refusing to build uncommitted MCP sources; commit them first." >&2
  exit 1
fi
GIT_SHA="$(git -C "$SOURCE_DIR" rev-parse --short=12 HEAD)"
TAG="mcp-${GIT_SHA}"
ACR_IMAGE="$ACR.azurecr.io/$MCP_IMAGE:$TAG"
REV_SUFFIX="mcp-${GIT_SHA}"

# ── Static bearer token (fallback auth), generated once per target ─────────
if [[ -f "$TOKEN_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$TOKEN_FILE"
fi
if [[ -z "${MCP_AUTH_TOKEN:-}" ]]; then
  git -C "$SOURCE_DIR" check-ignore -q "$TOKEN_FILE" \
    || { echo "❌ Refusing to write $TOKEN_FILE: it is not gitignored" >&2; exit 1; }
  MCP_AUTH_TOKEN="$(openssl rand -hex 32)"
  (umask 077; printf 'MCP_AUTH_TOKEN=%s\n' "$MCP_AUTH_TOKEN" > "$TOKEN_FILE")
  echo "🔑 Generated a static MCP token in $(basename "$TOKEN_FILE")"
fi

# ── 1. Build the image in ACR (reuse if this commit is already built) ──────
EXISTING_TAG="$(az acr repository show-tags --name "$ACR" --repository "$MCP_IMAGE" \
  --query "[?@=='$TAG'] | [0]" -o tsv 2>/dev/null || true)"
if [[ -n "$EXISTING_TAG" ]]; then
  echo "✓ Reusing existing image $ACR_IMAGE"
else
  echo "🔨 Building $ACR_IMAGE ..."
  az acr build --registry "$ACR" --image "$MCP_IMAGE:$TAG" \
    --file mcp-server/Dockerfile --build-arg "NPM_REGISTRY=$NPM_REGISTRY" "$SOURCE_DIR"
fi

# ── 2. Create the app on a public placeholder when absent ──────────────────
if ! az containerapp show -n "$MCP_APP" -g "$RG" -o none 2>/dev/null; then
  echo "🚀 Creating $MCP_APP in $NEW_ENV (placeholder image) ..."
  az containerapp create -n "$MCP_APP" -g "$RG" --environment "$NEW_ENV" \
    --image mcr.microsoft.com/k8se/quickstart:latest \
    --system-assigned \
    --ingress external --target-port 80 --transport auto \
    --min-replicas 1 --max-replicas 5 --cpu 0.5 --memory 1Gi \
    -o none
fi

PRINCIPAL="$(az containerapp show -n "$MCP_APP" -g "$RG" --query identity.principalId -o tsv)"
ACR_ID="$(az acr show -n "$ACR" --query id -o tsv)"
if [[ -z "$(az role assignment list --assignee-object-id "$PRINCIPAL" --scope "$ACR_ID" \
      --query "[?roleDefinitionName=='AcrPull'] | [0].id" -o tsv)" ]]; then
  az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
    --role AcrPull --scope "$ACR_ID" -o none
  echo "  ✓ AcrPull on $ACR (waiting 60s for role propagation)"
  sleep 60
fi
az containerapp registry set -n "$MCP_APP" -g "$RG" --server "$ACR.azurecr.io" --identity system -o none

FQDN="$(az containerapp show -n "$MCP_APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
PUBLIC_URL="https://$FQDN"
PREVIOUS_REVISION="$(az containerapp show -n "$MCP_APP" -g "$RG" --query properties.latestReadyRevisionName -o tsv)"

# ── 3. Roll out the real image with auth configuration ─────────────────────
az containerapp secret set -n "$MCP_APP" -g "$RG" --secrets "mcp-auth-token=$MCP_AUTH_TOKEN" -o none
ENV_VARS=(
  "MCP_AUTH_TOKEN=secretref:mcp-auth-token"
  "MCP_HTTP_HOST=0.0.0.0" "MCP_HTTP_PORT=3030" "MCP_HTTP_PATH=/mcp"
  "MCP_PUBLIC_URL=$PUBLIC_URL"
)
[[ -n "${MCP_ENTRA_CLIENT_ID:-}" ]] && ENV_VARS+=("MCP_ENTRA_CLIENT_ID=$MCP_ENTRA_CLIENT_ID")
[[ -n "${MCP_ENTRA_ALLOWED_TENANTS:-}" ]] && ENV_VARS+=("MCP_ENTRA_ALLOWED_TENANTS=$MCP_ENTRA_ALLOWED_TENANTS")

if az containerapp revision show -n "$MCP_APP" -g "$RG" --revision "$MCP_APP--$REV_SUFFIX" -o none 2>/dev/null; then
  echo "✓ Revision $MCP_APP--$REV_SUFFIX already exists"
else
  echo "🚀 Rolling out $ACR_IMAGE ..."
  az containerapp ingress update -n "$MCP_APP" -g "$RG" --target-port 3030 -o none
  az containerapp update -n "$MCP_APP" -g "$RG" --image "$ACR_IMAGE" \
    --set-env-vars "${ENV_VARS[@]}" --revision-suffix "$REV_SUFFIX" -o none
fi

# ── 4. Verify the live endpoint ────────────────────────────────────────────
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors "$PUBLIC_URL/healthz" -o /dev/null
STATUS="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$PUBLIC_URL/mcp" -H 'content-type: application/json' -d '{}')"
[[ "$STATUS" == "401" ]] || { echo "❌ Unauthenticated POST returned $STATUS (expected 401)" >&2; exit 1; }
if [[ -n "${MCP_ENTRA_CLIENT_ID:-}" ]]; then
  curl --fail --silent --show-error "$PUBLIC_URL/.well-known/oauth-protected-resource/mcp" \
    | node -e "let b='';process.stdin.on('data',c=>b+=c).on('end',()=>{const m=JSON.parse(b);if(m.resource!=='$PUBLIC_URL/mcp')throw new Error('resource mismatch: '+m.resource);console.log('  ✓ Protected Resource Metadata:',m.scopes_supported.join(' '))})"
fi

echo ""
echo "✅ MCP server deployed: $PUBLIC_URL/mcp"
echo "   Image: $ACR_IMAGE"
echo "   Auth: Entra OAuth${MCP_ENTRA_CLIENT_ID:+ (client $MCP_ENTRA_CLIENT_ID)} + static token in $(basename "$TOKEN_FILE")"
[[ -n "$PREVIOUS_REVISION" ]] && echo "   Previous revision: $PREVIOUS_REVISION"
