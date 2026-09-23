# Deploy Front Door + Dual App Services + PostgreSQL + Storage + Private Key Vault (Private Link) to Azure

## Overview

This guide deploys a secure web architecture with Azure Front Door routing to two App Services (frontend + API), PostgreSQL Flexible Server, Blob Storage, and a Key Vault protected by Private Endpoint + Private DNS. Observability is enabled via Log Analytics + workspace-based Application Insights and diagnostic settings. New networking resources for Key Vault Private Link (Private Endpoint + Private DNS Zone + VNet link) are deployed into the same resource group as Key Vault (single-RG deployment).

**Estimated Time:** 60-90 minutes

**Estimated Cost:** $334.45/month

## Prerequisites

- Azure subscription
- Azure CLI 2.50+ (recommended latest)
- Bicep CLI (az bicep install)
- Permissions: Owner or Contributor on the subscription/resource group; plus User Access Administrator (or Owner) to create role assignments
- Microsoft Entra ID permissions to create App Registrations (Application Administrator or higher) if you want to automate auth app registrations
- Resource providers registered: Microsoft.Web, Microsoft.Network, Microsoft.KeyVault, Microsoft.Storage, Microsoft.DBforPostgreSQL, Microsoft.Cdn, Microsoft.OperationalInsights, Microsoft.Insights

## Deployment Steps

### Step 1: Set environment variables

Define your naming prefix, environment, location, and resource group. This deployment uses one resource group so the Private Endpoint + Private DNS resources are in the same resource group as Key Vault.

**Commands:**
```bash
export AZ_SUBSCRIPTION_ID="<subscription-id>"
export PREFIX="contoso"
export ENV="dev"  # dev|test|prod
export LOCATION="eastus"
export RG="rg-${PREFIX}-${ENV}-shared"
az account set --subscription "$AZ_SUBSCRIPTION_ID"
```

**Notes:**
- 💡 Use a globally unique PREFIX to avoid naming collisions for Storage and Key Vault.
- 💡 If you must use a separate resource group for apps later, keep Key Vault + Private Endpoint + Private DNS in the Key Vault resource group and link VNets as needed.

### Step 2: Create the resource group

Create the resource group that will contain all resources (including Key Vault + Private Endpoint + Private DNS).

**Commands:**
```bash
az group create -n "$RG" -l "$LOCATION"
```

**Notes:**
- 💡 Single-RG simplifies Private DNS zone governance and ensures new Private Link resources are co-located with Key Vault.

### Step 3: Deploy infrastructure with Bicep

Deploy the full architecture using main.bicep. Parameters control environment, location, and naming prefix.

**Commands:**
```bash
az deployment group create \
  -g "$RG" \
  -n "deploy-${PREFIX}-${ENV}-$(date +%Y%m%d%H%M)" \
  -f main.bicep \
  -p prefix="$PREFIX" environment="$ENV" location="$LOCATION"
```

**Notes:**
- 💡 If the deployment fails due to provider registration, register the provider and rerun: az provider register -n Microsoft.Cdn (and others listed in prerequisites).
- 💡 Front Door origin health checks may take several minutes after app deployment.

### Step 4: Create Microsoft Entra ID app registrations (OIDC/OAuth2)

This architecture references Microsoft Entra ID for user sign-in and token validation. App Registrations are not deployed via Bicep; create them via CLI and then set App Service app settings accordingly.

**Commands:**
```bash
# Frontend (SPA) app registration (example - adjust for your framework)
export SPA_NAME="app-${PREFIX}-${ENV}-spa"
SPA_APP_ID=$(az ad app create --display-name "$SPA_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)

# API app registration (example)
export API_NAME="app-${PREFIX}-${ENV}-api"
API_APP_ID=$(az ad app create --display-name "$API_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)

# Create service principals (needed for some assignments/consent flows)
az ad sp create --id "$SPA_APP_ID"
az ad sp create --id "$API_APP_ID"

echo "SPA_APP_ID=$SPA_APP_ID"
echo "API_APP_ID=$API_APP_ID"
```

**Notes:**
- 💡 Configure redirect URIs for your SPA and API according to your auth library (MSAL, etc.).
- 💡 If you need automated consent and exposed API scopes, add those steps per your identity design.

### Step 5: Configure App Service application settings

Set app settings to use Key Vault, Storage, PostgreSQL, Application Insights, and Entra ID. This template configures managed identity and basic settings; you typically add auth-specific settings after Entra app creation.

