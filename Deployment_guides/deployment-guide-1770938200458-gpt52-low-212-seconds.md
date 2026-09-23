# Deploy Secure Imaging Event Pipeline (VPN → Event Hubs → Service Bus → Functions → Cosmos DB/Storage) with Key Vault to Azure

## Overview

This guide deploys a secure healthcare imaging event ingestion and processing architecture using VPN Gateway, Event Hubs, Service Bus, Azure Functions, Cosmos DB, Storage, Log Analytics, Virtual Machines, and Key Vault. Microsoft Entra ID is used for authentication/authorization. Key Vault secures pertinent secrets (Storage/Cosmos keys) and Functions retrieve them via Key Vault references and Managed Identity.

**Estimated Time:** 45-90 minutes

**Estimated Cost:** $90.90/month

## Prerequisites

- Azure subscription
- Azure CLI 2.50+ (recommended latest)
- Bicep CLI (az bicep install)
- Permissions: Owner or Contributor on subscription/resource group; plus User Access Administrator (or Owner) to create role assignments
- Permissions in Microsoft Entra ID to create app registrations/service principals (if you choose client authentication to Event Hubs via Entra ID)
- An on-premises VPN device configuration (public IP, address spaces, PSK) for the VPN connection
- SSH key pair for VM admin access (or password, not recommended)

## Deployment Steps

### Step 1: Install/verify tools and sign in

Install Bicep, verify Azure CLI, and authenticate.

**Commands:**
```bash
az version
az bicep install
az login
az account show
```

**Notes:**
- 💡 If you manage multiple tenants/subscriptions: az account set --subscription <SUBSCRIPTION_ID>.

### Step 2: Set environment variables (recommended)

Define consistent naming and deployment parameters.

**Commands:**
```bash
export LOCATION=eastus
export ENV=dev
export PREFIX=imaging
export RG_NAME=${PREFIX}-${ENV}-rg
export DEPLOY_NAME=${PREFIX}-${ENV}-deploy
export ONPREM_ADDRESS_PREFIX=10.10.0.0/16
export ONPREM_VPN_PUBLIC_IP=<YOUR_ONPREM_VPN_PUBLIC_IP>
export VPN_SHARED_KEY='<A_STRONG_PSK>'
export VM_ADMIN_USERNAME=azureuser
export VM_SSH_PUBLIC_KEY='ssh-rsa AAAA...'
```

**Notes:**
- 💡 Choose a globally unique PREFIX if you want deterministic resource names.
- 💡 VPN parameters must match your on-premises VPN device configuration.

### Step 3: Create resource group

Create the deployment resource group.

**Commands:**
```bash
az group create -n $RG_NAME -l $LOCATION
```

**Notes:**
- 💡 If you use Azure Policy, ensure your policy allows the required resource types and configurations.

### Step 4: Deploy infrastructure with Bicep

Deploy all Azure resources and security controls (Key Vault RBAC, managed identity, diagnostic settings).

**Commands:**
```bash
az deployment group create \
  -g $RG_NAME \
  -n $DEPLOY_NAME \
  -f main.bicep \
  -p environment=$ENV location=$LOCATION prefix=$PREFIX \
  -p onPremAddressPrefix=$ONPREM_ADDRESS_PREFIX onPremVpnPublicIp=$ONPREM_VPN_PUBLIC_IP vpnSharedKey=$VPN_SHARED_KEY \
  -p vmAdminUsername=$VM_ADMIN_USERNAME vmSshPublicKey="$VM_SSH_PUBLIC_KEY"
```

**Notes:**
- 💡 This deployment creates Key Vault with RBAC authorization enabled and assigns the Function App managed identity access to secrets.
- 💡 If your organization blocks public network access by policy, set the template parameters to disable public access and use private endpoints (not included in this baseline).

### Step 5: Configure Microsoft Entra ID authentication (optional but recommended for clients)

Create/identify an Entra ID app/service principal for producers that ingest events into Event Hubs (OAuth). Then assign Azure RBAC roles on the Event Hubs namespace.

**Commands:**
```bash
export EH_NS_ID=$(az resource show -g $RG_NAME -n ${PREFIX}-${ENV}-ehns --resource-type Microsoft.EventHub/namespaces --query id -o tsv)
az ad app create --display-name ${PREFIX}-${ENV}-eh-producer --sign-in-audience AzureADMyOrg
export APP_ID=$(az ad app list --display-name ${PREFIX}-${ENV}-eh-producer --query [0].appId -o tsv)
az ad sp create --id $APP_ID
export SP_OBJECT_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query [0].id -o tsv)
az role assignment create --assignee-object-id $SP_OBJECT_ID --assignee-principal-type ServicePrincipal --role "Azure Event Hubs Data Sender" --scope $EH_NS_ID
```

