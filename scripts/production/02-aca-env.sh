#!/usr/bin/env bash
#
# 02-aca-env.sh — Create the VNet-integrated ACA environment for the web app.
# ============================================================================
# ACA environment VNet integration is set at creation (immutable), so the
# migration requires a NEW environment bound to the delegated infra subnet from
# 01-network.sh. Ingress stays EXTERNAL (public) — only egress to Cosmos flows
# privately via the VNet + private DNS.
#
# NON-DISRUPTIVE: creates a new empty environment; the old env/apps keep running.
# This step can take 5–15 minutes (VNet environments provision slowly).
#
# Usage:  [AADB_TARGET=fdpo] ./scripts/production/02-aca-env.sh
# ============================================================================
set -euo pipefail

source "$(dirname "$0")/target.sh"

if az containerapp env show -n "$NEW_ENV" -g "$RG" -o none 2>/dev/null; then
  echo "✓ Environment $NEW_ENV already exists"
else
  SUBNET_ID="$(az network vnet subnet show -g "$RG" --vnet-name "$VNET" -n "$ACA_SUBNET" --query id -o tsv)"
  echo "🏗️  Creating VNet-integrated environment $NEW_ENV on $ACA_SUBNET ..."
  echo "    (external ingress preserved; this can take several minutes)"
  LOG_WORKSPACE_CUSTOMER_ID="$(az monitor log-analytics workspace show -g "$RG" -n "$LOG_WORKSPACE" --query customerId -o tsv)"
  LOG_WORKSPACE_KEY="$(az monitor log-analytics workspace get-shared-keys -g "$RG" -n "$LOG_WORKSPACE" --query primarySharedKey -o tsv)"
  # VNet environments with public ingress need this network feature; without it
  # provisioning fails with SubscriptionNotRegisteredForFeature.
  az feature register --namespace Microsoft.Network -n AllowBringYourOwnPublicIpAddress -o none
  az provider register -n Microsoft.Network --wait
  az containerapp env create -n "$NEW_ENV" -g "$RG" -l "$LOC" \
    --infrastructure-subnet-resource-id "$SUBNET_ID" \
    --internal-only false \
    --logs-destination log-analytics \
    --logs-workspace-id "$LOG_WORKSPACE_CUSTOMER_ID" \
    --logs-workspace-key "$LOG_WORKSPACE_KEY" \
    -o none
  unset LOG_WORKSPACE_KEY
fi

echo ""
echo "✅ Environment ready."
az containerapp env show -n "$NEW_ENV" -g "$RG" \
  --query "{name:name, provisioningState:properties.provisioningState, staticIp:properties.staticIp, defaultDomain:properties.defaultDomain, vnet:properties.vnetConfiguration.infrastructureSubnetId, internal:properties.vnetConfiguration.internal}" \
  -o json
