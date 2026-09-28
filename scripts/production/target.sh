#!/usr/bin/env bash
#
# target.sh — load the deployment target for the production scripts.
# ============================================================================
# Sourced (not executed) by 00-foundation.sh, 01-network.sh, 02-aca-env.sh and
# deploy-webapp.sh. Select a target with AADB_TARGET (default: mcap094150, the
# original MCAPS environment). Each target file under targets/ defines resource
# names; a target may also pin AZURE_CONFIG_DIR to a dedicated az CLI profile.
#
# Usage:  AADB_TARGET=fdpo ./scripts/production/deploy-webapp.sh
# ============================================================================

AADB_TARGET="${AADB_TARGET:-mcap094150}"
TARGET_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/targets/${AADB_TARGET}.env"
[[ -f "$TARGET_FILE" ]] || { echo "❌ Unknown AADB_TARGET '$AADB_TARGET' (no $TARGET_FILE)" >&2; exit 1; }
# shellcheck source=/dev/null
source "$TARGET_FILE"

ACTIVE_SUBSCRIPTION_ID="$(az account show --query id -o tsv 2>/dev/null || true)"
if [[ "$ACTIVE_SUBSCRIPTION_ID" != "$EXPECTED_SUBSCRIPTION_ID" ]]; then
  echo "❌ Target '$AADB_TARGET' expects subscription $EXPECTED_SUBSCRIPTION_ID but az CLI" >&2
  echo "   ${AZURE_CONFIG_DIR:+(AZURE_CONFIG_DIR=$AZURE_CONFIG_DIR) }is on '${ACTIVE_SUBSCRIPTION_ID:-<not signed in>}'." >&2
  exit 1
fi
echo "🎯 Target: $AADB_TARGET · subscription $(az account show --query name -o tsv) · RG $RG"
