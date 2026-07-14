#!/usr/bin/env bash
#
# 01-network.sh — VNet + Cosmos private endpoint for the AADB web app migration.
# ============================================================================
# Public network access on Cosmos (aqcosmosdb007) is policy-locked to Disabled
# (MCAPS), so the ONLY compliant way for the Container App to reach Cosmos is a
# PRIVATE ENDPOINT. This script builds the network foundation:
#   1. A VNet with an ACA infrastructure subnet + a private-endpoint subnet.
#   2. A private endpoint to Cosmos (group-id: Sql).
#   3. A private DNS zone (privatelink.documents.azure.com) linked to the VNet,
#      with the PE's A-record auto-registered via a dns-zone-group.
#
# NON-DISRUPTIVE: creates only new resources; does not touch the running apps.
# Idempotent: safe to re-run (each create is guarded by an existence check).
#
# Usage:  ./scripts/vnet-migration/01-network.sh
# ============================================================================
set -euo pipefail

RG="azure-diagrams-rg"
LOC="eastus2"
VNET="vnet-azure-diagrams"
ACA_SUBNET="snet-aca-infra"          # delegated to Microsoft.App/environments
PE_SUBNET="snet-private-endpoints"
COSMOS="aqcosmosdb007"
PE_NAME="pe-cosmos-aqcosmosdb007"
PE_CONN="pe-conn-cosmos"
DNS_ZONE="privatelink.documents.azure.com"

# Address plan (VNet 10.60.0.0/22):
#   ACA infra subnet 10.60.0.0/23  (satisfies Consumption /23 and WP /27)
#   PE subnet        10.60.2.0/27
VNET_CIDR="10.60.0.0/22"
ACA_CIDR="10.60.0.0/23"
PE_CIDR="10.60.2.0/27"

echo "Subscription: $(az account show --query name -o tsv)"
exists() { az resource show --ids "$1" -o none 2>/dev/null; }

# ── 1. VNet + ACA infrastructure subnet (delegated) ─────────────────────
if az network vnet show -g "$RG" -n "$VNET" -o none 2>/dev/null; then
  echo "✓ VNet $VNET already exists"
else
  echo "🌐 Creating VNet $VNET ($VNET_CIDR) with ACA subnet $ACA_SUBNET ($ACA_CIDR)..."
  az network vnet create -g "$RG" -n "$VNET" -l "$LOC" \
    --address-prefixes "$VNET_CIDR" \
    --subnet-name "$ACA_SUBNET" --subnet-prefixes "$ACA_CIDR" -o none
fi

echo "🔗 Delegating $ACA_SUBNET to Microsoft.App/environments..."
az network vnet subnet update -g "$RG" --vnet-name "$VNET" -n "$ACA_SUBNET" \
  --delegations Microsoft.App/environments -o none

# ── 2. Private-endpoint subnet ──────────────────────────────────────────
if az network vnet subnet show -g "$RG" --vnet-name "$VNET" -n "$PE_SUBNET" -o none 2>/dev/null; then
  echo "✓ PE subnet $PE_SUBNET already exists"
else
  echo "🌐 Creating PE subnet $PE_SUBNET ($PE_CIDR)..."
  az network vnet subnet create -g "$RG" --vnet-name "$VNET" -n "$PE_SUBNET" \
    --address-prefixes "$PE_CIDR" -o none
fi
# Private endpoints require network policies disabled on their subnet.
az network vnet subnet update -g "$RG" --vnet-name "$VNET" -n "$PE_SUBNET" \
  --private-endpoint-network-policies Disabled -o none

# ── 3. Cosmos private endpoint (group-id: Sql) ──────────────────────────
COSMOS_ID="$(az cosmosdb show -n "$COSMOS" -g "$RG" --query id -o tsv)"
if az network private-endpoint show -g "$RG" -n "$PE_NAME" -o none 2>/dev/null; then
  echo "✓ Private endpoint $PE_NAME already exists"
else
  echo "🔒 Creating private endpoint $PE_NAME → $COSMOS (Sql)..."
  az network private-endpoint create -g "$RG" -n "$PE_NAME" -l "$LOC" \
    --vnet-name "$VNET" --subnet "$PE_SUBNET" \
    --private-connection-resource-id "$COSMOS_ID" \
    --group-id Sql \
    --connection-name "$PE_CONN" -o none
fi

# ── 4. Private DNS zone + VNet link + zone group ────────────────────────
if az network private-dns zone show -g "$RG" -n "$DNS_ZONE" -o none 2>/dev/null; then
  echo "✓ Private DNS zone $DNS_ZONE already exists"
else
  echo "🧭 Creating private DNS zone $DNS_ZONE..."
  az network private-dns zone create -g "$RG" -n "$DNS_ZONE" -o none
fi

if az network private-dns link vnet show -g "$RG" -n "link-$VNET" --zone-name "$DNS_ZONE" -o none 2>/dev/null; then
  echo "✓ DNS zone link already exists"
else
  echo "🔗 Linking $DNS_ZONE to $VNET..."
  az network private-dns link vnet create -g "$RG" -n "link-$VNET" \
    --zone-name "$DNS_ZONE" --virtual-network "$VNET" --registration-enabled false -o none
fi

echo "🧭 Binding PE to the DNS zone (auto A-record)..."
az network private-endpoint dns-zone-group create -g "$RG" \
  --endpoint-name "$PE_NAME" -n "zg-cosmos" \
  --private-dns-zone "$DNS_ZONE" --zone-name documents -o none 2>/dev/null || \
  echo "  (zone group already present)"

echo ""
echo "✅ Network foundation ready."
echo "   VNet:            $VNET ($VNET_CIDR)"
echo "   ACA subnet:      $ACA_SUBNET ($ACA_CIDR, delegated)"
echo "   PE subnet:       $PE_SUBNET ($PE_CIDR)"
echo "   Cosmos PE:       $PE_NAME (group Sql)"
echo "   Private DNS:     $DNS_ZONE → linked to $VNET"
echo ""
echo "Private IP assigned to the Cosmos PE:"
az network private-endpoint show -g "$RG" -n "$PE_NAME" \
  --query "customDnsConfigs[].ipAddresses" -o tsv 2>/dev/null || true
