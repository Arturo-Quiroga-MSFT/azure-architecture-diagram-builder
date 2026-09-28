#!/usr/bin/env bash
#
# 00-foundation.sh — shared platform resources for a new AADB target.
# ============================================================================
# Creates everything the web app depends on except networking and the ACA
# environment (01-network.sh, 02-aca-env.sh):
#   - resource group, Log Analytics workspace, browser + server App Insights
#   - Azure Container Registry (admin user disabled; apps pull with managed identity)
#   - Microsoft Foundry (AIServices) account with local auth disabled, plus the
#     model deployments listed in the target's MODEL_DEPLOYMENTS
#   - Speech account (Entra-only) for the avatar presenter
#   - Cosmos DB serverless account (Entra-only, public network access disabled,
#     continuous backup) with the diagrams + feedback containers
#
# Idempotent: every create is guarded by an existence check, so re-runs only
# fill gaps. Model deployment failures are reported but do not stop the run.
#
# Usage:  AADB_TARGET=fdpo ./scripts/production/00-foundation.sh
# ============================================================================
set -euo pipefail

source "$(dirname "$0")/target.sh"
[[ -n "${FOUNDRY_ACCOUNT:-}" ]] || { echo "❌ Target '$AADB_TARGET' does not define FOUNDRY_ACCOUNT; nothing to provision." >&2; exit 1; }

set_local_auth_disabled() {
  local id="$1"
  if [[ "$(az resource show --ids "$id" --query properties.disableLocalAuth -o tsv)" != "true" ]]; then
    az resource update --ids "$id" --set properties.disableLocalAuth=true -o none
    echo "  ✓ Local (key) auth disabled"
  fi
}

# ── Resource group + observability ──────────────────────────────────────
az group create -n "$RG" -l "$LOC" -o none
echo "✓ Resource group $RG"

if ! az monitor log-analytics workspace show -g "$RG" -n "$LOG_WORKSPACE" -o none 2>/dev/null; then
  az monitor log-analytics workspace create -g "$RG" -n "$LOG_WORKSPACE" -l "$LOC" --retention-time 90 -o none
fi
WORKSPACE_ID="$(az monitor log-analytics workspace show -g "$RG" -n "$LOG_WORKSPACE" --query id -o tsv)"
echo "✓ Log Analytics $LOG_WORKSPACE (90-day retention)"

for component in "$SERVER_APP_INSIGHTS" "$WEB_APP_INSIGHTS"; do
  if ! az monitor app-insights component show -g "$RG" --app "$component" -o none 2>/dev/null; then
    az monitor app-insights component create -g "$RG" --app "$component" -l "$LOC" \
      --kind web --application-type web --workspace "$WORKSPACE_ID" -o none
  fi
  echo "✓ Application Insights $component"
done

# ── Container registry ──────────────────────────────────────────────────
if ! az acr show -n "$ACR" -o none 2>/dev/null; then
  az acr create -n "$ACR" -g "$RG" -l "$LOC" --sku Standard --admin-enabled false -o none
fi
echo "✓ Container registry $ACR"

# ── Foundry account + model deployments ─────────────────────────────────
if ! az cognitiveservices account show -g "$FOUNDRY_RG" -n "$FOUNDRY_ACCOUNT" -o none 2>/dev/null; then
  az cognitiveservices account create -g "$FOUNDRY_RG" -n "$FOUNDRY_ACCOUNT" -l "$LOC" \
    --kind AIServices --sku S0 --custom-domain "$FOUNDRY_ACCOUNT" --yes -o none
fi
FOUNDRY_ID="$(az cognitiveservices account show -g "$FOUNDRY_RG" -n "$FOUNDRY_ACCOUNT" --query id -o tsv)"
echo "✓ Foundry account $FOUNDRY_ACCOUNT"
set_local_auth_disabled "$FOUNDRY_ID"

