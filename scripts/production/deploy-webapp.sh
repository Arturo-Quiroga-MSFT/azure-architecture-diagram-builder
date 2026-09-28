#!/usr/bin/env bash
#
# deploy-webapp.sh — THE production deploy for the web app. Build and safely
# roll out to the VNet-integrated ACA environment.
# ============================================================================
# - Builds an immutable image tag from the app version and Git commit.
# - Uses managed identity with AcrPull instead of stored ACR admin credentials.
# - Creates a probe-bearing candidate revision while traffic remains on the
#   current healthy revision, then switches traffic only after direct smoke tests.
# - Keeps the previous revision active at 0% traffic for an explicit rollback.
#
# Bump the version in package.json first — the image tag, the revision suffix
# and the post-deploy check all read it, and the script refuses a dirty worktree.
#
# Prereqs: 00-foundation.sh (new targets), 01-network.sh + 02-aca-env.sh done
#          (one-time); the target's env file (TARGET_ENV_FILE, default .env) present.
# Usage:   [AADB_TARGET=fdpo] ./scripts/production/deploy-webapp.sh
# ============================================================================
set -euo pipefail

source "$(dirname "$0")/target.sh"
BUILD_ONLY="${BUILD_ONLY:-false}"
ROTATE_OPENAI_SECRET="${ROTATE_OPENAI_SECRET:-false}"
ROTATE_SERVER_TELEMETRY_SECRET="${ROTATE_SERVER_TELEMETRY_SECRET:-false}"
NPM_REGISTRY="${NPM_REGISTRY:-https://packagefeedproxy.microsoft.io/npm/}"
COSMOS_DATA_CONTRIBUTOR="00000000-0000-0000-0000-000000000002"  # Cosmos DB Built-in Data Contributor

SOURCE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
# Each target has its own env file (deployment names differ per Foundry resource).
ENV_FILE="$SOURCE_DIR/${TARGET_ENV_FILE:-.env}"
[[ -f "$ENV_FILE" ]] || { echo "❌ Env file not found at $ENV_FILE"; exit 1; }
APP_VERSION="$(node -p "require('$SOURCE_DIR/package.json').version")"
GIT_SHA="$(git -C "$SOURCE_DIR" rev-parse --short=12 HEAD)"
TAG="v${APP_VERSION}-${GIT_SHA}"
REV_SUFFIX="v${APP_VERSION//./-}-${GIT_SHA}"
ACR_IMAGE="$ACR.azurecr.io/$IMAGE:$TAG"

if [[ -n "$(git -C "$SOURCE_DIR" status --porcelain)" ]]; then
  echo "❌ Refusing to build an uncommitted worktree; commit the exact source first." >&2
  exit 1
fi

get_file_val() {
  { grep -E "^$1=" "$2" | head -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; } || true
}

get_val() {
  get_file_val "$1" "$ENV_FILE"
}

if [[ "$BUILD_ONLY" != "true" ]] && az containerapp show -n "$NEW_APP" -g "$RG" -o none 2>/dev/null; then
  DEPLOYED_FQDN="$(az containerapp show -n "$NEW_APP" -g "$RG" --query 'properties.configuration.ingress.fqdn' -o tsv)"
  "$SOURCE_DIR/scripts/require-version-bump.sh" "https://$DEPLOYED_FQDN"
fi

# ── Runtime secret/env values sourced from .env ─────────────────────────────
# azd-prepackage.sh maps VITE_AZURE_OPENAI_API_KEY <- AZURE_OPENAI_API_KEY (same value).
VITE_ENDPOINT="$(get_val VITE_AZURE_OPENAI_ENDPOINT)"
VITE_DEFAULT_DEPLOYMENT="$(get_val VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA)"
[[ -n "$VITE_ENDPOINT" && -n "$VITE_DEFAULT_DEPLOYMENT" ]] \
  || { echo "❌ Missing VITE_AZURE_OPENAI_ENDPOINT / VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA in $ENV_FILE"; exit 1; }