**Notes:**
- 💡 Clients should use the app registration to obtain tokens and connect to Event Hubs with AAD authentication.
- 💡 For Service Bus and other data-plane operations, use equivalent RBAC roles (e.g., Azure Service Bus Data Sender/Receiver) as needed.

## Configuration

### Core parameters (Bicep)

| Setting | Value | Description |
|---------|-------|-------------|
| `prefix` | imaging | Name prefix for all resources. |
| `environment` | dev | Environment label used in naming/tags (dev/test/prod). |
| `location` | eastus | Azure region for all resources. |
| `onPremAddressPrefix` | 10.10.0.0/16 | On-premises network address space for VPN local network gateway. |
| `onPremVpnPublicIp` | <YOUR_ONPREM_VPN_PUBLIC_IP> | Public IP of your on-premises VPN device. |
| `vpnSharedKey` | <STRONG_PSK> | Pre-shared key for the VPN connection. |

### Function App settings (applied by template)

| Setting | Value | Description |
|---------|-------|-------------|
| `AzureWebJobsStorage` | @Microsoft.KeyVault(SecretUri=<kvSecretUri>) | Uses Key Vault reference to retrieve Storage connection string (host runtime requirement). |
| `Cosmos__Key` | @Microsoft.KeyVault(SecretUri=<kvSecretUri>) | Cosmos DB key retrieved via Key Vault reference (for data write operations if not using AAD). |
| `ServiceBus__Connection` | @Microsoft.KeyVault(SecretUri=<kvSecretUri>) | Service Bus connection string (optional; prefer AAD + RBAC for production). |

## Post-Deployment Validation

- [ ] Validate resource deployment: az resource list -g <rg> -o table
- [ ] Validate VPN Gateway provisioning state: az network vnet-gateway show -g <rg> -n <name> --query provisioningState -o tsv
- [ ] Check Event Hubs namespace and hub exist: az eventhubs namespace show -g <rg> -n <name>; az eventhubs eventhub show -g <rg> --namespace-name <ns> -n <hub>
- [ ] Check Service Bus namespace and queue/topic exist: az servicebus namespace show -g <rg> -n <name>
- [ ] Validate Function App is running and identity enabled: az functionapp show -g <rg> -n <name> --query identity
- [ ] Validate Key Vault secrets exist: az keyvault secret list --vault-name <kvName> -o table
- [ ] Confirm diagnostic settings flowing to Log Analytics: query the workspace (Azure Portal → Logs) for AzureDiagnostics / resource-specific tables
- [ ] Set up alerts/dashboards in Log Analytics (or Azure Monitor) for Event Hubs ingress/egress, Function failures, and VPN tunnel status

## Troubleshooting

**Issue:** Bicep deployment fails with AuthorizationFailed on roleAssignments

**Solution:** Ensure your account has Owner or User Access Administrator permissions at the scope (resource group/subscription). Re-run deployment after permissions propagate.

**Issue:** Function App cannot resolve Key Vault references (app settings show errors)

**Solution:** Verify Key Vault RBAC is enabled and the Function managed identity has 'Key Vault Secrets User' role on the vault. Also ensure the secret URIs are correct and the Function App is using a system-assigned identity.

**Issue:** VPN Gateway deployment takes a long time or times out

**Solution:** VPN Gateway provisioning can take 30-60+ minutes. Re-check provisioningState and ensure the GatewaySubnet exists with sufficient size (/27 recommended).

**Issue:** Event producers cannot authenticate to Event Hubs with Entra ID

**Solution:** Confirm the client uses AAD OAuth (not SAS), the service principal has 'Azure Event Hubs Data Sender' at the namespace or hub scope, and the client uses the correct fully qualified namespace and audience.

**Issue:** Diagnostics not appearing in Log Analytics

**Solution:** Confirm diagnostic settings are created on each resource and point to the correct workspace. Some logs are resource-specific tables (not AzureDiagnostics) depending on provider and API version.

**Issue:** Function runtime errors referencing AzureWebJobsStorage

**Solution:** AzureWebJobsStorage is required; ensure the Storage connection string secret is present and accessible via Key Vault reference. Also ensure Function App has outbound access to Key Vault endpoints (network restrictions can block this).

---

*Generated: 2026-02-12, 6:16:24 p.m.*
