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
# Usage:  ./scripts/vnet-migration/02-aca-env.sh
# ============================================================================
set -euo pipefail

RG="azure-diagrams-rg"
LOC="eastus2"
VNET="vnet-azure-diagrams"
ACA_SUBNET="snet-aca-infra"
NEW_ENV="aca-env-azure-diagrams-vnet"

echo "Subscription: $(az account show --query name -o tsv)"

if az containerapp env show -n "$NEW_ENV" -g "$RG" -o none 2>/dev/null; then
  echo "✓ Environment $NEW_ENV already exists"
else
  SUBNET_ID="$(az network vnet subnet show -g "$RG" --vnet-name "$VNET" -n "$ACA_SUBNET" --query id -o tsv)"
  echo "🏗️  Creating VNet-integrated environment $NEW_ENV on $ACA_SUBNET ..."
  echo "    (external ingress preserved; this can take several minutes)"
  az containerapp env create -n "$NEW_ENV" -g "$RG" -l "$LOC" \
    --infrastructure-subnet-resource-id "$SUBNET_ID" \
    --logs-destination none \
    -o none
fi

echo ""
echo "✅ Environment ready."
az containerapp env show -n "$NEW_ENV" -g "$RG" \
  --query "{name:name, provisioningState:properties.provisioningState, staticIp:properties.staticIp, defaultDomain:properties.defaultDomain, vnet:properties.vnetConfiguration.infrastructureSubnetId, internal:properties.vnetConfiguration.internal}" \
  -o json