OPENAI_KEY=""
if [[ "$OPENAI_AUTH" == "key" ]]; then
  OPENAI_KEY="$(get_val AZURE_OPENAI_API_KEY)"
  [[ -n "$OPENAI_KEY" ]] || { echo "❌ Target '$AADB_TARGET' uses key auth but AZURE_OPENAI_API_KEY is missing in $ENV_FILE"; exit 1; }
fi
SERVER_APPINSIGHTS_CONNECTION_STRING="$(az monitor app-insights component show \
  --app "$SERVER_APP_INSIGHTS" -g "$RG" --query connectionString -o tsv)"
[[ -n "$SERVER_APPINSIGHTS_CONNECTION_STRING" ]] \
  || { echo "❌ Application Insights connection string is unavailable for $SERVER_APP_INSIGHTS"; exit 1; }

# Admin token for GET /api/feedback/list — generate + persist to .env if absent.
FEEDBACK_TOKEN="$(get_val FEEDBACK_ADMIN_TOKEN)"
if [[ -z "$FEEDBACK_TOKEN" ]]; then
  git -C "$SOURCE_DIR" check-ignore -q "$ENV_FILE" \
    || { echo "❌ Refusing to write FEEDBACK_ADMIN_TOKEN: $ENV_FILE is not gitignored"; exit 1; }
  FEEDBACK_TOKEN="$(openssl rand -hex 32)"
  printf '\nFEEDBACK_ADMIN_TOKEN=%s\n' "$FEEDBACK_TOKEN" >> "$ENV_FILE"
  echo "🔑 Generated FEEDBACK_ADMIN_TOKEN and appended to $(basename "$ENV_FILE")"
fi

# ── Build immutable image — bakes VITE_* and includes the token server ───────
echo "🔨 Preparing immutable image $ACR_IMAGE in ACR ..."
APPINSIGHTS_FILE="$SOURCE_DIR/.env.appinsights"
: > "$APPINSIGHTS_FILE"
BUILD_ARGS=()
if [[ -n "${WEB_APP_INSIGHTS:-}" ]]; then
  echo "VITE_APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
    --app "$WEB_APP_INSIGHTS" -g "$RG" --query connectionString -o tsv)" > "$APPINSIGHTS_FILE"
fi
while IFS='=' read -r key value; do
  if [[ "$key" == VITE_* && -n "$value" ]]; then
    value="${value%\"}"; value="${value#\"}"; value="${value%\'}"; value="${value#\'}"
    if [[ "$key" == "VITE_APPINSIGHTS_CONNECTION_STRING" ]]; then
      [[ -n "${WEB_APP_INSIGHTS:-}" ]] || echo "$key=$value" > "$APPINSIGHTS_FILE"
      continue
    fi
    if [[ "$key" == "VITE_AZURE_OPENAI_API_KEY" || "$key" == "VITE_ENABLE_ADOPTION_IMPACT" ]]; then
      continue
    fi
    BUILD_ARGS+=(--build-arg "$key=$value")
  fi
done < <(grep -v '^#' "$ENV_FILE" | grep -v '^[[:space:]]*$')

EXISTING_TAG="$(az acr repository show-tags --name "$ACR" --repository "$IMAGE" \
  --query "[?@=='$TAG'] | [0]" -o tsv)"
if [[ -n "$EXISTING_TAG" ]]; then
  echo "✓ Reusing existing immutable image $ACR_IMAGE"
else
  TELEMETRY_HASH_SECRET="$(openssl rand -hex 32)"
  az acr build --registry "$ACR" --image "$IMAGE:$TAG" \
    --build-arg "NPM_REGISTRY=$NPM_REGISTRY" \
    "${BUILD_ARGS[@]}" \
    --build-arg "LOAD_ENV_BUILD=false" \
    --build-arg "VITE_ENABLE_ADOPTION_IMPACT=false" \
    --build-arg "ENABLE_ADOPTION_IMPACT=false" \
    "$SOURCE_DIR"
fi

if [[ "$BUILD_ONLY" == "true" ]]; then
  echo "✅ Build-only validation completed: $ACR_IMAGE"
  exit 0
fi