EXISTING_DEPLOYMENTS="$(az cognitiveservices account deployment list -g "$FOUNDRY_RG" -n "$FOUNDRY_ACCOUNT" --query "[].name" -o tsv)"
FAILED_DEPLOYMENTS=()
for spec in "${MODEL_DEPLOYMENTS[@]}"; do
  IFS='|' read -r dep model version format sku capacity <<< "$spec"
  if grep -qxF "$dep" <<< "$EXISTING_DEPLOYMENTS"; then
    echo "  • $dep already deployed"
    continue
  fi
  if [[ "$format" == "Anthropic" ]]; then
    # Anthropic deployments require modelProviderData, which the az CLI does not
    # expose yet, so create them through ARM directly.
    body="$(printf '{"sku":{"name":"%s","capacity":%s},"properties":{"model":{"format":"%s","name":"%s","version":"%s"},"modelProviderData":{"organizationName":"%s","industry":"%s","countryCode":"%s"}}}' \
      "$sku" "$capacity" "$format" "$model" "$version" \
      "${ANTHROPIC_ORG_NAME:-Microsoft}" "${ANTHROPIC_INDUSTRY:-technology}" "${ANTHROPIC_COUNTRY_CODE:-US}")"
    deploy_cmd=(az rest --method put -o none
      --url "https://management.azure.com${FOUNDRY_ID}/deployments/${dep}?api-version=2025-10-01-preview"
      --body "$body")
  else
    deploy_cmd=(az cognitiveservices account deployment create -g "$FOUNDRY_RG" -n "$FOUNDRY_ACCOUNT"
      --deployment-name "$dep" --model-name "$model" --model-version "$version"
      --model-format "$format" --sku-name "$sku" --sku-capacity "$capacity" -o none)
  fi
  if "${deploy_cmd[@]}"; then
    echo "  ✓ $dep ($format $model $version, $sku ${capacity}K TPM)"
  else
    echo "  ❌ $dep failed" >&2
    FAILED_DEPLOYMENTS+=("$dep")
  fi
done

# ── Speech (avatar presenter) ───────────────────────────────────────────
if ! az cognitiveservices account show -g "$SPEECH_RG" -n "$SPEECH_ACCOUNT" -o none 2>/dev/null; then
  az cognitiveservices account create -g "$SPEECH_RG" -n "$SPEECH_ACCOUNT" -l "$SPEECH_REGION" \
    --kind SpeechServices --sku S0 --custom-domain "$SPEECH_ACCOUNT" --yes -o none
fi
echo "✓ Speech account $SPEECH_ACCOUNT ($SPEECH_REGION)"
set_local_auth_disabled "$(az cognitiveservices account show -g "$SPEECH_RG" -n "$SPEECH_ACCOUNT" --query id -o tsv)"

# ── Cosmos DB (serverless, private) ─────────────────────────────────────
if ! az cosmosdb show -g "$COSMOS_RG" -n "$COSMOS_ACCOUNT" -o none 2>/dev/null; then
  echo "🗄️  Creating Cosmos DB $COSMOS_ACCOUNT (several minutes)..."
  az cosmosdb create -g "$COSMOS_RG" -n "$COSMOS_ACCOUNT" \
    --locations regionName="$COSMOS_LOC" failoverPriority=0 isZoneRedundant=False \
    --capabilities EnableServerless \
    --backup-policy-type Continuous --continuous-tier Continuous7Days \
    --public-network-access DISABLED \
    --minimal-tls-version Tls12 -o none
fi
echo "✓ Cosmos DB $COSMOS_ACCOUNT"
set_local_auth_disabled "$(az cosmosdb show -g "$COSMOS_RG" -n "$COSMOS_ACCOUNT" --query id -o tsv)"

if ! az cosmosdb sql database show -g "$COSMOS_RG" -a "$COSMOS_ACCOUNT" -n "$COSMOS_DATABASE_ID" -o none 2>/dev/null; then
  az cosmosdb sql database create -g "$COSMOS_RG" -a "$COSMOS_ACCOUNT" -n "$COSMOS_DATABASE_ID" -o none
fi
for container in "$COSMOS_CONTAINER_ID" "$COSMOS_FEEDBACK_CONTAINER_ID"; do
  if ! az cosmosdb sql container show -g "$COSMOS_RG" -a "$COSMOS_ACCOUNT" -d "$COSMOS_DATABASE_ID" -n "$container" -o none 2>/dev/null; then
    az cosmosdb sql container create -g "$COSMOS_RG" -a "$COSMOS_ACCOUNT" -d "$COSMOS_DATABASE_ID" \
      -n "$container" --partition-key-path /id -o none
  fi
  echo "  ✓ $COSMOS_DATABASE_ID/$container"
done

echo ""
echo "✅ Foundation ready for target $AADB_TARGET."
echo "   Foundry endpoint : $OPENAI_ENDPOINT"
if (( ${#FAILED_DEPLOYMENTS[@]} > 0 )); then
  echo "⚠️  Model deployments that failed (re-run to retry): ${FAILED_DEPLOYMENTS[*]}" >&2
  exit 2
fi
echo "Next: AADB_TARGET=$AADB_TARGET ./scripts/production/01-network.sh"
