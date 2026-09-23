#!/usr/bin/env bash
# deploy-workbook.sh — Deploy the Azure Diagram Builder usage analytics workbook
#
# Usage: ./scripts/deploy-workbook.sh [WORKBOOK_ID]
#
# By default this UPDATES the existing "Usage Analytics" workbook in place
# (stable ID below) so repeated deploys don't create duplicates. To create a
# brand-new workbook instead, pass NEW as the argument (or a specific UUID):
#   ./scripts/deploy-workbook.sh NEW           # generate a fresh workbook
#   ./scripts/deploy-workbook.sh <uuid>        # target a specific workbook
# The ID can also be overridden via the WORKBOOK_ID env var.
set -euo pipefail

RG="AQ-FOUNDRY-RG"
APP_INSIGHTS="aq-app-insights-001"
WORKBOOK_DISPLAY_NAME="Azure Diagram Builder — Usage Analytics"
# Stable ID of the live workbook — update-in-place by default (avoids duplicates).
DEFAULT_WORKBOOK_ID="c6480daa-a23d-4aa0-a6c5-800b82f1149b"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTENT_FILE="$SCRIPT_DIR/workbook-content.json"

echo "🔍 Resolving subscription and App Insights resource..."
SUBSCRIPTION=$(az account show --query id -o tsv)
SOURCE_ID="/subscriptions/$SUBSCRIPTION/resourceGroups/$RG/providers/microsoft.insights/components/$APP_INSIGHTS"
LOCATION=$(az monitor app-insights component show --app "$APP_INSIGHTS" -g "$RG" --query location -o tsv)

# Resolve target workbook ID: CLI arg > env var > stable default.
# Pass "NEW" (case-insensitive) to mint a fresh workbook.
WORKBOOK_ID="${1:-${WORKBOOK_ID:-$DEFAULT_WORKBOOK_ID}}"
if [[ "$(printf '%s' "$WORKBOOK_ID" | tr '[:upper:]' '[:lower:]')" == "new" ]]; then
  WORKBOOK_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  echo "   Mode         : creating NEW workbook"
else
  WORKBOOK_ID=$(printf '%s' "$WORKBOOK_ID" | tr '[:upper:]' '[:lower:]')
  echo "   Mode         : update-in-place"
fi

echo "   Subscription : $SUBSCRIPTION"
echo "   Source       : $SOURCE_ID"
echo "   Location     : $LOCATION"
echo "   Workbook ID  : $WORKBOOK_ID"

echo "📦 Packaging workbook content..."
# Minify and stringify the workbook JSON for the serializedData property
SERIALIZED=$(jq -c '.' "$CONTENT_FILE" | jq -Rs '.')

# Build the PUT request body
cat > /tmp/workbook-body.json <<EOF
{
  "location": "$LOCATION",
  "kind": "shared",
  "properties": {
    "displayName": "$WORKBOOK_DISPLAY_NAME",
    "serializedData": $SERIALIZED,
    "version": "Notebook/1.0",
    "sourceId": "$SOURCE_ID",
    "category": "workbook"
  }
}
EOF

echo "🚀 Deploying workbook..."
az rest --method PUT \
  --url "https://management.azure.com/subscriptions/$SUBSCRIPTION/resourceGroups/$RG/providers/microsoft.insights/workbooks/$WORKBOOK_ID?api-version=2022-04-01" \
  --body @/tmp/workbook-body.json \
  --output table

echo ""
echo "✅ Workbook deployed successfully!"
echo "   Name     : $WORKBOOK_DISPLAY_NAME"
echo "   Portal   : https://portal.azure.com/#@/resource/subscriptions/$SUBSCRIPTION/resourceGroups/$RG/providers/microsoft.insights/workbooks/$WORKBOOK_ID/workbook"
echo ""
echo "   Or open App Insights → Workbooks to find it."

rm -f /tmp/workbook-body.json