# ── Create the app when absent; existing releases use revision rollout ──────
if az containerapp show -n "$NEW_APP" -g "$RG" -o none 2>/dev/null; then
  echo "✓ App $NEW_APP already exists"
else
  COSMOS_ENDPOINT="$(az cosmosdb show -n "$COSMOS_ACCOUNT" -g "$COSMOS_RG" --query documentEndpoint -o tsv)"
  SPEECH_RESOURCE_ID="$(az cognitiveservices account show -n "$SPEECH_ACCOUNT" -g "$SPEECH_RG" --query id -o tsv)"
  TELEMETRY_HASH_SECRET="$(openssl rand -hex 32)"
  SECRETS=(
    feedback-admin-token="$FEEDBACK_TOKEN"
    server-appinsights-connection-string="$SERVER_APPINSIGHTS_CONNECTION_STRING"
    telemetry-hash-secret="$TELEMETRY_HASH_SECRET"
  )
  ENV_VARS=(
    AZURE_COSMOS_ENDPOINT="$COSMOS_ENDPOINT"
    COSMOS_DATABASE_ID="$COSMOS_DATABASE_ID"
    COSMOS_CONTAINER_ID="$COSMOS_CONTAINER_ID"
    COSMOS_FEEDBACK_CONTAINER_ID="$COSMOS_FEEDBACK_CONTAINER_ID"
    AZURE_SPEECH_REGION="$SPEECH_REGION"
    AZURE_SPEECH_RESOURCE_ID="$SPEECH_RESOURCE_ID"
    AZURE_OPENAI_ENDPOINT="$OPENAI_ENDPOINT"
    APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:server-appinsights-connection-string
    TELEMETRY_HASH_SECRET=secretref:telemetry-hash-secret
    OTEL_SERVICE_NAME="aadb-token-server"
    NODE_ENV="production"
    APP_VERSION="$APP_VERSION"
    FEEDBACK_ADMIN_TOKEN=secretref:feedback-admin-token
    PUBLIC_URL="https://pending.invalid"
  )
  if [[ "$OPENAI_AUTH" == "key" ]]; then
    SECRETS+=(azure-openai-api-key="$OPENAI_KEY")
    ENV_VARS+=(AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key)
  fi
  # Bootstrap on a public placeholder image: the app's managed identity must
  # exist and hold AcrPull before it can pull from the registry. The candidate
  # revision below swaps in the real image once the role is in place.
  echo "🚀 Creating $NEW_APP in $NEW_ENV (placeholder image) ..."
  az containerapp create -n "$NEW_APP" -g "$RG" \
    --environment "$NEW_ENV" \
    --image mcr.microsoft.com/k8se/quickstart:latest \
    --system-assigned \
    --ingress external --target-port 80 --transport auto \
    --min-replicas 1 --max-replicas 1 \
    --cpu 0.5 --memory 1Gi \
    --secrets "${SECRETS[@]}" \
    --env-vars "${ENV_VARS[@]}" \
    -o none
fi

# ── Configure identity, roles, and stable traffic boundary ──────────────────
FQDN="$(az containerapp show -n "$NEW_APP" -g "$RG" --query 'properties.configuration.ingress.fqdn' -o tsv)"
PRINCIPAL="$(az containerapp show -n "$NEW_APP" -g "$RG" --query identity.principalId -o tsv)"
echo "🔐 Granting RBAC to MI $PRINCIPAL ..."

ACR_ID="$(az acr show -n "$ACR" --query id -o tsv)"
EXISTING_ACR_ROLE="$(az role assignment list --assignee-object-id "$PRINCIPAL" --scope "$ACR_ID" \
  --query "[?roleDefinitionName=='AcrPull'] | [0].id" -o tsv)"
if [[ -z "$EXISTING_ACR_ROLE" ]]; then
  az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
    --role AcrPull --scope "$ACR_ID" -o none
  echo "  ✓ AcrPull on $ACR (waiting 60s for role propagation before the first pull)"
  sleep 60
else
  echo "  • AcrPull already present on $ACR"
fi

