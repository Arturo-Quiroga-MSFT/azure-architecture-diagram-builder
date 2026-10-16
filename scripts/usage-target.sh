#!/usr/bin/env bash
#
# usage-target.sh — resolve where the usage/cost reports read telemetry from.
# ============================================================================
# Sourced by usage-report-range.sh (and read by usage_target.py for the Python
# reports). Uses the same deployment targets as scripts/production/, so report
# and deploy scripts never disagree about resource names.
#
#   AADB_TARGET          target file under production/targets/ (default: fdpo)
#   AADB_APPINSIGHTS     override the browser-telemetry App Insights name
#   AADB_APPINSIGHTS_RG  override its resource group
#   AADB_SUBSCRIPTION    override the subscription
#   AADB_ACA_ENV         override the Container Apps environment (MCP logs)
#
# Exposes: AADB_TARGET APP AI_RG SUBSCRIPTION RG ACA_ENV (and AZURE_CONFIG_DIR
# when the target pins a CLI profile).
# ============================================================================

AADB_TARGET="${AADB_TARGET:-fdpo}"
_USAGE_TARGET_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/production/targets/${AADB_TARGET}.env"
if [[ ! -f "$_USAGE_TARGET_FILE" ]]; then
  echo "❌ Unknown AADB_TARGET '$AADB_TARGET' (no $_USAGE_TARGET_FILE)" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$_USAGE_TARGET_FILE"

APP="${AADB_APPINSIGHTS:-${USAGE_APP_INSIGHTS:-${WEB_APP_INSIGHTS:-}}}"
AI_RG="${AADB_APPINSIGHTS_RG:-${USAGE_APP_INSIGHTS_RG:-$RG}}"
SUBSCRIPTION="${AADB_SUBSCRIPTION:-${EXPECTED_SUBSCRIPTION_ID:-}}"
ACA_ENV="${AADB_ACA_ENV:-${NEW_ENV:-}}"
if [[ -z "$APP" || -z "$SUBSCRIPTION" ]]; then
  echo "❌ Target '$AADB_TARGET' has no browser App Insights or subscription; set AADB_APPINSIGHTS / AADB_SUBSCRIPTION." >&2
  exit 1
fi
if [[ -n "${AZURE_CONFIG_DIR:-}" ]]; then export AZURE_CONFIG_DIR; fi