**Commands:**
```bash
# Fetch outputs (example using deployment outputs; alternatively, query resources directly)
DEPLOY_NAME=$(az deployment group list -g "$RG" --query "[0].name" -o tsv)
OUT=$(az deployment group show -g "$RG" -n "$DEPLOY_NAME" --query properties.outputs -o json)
echo "$OUT" | jq

# Example: set auth-related env vars after you have SPA_APP_ID/API_APP_ID
FRONTEND_APP_NAME=$(echo "$OUT" | jq -r .frontendAppName.value)
API_APP_NAME=$(echo "$OUT" | jq -r .apiAppName.value)
TENANT_ID=$(az account show --query tenantId -o tsv)

az webapp config appsettings set -g "$RG" -n "$FRONTEND_APP_NAME" --settings \
  "AZURE_TENANT_ID=$TENANT_ID" \
  "AZURE_CLIENT_ID=$SPA_APP_ID" \
  "API_BASE_URL=https://$(echo "$OUT" | jq -r .frontDoorHost.value)/api"

az webapp config appsettings set -g "$RG" -n "$API_APP_NAME" --settings \
  "AZURE_TENANT_ID=$TENANT_ID" \
  "AZURE_CLIENT_ID=$API_APP_ID"
```

**Notes:**
- 💡 The API_BASE_URL assumes Front Door routes /api/* to the API App Service.
- 💡 If your apps use Key Vault references (@Microsoft.KeyVault(...)), ensure the app has managed identity access to Key Vault secrets and that Key Vault is reachable via VNet integration + Private DNS.

## Configuration

### Common environment variables (App Services)

| Setting | Value | Description |
|---------|-------|-------------|
| `KEYVAULT_URI` | https://<kv-name>.vault.azure.net/ | Key Vault URI used by the application to fetch secrets/config at runtime. With Private Link enabled, this hostname resolves to the Private Endpoint IP from inside the VNet. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | <from bicep output> | App Insights connection string for server-side telemetry. |
| `AZURE_TENANT_ID` | <tenant-guid> | Microsoft Entra tenant ID for OIDC/OAuth2. |
| `AZURE_CLIENT_ID` | <app-registration-client-id> | Client ID for the frontend or API app registration. |

### API-specific settings

| Setting | Value | Description |
|---------|-------|-------------|
| `POSTGRES_HOST` | <from bicep output> | PostgreSQL server FQDN. |
| `POSTGRES_DB` | appdb | Database name (create/migrate during app startup or via CI/CD). |
| `POSTGRES_SSLMODE` | require | Recommended SSL setting for Azure Database for PostgreSQL. |
| `STORAGE_ACCOUNT_NAME` | <from bicep output> | Storage account used for blobs (images). |
| `BLOB_CONTAINER_NAME` | images | Blob container name for uploads. |

## Post-Deployment Validation

- [ ] Validate resource creation: az resource list -g <rg> -o table
- [ ] Validate Private Link DNS from a VNet-joined environment (e.g., VM, Container App in VNet, or App Service using VNet integration): nslookup <kv-name>.vault.azure.net should return a private IP from the private-endpoints subnet
- [ ] Validate Key Vault access from API App Service using managed identity (e.g., test secret retrieval using your app code or a Kudu console call to Azure IMDS + Key Vault)
- [ ] Validate Front Door endpoint: browse https://<frontdoor-host>/ and https://<frontdoor-host>/api/health (if implemented)
- [ ] Validate telemetry: query Log Analytics workspace (AppRequests, AppTraces) and confirm diagnostic logs arriving for Front Door/App Service/Key Vault
- [ ] Enable alerts/dashboards as needed (this template enables diagnostic streaming; add alert rules in monitor module if desired)

## Troubleshooting

**Issue:** Key Vault private endpoint created but apps cannot reach Key Vault (timeouts or 403/404).

**Solution:** Confirm App Service VNet Integration is enabled and the app is integrated with the same VNet that is linked to the Private DNS zone. Verify Private DNS zone name is privatelink.vaultcore.azure.net and that an A record exists for the vault. Confirm Key Vault publicNetworkAccess is Disabled (expected) and that your app is using the standard vault hostname (<name>.vault.azure.net), not the privatelink hostname.

**Issue:** DNS resolution for <kv-name>.vault.azure.net returns a public IP.

**Solution:** Ensure the Private DNS zone is linked to the VNet where the calling workload resides, and that the Private Endpoint has a privateDnsZoneGroup referencing the zone. If testing from your laptop, it will not use Azure Private DNS; test from within the VNet.

**Issue:** Front Door shows origin unhealthy.

**Solution:** Check that the App Services are running and return 200 on the health probe path. Ensure Front Door origin host header matches the app's default hostname and that HTTPS is allowed. If your app requires auth, configure a probe path that does not require auth (e.g., /health).

**Issue:** App Service cannot integrate with VNet subnet (delegation error).

**Solution:** Ensure the integration subnet is delegated to Microsoft.Web/serverFarms and has sufficient address space. Do not use the private-endpoints subnet for App Service VNet integration.

**Issue:** Role assignment deployment fails with AuthorizationFailed.

**Solution:** The deploying identity needs Owner or User Access Administrator. If you cannot grant these permissions, remove role assignment resources and apply RBAC separately.

**Issue:** PostgreSQL connection fails from API.

**Solution:** Confirm firewall rules permit Azure services or add outbound IPs of the App Service to allowed list. Ensure SSL mode is required and your driver supports TLS. Consider adding Private Endpoint for PostgreSQL if you require full private access.

---

*Generated: 2026-02-02, 11:55:15 a.m.*