if [[ "$OPENAI_AUTH" == "key" ]]; then
  EXISTING_OPENAI_SECRET="$(az containerapp secret list -n "$NEW_APP" -g "$RG" \
    --query "[?name=='azure-openai-api-key'] | [0].name" -o tsv)"
  if [[ -z "$EXISTING_OPENAI_SECRET" || "$ROTATE_OPENAI_SECRET" == "true" ]]; then
    az containerapp secret set -n "$NEW_APP" -g "$RG" \
      --secrets azure-openai-api-key="$OPENAI_KEY" -o none
  else
    echo "  • OpenAI runtime secret already present"
  fi
else
  FOUNDRY_ID="$(az cognitiveservices account show -n "$FOUNDRY_ACCOUNT" -g "$FOUNDRY_RG" --query id -o tsv)"
  # Cognitive Services User covers inference for OpenAI, Anthropic and partner models.
  EXISTING_FOUNDRY_ROLE="$(az role assignment list --assignee-object-id "$PRINCIPAL" --scope "$FOUNDRY_ID" \
    --query "[?roleDefinitionName=='Cognitive Services User'] | [0].id" -o tsv)"
  if [[ -z "$EXISTING_FOUNDRY_ROLE" ]]; then
    az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
      --role "Cognitive Services User" --scope "$FOUNDRY_ID" -o none
    echo "  ✓ Cognitive Services User on $FOUNDRY_ACCOUNT (keyless model access)"
  else
    echo "  • Cognitive Services User already present on $FOUNDRY_ACCOUNT"
  fi
fi

EXISTING_SERVER_TELEMETRY_SECRET="$(az containerapp secret list -n "$NEW_APP" -g "$RG" \
  --query "[?name=='server-appinsights-connection-string'] | [0].name" -o tsv)"
if [[ -z "$EXISTING_SERVER_TELEMETRY_SECRET" || "$ROTATE_SERVER_TELEMETRY_SECRET" == "true" ]]; then
  az containerapp secret set -n "$NEW_APP" -g "$RG" \
    --secrets server-appinsights-connection-string="$SERVER_APPINSIGHTS_CONNECTION_STRING" -o none
  echo "  ✓ Dedicated server Application Insights connection configured"
else
  echo "  • Dedicated server Application Insights secret already present"
fi

EXISTING_TELEMETRY_HASH_SECRET="$(az containerapp secret list -n "$NEW_APP" -g "$RG" \
  --query "[?name=='telemetry-hash-secret'] | [0].name" -o tsv)"
if [[ -z "$EXISTING_TELEMETRY_HASH_SECRET" ]]; then
  TELEMETRY_HASH_SECRET="$(openssl rand -hex 32)"
  az containerapp secret set -n "$NEW_APP" -g "$RG" \
    --secrets telemetry-hash-secret="$TELEMETRY_HASH_SECRET" -o none
  unset TELEMETRY_HASH_SECRET
  echo "  ✓ Privacy-safe client-key secret generated"
else
  echo "  • Privacy-safe client-key secret already present"
fi

LOG_WORKSPACE_ID="$(az monitor log-analytics workspace show -n "$LOG_WORKSPACE" -g "$RG" --query customerId -o tsv)"
CURRENT_LOG_DESTINATION="$(az containerapp env show -n "$NEW_ENV" -g "$RG" \
  --query properties.appLogsConfiguration.destination -o tsv)"
CURRENT_LOG_WORKSPACE_ID="$(az containerapp env show -n "$NEW_ENV" -g "$RG" \
  --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId -o tsv)"
if [[ "$CURRENT_LOG_DESTINATION" != "log-analytics" || "$CURRENT_LOG_WORKSPACE_ID" != "$LOG_WORKSPACE_ID" ]]; then
  LOG_WORKSPACE_KEY="$(az monitor log-analytics workspace get-shared-keys -n "$LOG_WORKSPACE" -g "$RG" \
    --query primarySharedKey -o tsv)"
  az containerapp env update -n "$NEW_ENV" -g "$RG" \
    --logs-destination log-analytics \
    --logs-workspace-id "$LOG_WORKSPACE_ID" \
    --logs-workspace-key "$LOG_WORKSPACE_KEY" -o none
  unset LOG_WORKSPACE_KEY
  echo "  ✓ Container Apps console/system logs retained in $LOG_WORKSPACE"
