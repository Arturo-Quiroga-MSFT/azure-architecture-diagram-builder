#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: ./scripts/deploy-server-workbook.sh"
  echo "Deploys or updates AADB — Server Usage & Guardrails in azure-diagrams-rg."
  exit 0
fi

SUBSCRIPTION="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
TENANT="a172a259-b1c7-4944-b2e1-6d551f954711"
RG="azure-diagrams-rg"
LOCATION="eastus2"
WORKSPACE="workspace-azurediagramsrgbuvF"
APP_INSIGHTS="aadb-usage-analytics-insights"
WORKBOOK_ID="${WORKBOOK_ID:-2e389b56-22db-43a1-87ba-d5e206bd8102}"
DISPLAY_NAME="AADB — Server Usage & Guardrails"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTENT_FILE="$SCRIPT_DIR/server-workbook-content.json"

EXPECTED_SUBSCRIPTION="7a28b21e-0d3e-4435-a686-d92889d4ee96"
[[ "$SUBSCRIPTION" == "$EXPECTED_SUBSCRIPTION" ]] \
  || { echo "ERROR: expected subscription $EXPECTED_SUBSCRIPTION, got $SUBSCRIPTION" >&2; exit 1; }
CURRENT_TENANT="$(az account show --query tenantId -o tsv)"
[[ "$CURRENT_TENANT" == "$TENANT" ]] \
  || { echo "ERROR: expected tenant $TENANT, got $CURRENT_TENANT" >&2; exit 1; }

jq -e '.version == "Notebook/1.0" and (.items | length > 0)' "$CONTENT_FILE" >/dev/null
node "$SCRIPT_DIR/validate-server-workbook.mjs"

WORKSPACE_ID="$(az monitor log-analytics workspace show -n "$WORKSPACE" -g "$RG" --query id -o tsv)"
APP_INSIGHTS_ID="$(az monitor app-insights component show --app "$APP_INSIGHTS" -g "$RG" --query id -o tsv)"
[[ -n "$WORKSPACE_ID" && -n "$APP_INSIGHTS_ID" ]] \
  || { echo "ERROR: required telemetry resources are unavailable" >&2; exit 1; }

SERIALIZED="$(jq -c '.' "$CONTENT_FILE" | jq -Rs '.')"
BODY_FILE="$(mktemp)"
VERIFY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE" "$VERIFY_FILE"' EXIT

cat > "$BODY_FILE" <<EOF
{
  "location": "$LOCATION",
  "kind": "shared",
  "tags": {
    "application": "AADB",
    "telemetry": "server-authoritative",
    "managed-by": "scripts/deploy-server-workbook.sh"
  },
  "properties": {
    "displayName": "$DISPLAY_NAME",
    "serializedData": $SERIALIZED,
    "version": "Notebook/1.0",
    "sourceId": "$WORKSPACE_ID",
    "category": "workbook"
  }
}
EOF

RESOURCE_URL="https://management.azure.com/subscriptions/$SUBSCRIPTION/resourceGroups/$RG/providers/microsoft.insights/workbooks/$WORKBOOK_ID?api-version=2023-06-01"
az rest --method PUT --url "$RESOURCE_URL" --body "@$BODY_FILE" --output none

DEPLOYED_NAME="$(az rest --method GET --url "$RESOURCE_URL" --query properties.displayName -o tsv)"
DEPLOYED_SOURCE="$(az rest --method GET --url "$RESOURCE_URL" --query properties.sourceId -o tsv)"
DEPLOYED_SOURCE_LOWER="$(printf '%s' "$DEPLOYED_SOURCE" | tr '[:upper:]' '[:lower:]')"
WORKSPACE_ID_LOWER="$(printf '%s' "$WORKSPACE_ID" | tr '[:upper:]' '[:lower:]')"
[[ "$DEPLOYED_NAME" == "$DISPLAY_NAME" && "$DEPLOYED_SOURCE_LOWER" == "$WORKSPACE_ID_LOWER" ]] \
  || { echo "ERROR: deployed workbook verification failed" >&2; exit 1; }

az rest --method GET --url "${RESOURCE_URL}&canFetchContent=true" -o json \
  | jq -r '.properties.serializedData' > "$VERIFY_FILE"
EXPECTED_QUERY_COUNT="$(jq '[.items[] | select(.content.query)] | length' "$CONTENT_FILE")"
DEPLOYED_QUERY_COUNT="$(jq '[.items[] | select(.content.query)] | length' "$VERIFY_FILE")"
DEPLOYED_VERSION="$(jq -r '.version' "$VERIFY_FILE")"
[[ "$DEPLOYED_QUERY_COUNT" == "$EXPECTED_QUERY_COUNT" && "$DEPLOYED_VERSION" == "Notebook/1.0" ]] \
  || { echo "ERROR: deployed workbook content verification failed" >&2; exit 1; }

echo "Workbook deployed: $DEPLOYED_NAME"
echo "Source workspace: $WORKSPACE"
echo "Dedicated App Insights: $APP_INSIGHTS"
echo "Validated KQL panels: $DEPLOYED_QUERY_COUNT"
echo "Portal: https://portal.azure.com/#@${TENANT}/resource/subscriptions/${SUBSCRIPTION}/resourceGroups/${RG}/providers/microsoft.insights/workbooks/${WORKBOOK_ID}/workbook"