else
  echo "  • Container Apps Log Analytics destination already configured"
fi

REGISTRY_IDENTITY="$(az containerapp show -n "$NEW_APP" -g "$RG" \
  --query "properties.configuration.registries[?server=='$ACR.azurecr.io'] | [0].identity" -o tsv)"
if [[ "$REGISTRY_IDENTITY" != "system" ]]; then
  az containerapp registry set -n "$NEW_APP" -g "$RG" \
    --server "$ACR.azurecr.io" --identity system -o none
else
  echo "  • Managed-identity ACR pull already configured"
fi

SPEECH_ID="$(az cognitiveservices account show -n "$SPEECH_ACCOUNT" -g "$SPEECH_RG" --query id -o tsv)"
az role assignment create --assignee-object-id "$PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Cognitive Services Speech User" --scope "$SPEECH_ID" -o none 2>/dev/null \
  && echo "  ✓ Speech User on $SPEECH_ACCOUNT" || echo "  • Speech role already present"

COSMOS_ID="$(az cosmosdb show -n "$COSMOS_ACCOUNT" -g "$COSMOS_RG" --query id -o tsv)"
COSMOS_ROLE_DEFINITION_ID="$COSMOS_ID/sqlRoleDefinitions/$COSMOS_DATA_CONTRIBUTOR"
EXISTING_COSMOS_ROLE="$(az cosmosdb sql role assignment list -a "$COSMOS_ACCOUNT" -g "$COSMOS_RG" \
  --query "[?principalId=='$PRINCIPAL' && roleDefinitionId=='$COSMOS_ROLE_DEFINITION_ID' && scope=='$COSMOS_ID'] | [0].id" \
  -o tsv)"
if [[ -n "$EXISTING_COSMOS_ROLE" ]]; then
  echo "  • Cosmos Data Contributor already present on $COSMOS_ACCOUNT"
else
  az cosmosdb sql role assignment create -a "$COSMOS_ACCOUNT" -g "$COSMOS_RG" \
    --role-definition-id "$COSMOS_DATA_CONTRIBUTOR" \
    --principal-id "$PRINCIPAL" --scope "$COSMOS_ID" -o none
  echo "  ✓ Cosmos Data Contributor on $COSMOS_ACCOUNT"
fi

PREVIOUS_REVISION="$(az containerapp show -n "$NEW_APP" -g "$RG" --query properties.latestReadyRevisionName -o tsv)"
[[ -n "$PREVIOUS_REVISION" ]] || { echo "❌ No healthy revision is available for rollback." >&2; exit 1; }

az containerapp revision set-mode -n "$NEW_APP" -g "$RG" --mode multiple -o none
az containerapp ingress traffic set -n "$NEW_APP" -g "$RG" \
  --revision-weight "$PREVIOUS_REVISION=100" -o none

# ── Create and verify candidate revision before moving production traffic ───
CANDIDATE_FILE="$(mktemp)"
trap 'rm -f "$CANDIDATE_FILE"' EXIT
az containerapp revision show -n "$NEW_APP" -g "$RG" --revision "$PREVIOUS_REVISION" \
  --query properties.template -o json \
  | node "$SOURCE_DIR/scripts/production/render-webapp-revision.mjs" \
      "$ACR_IMAGE" "$REV_SUFFIX" "$APP_VERSION" "https://$FQDN" "$OPENAI_AUTH" \
  > "$CANDIDATE_FILE"

echo "🚀 Creating candidate revision $REV_SUFFIX with production traffic pinned to $PREVIOUS_REVISION ..."
CANDIDATE_REVISION="$NEW_APP--$REV_SUFFIX"
if az containerapp revision show -n "$NEW_APP" -g "$RG" --revision "$CANDIDATE_REVISION" -o none 2>/dev/null; then
  echo "✓ Reusing existing candidate revision $CANDIDATE_REVISION"
else
  CANDIDATE_REVISION="$(az containerapp update -n "$NEW_APP" -g "$RG" \
    --yaml "$CANDIDATE_FILE" --query properties.latestRevisionName -o tsv)"
fi
[[ -n "$CANDIDATE_REVISION" && "$CANDIDATE_REVISION" != "$PREVIOUS_REVISION" ]] \
  || { echo "❌ Candidate revision was not created." >&2; exit 1; }

CANDIDATE_FQDN="$(az containerapp revision show -n "$NEW_APP" -g "$RG" \
  --revision "$CANDIDATE_REVISION" --query properties.fqdn -o tsv)"
[[ -n "$CANDIDATE_FQDN" ]] || { echo "❌ Candidate revision has no FQDN; traffic remains on $PREVIOUS_REVISION." >&2; exit 1; }

curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-all-errors \
  "https://$CANDIDATE_FQDN/api/ready" -o /dev/null
CANDIDATE_HEALTH="$(az containerapp revision show -n "$NEW_APP" -g "$RG" \
  --revision "$CANDIDATE_REVISION" --query properties.healthState -o tsv)"
[[ "$CANDIDATE_HEALTH" == "Healthy" ]] \
  || { echo "❌ Candidate revision is $CANDIDATE_HEALTH; traffic remains on $PREVIOUS_REVISION." >&2; exit 1; }
CANDIDATE_VERSION="$(curl --fail --silent --show-error --retry 3 --retry-all-errors \
  "https://$CANDIDATE_FQDN/version.json" \
  | node -e "let body='';process.stdin.on('data',chunk=>body+=chunk).on('end',()=>process.stdout.write(JSON.parse(body).version))")"
[[ "$CANDIDATE_VERSION" == "$APP_VERSION" ]] \
  || { echo "❌ Candidate reports v$CANDIDATE_VERSION; expected v$APP_VERSION." >&2; exit 1; }

echo "🔀 Candidate is healthy; moving production traffic to $CANDIDATE_REVISION ..."
az containerapp ingress traffic set -n "$NEW_APP" -g "$RG" \
  --revision-weight "$PREVIOUS_REVISION=0" "$CANDIDATE_REVISION=100" -o none

if ! curl --fail --silent --show-error --retry 6 --retry-delay 5 --retry-all-errors \
  "https://$FQDN/api/ready" -o /dev/null; then
  echo "❌ Production smoke test failed; rolling traffic back to $PREVIOUS_REVISION." >&2
  az containerapp ingress traffic set -n "$NEW_APP" -g "$RG" \
    --revision-weight "$PREVIOUS_REVISION=100" "$CANDIDATE_REVISION=0" -o none
  exit 1
fi
LIVE_VERSION="$(curl --fail --silent --show-error --retry 3 --retry-all-errors \
  "https://$FQDN/version.json" \
  | node -e "let body='';process.stdin.on('data',chunk=>body+=chunk).on('end',()=>process.stdout.write(JSON.parse(body).version))")"
if [[ "$LIVE_VERSION" != "$APP_VERSION" ]]; then
  echo "❌ Production reports v$LIVE_VERSION; rolling traffic back to $PREVIOUS_REVISION." >&2
  az containerapp ingress traffic set -n "$NEW_APP" -g "$RG" \
    --revision-weight "$PREVIOUS_REVISION=100" "$CANDIDATE_REVISION=0" -o none
  exit 1
fi

echo ""
echo "✅ Web app deployed:"
echo "   https://$FQDN"
echo "   Version: v$APP_VERSION ($GIT_SHA)"
echo "   Active revision: $CANDIDATE_REVISION"
echo "   Rollback revision: $PREVIOUS_REVISION"
echo "   Rollback command: az containerapp ingress traffic set -n $NEW_APP -g $RG --revision-weight $PREVIOUS_REVISION=100 $CANDIDATE_REVISION=0"
echo ""
echo "Next: verify a feedback WRITE lands in Cosmos over the PE, read it back via"
echo "  curl -H \"Authorization: Bearer \$FEEDBACK_ADMIN_TOKEN\" https://$FQDN/api/feedback/list"
echo "Then run cutover (repoint aka.ms/diagram-builder + delete old app)."
