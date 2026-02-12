# Deploy Healthcare Imaging Event Pipeline with Key Vault Security to Azure

## Overview

Deploy a secure imaging event ingestion and processing architecture using VPN Gateway, Event Hubs, Service Bus, Azure Functions, Cosmos DB, Storage, Log Analytics, Virtual Machines, Microsoft Entra ID integration (managed identities + RBAC), and Azure Key Vault to centralize secrets/keys. The deployment emphasizes private networking where feasible, managed identity access, and Key Vault references for application secrets.

**Estimated Time:** 60-90 minutes

**Estimated Cost:** $90.90/month

## Prerequisites

- Azure subscription
- Azure CLI 2.50+
- Bicep CLI (az bicep install)
- Permissions: Owner or Contributor + User Access Administrator on the subscription (or target resource group) to create role assignments
- Permissions to create Entra ID app registrations (optional) or ability to use Managed Identity only
- Access to an existing on-prem VPN device / configuration parameters (shared key, BGP ASN if using BGP)
- Open outbound access from deployment machine to Azure management endpoints
- Git (optional, for source control)

## Deployment Steps

### Step 1: Install/verify tooling and sign in

Verify Azure CLI and Bicep, then authenticate to Azure and select the subscription.

**Commands:**
```bash
az version
az bicep version || az bicep install
az login
az account set --subscription <SUBSCRIPTION_ID>
```

**Notes:**
- 💡 If you deploy via CI/CD, use a service principal or federated credentials instead of interactive login.

### Step 2: Create a resource group

Create a dedicated resource group for the solution.

**Commands:**
```bash
export LOCATION=eastus
export ENV=dev
export RG=rg-imaging-${ENV}
az group create -n $RG -l $LOCATION
```

**Notes:**
- 💡 Use a region that supports all selected SKUs (VPN Gateway, Event Hubs, Service Bus, Cosmos DB).

### Step 3: Set deployment parameters

Define parameter values used by Bicep. For production, store these in a parameter file and/or Key Vault.

**Commands:**
```bash
export PREFIX=img
export VM_ADMIN_USER=azureadmin
export VPN_SHARED_KEY='<CHANGE_ME>'
export ONPREM_GATEWAY_PUBLIC_IP='<ONPREM_PUBLIC_IP>'
export ONPREM_ADDRESS_PREFIXES='["10.10.0.0/16"]'
export ONPREM_BGP_ASN=65010
export AZURE_BGP_ASN=65515
```

**Notes:**
- 💡 ONPREM_ADDRESS_PREFIXES must be valid CIDRs in JSON array format.
- 💡 VPN_SHARED_KEY should be treated as sensitive; avoid storing it in shell history. Prefer a secure secret store for pipelines.

### Step 4: Validate the Bicep deployment (what-if)

Run a what-if to see planned changes before deployment.

**Commands:**
```bash
az deployment group what-if -g $RG -f main.bicep -p environment=$ENV location=$LOCATION namePrefix=$PREFIX vpnSharedKey=$VPN_SHARED_KEY onPremGatewayPublicIp=$ONPREM_GATEWAY_PUBLIC_IP onPremAddressPrefixes=$ONPREM_ADDRESS_PREFIXES onPremBgpAsn=$ONPREM_BGP_ASN azureBgpAsn=$AZURE_BGP_ASN
```

**Notes:**
- 💡 If you see SKU/region errors, change location or SKUs in parameters.

### Step 5: Deploy infrastructure with Bicep

Deploy all services (networking, VPN gateway, Event Hubs, Service Bus, Functions, Storage, Cosmos DB, Log Analytics, Key Vault, VMs) and configure Key Vault access using RBAC + managed identity.

**Commands:**
```bash
az deployment group create -g $RG -f main.bicep -p environment=$ENV location=$LOCATION namePrefix=$PREFIX vpnSharedKey=$VPN_SHARED_KEY onPremGatewayPublicIp=$ONPREM_GATEWAY_PUBLIC_IP onPremAddressPrefixes=$ONPREM_ADDRESS_PREFIXES onPremBgpAsn=$ONPREM_BGP_ASN azureBgpAsn=$AZURE_BGP_ASN
```

**Notes:**
- 💡 VPN Gateway can take 30-60+ minutes to provision depending on SKU.
- 💡 This deployment uses managed identity for Function access to Key Vault, Storage, Service Bus, Event Hubs, and Cosmos DB via RBAC.

### Step 6: Retrieve outputs (endpoints, identifiers)

Read deployment outputs for connection endpoints and resource names.

**Commands:**
```bash
az deployment group show -g $RG -n main --query properties.outputs -o jsonc
```

**Notes:**
- 💡 Use outputs to configure on-prem VPN device and any client apps.

### Step 7: Configure on-prem VPN device

Apply the VPN configuration to your on-prem device using the Azure VPN gateway public IP and shared key.

**Commands:**
```bash
echo 'Configure your on-prem VPN device with Azure VPN Gateway public IP from outputs and the shared key you provided.'
```

**Notes:**
- 💡 If using BGP, ensure ASN values and BGP peering addresses match your device configuration.
- 💡 Confirm that on-prem routes do not overlap with Azure VNet address space.

## Configuration

### Deployment parameters

| Setting | Value | Description |
|---------|-------|-------------|
| `environment` | dev | Deployment environment label used for naming and tagging. |
| `location` | eastus | Azure region for all resources. |
| `namePrefix` | img | Prefix for resource names; resources append environment and unique suffix where needed. |
| `vpnSharedKey` | <secret> | Pre-shared key used for site-to-site VPN connection. |
| `onPremGatewayPublicIp` | <ONPREM_PUBLIC_IP> | Public IP of on-prem VPN device. |
| `onPremAddressPrefixes` | ["10.10.0.0/16"] | On-prem address prefixes reachable via VPN. |

### Application settings (Azure Functions)

| Setting | Value | Description |
|---------|-------|-------------|
| `EVENTHUB_NAMESPACE_FQDN` | <output:eventHubNamespaceFqdn> | Event Hubs namespace FQDN used by SDKs (prefer Entra ID auth). |
| `SERVICEBUS_NAMESPACE_FQDN` | <output:serviceBusNamespaceFqdn> | Service Bus namespace FQDN used by SDKs (prefer Entra ID auth). |
| `COSMOS_ACCOUNT_ENDPOINT` | <output:cosmosEndpoint> | Cosmos DB endpoint; use managed identity for auth where supported by your SDK, or retrieve keys from Key Vault if required. |
| `STORAGE_ACCOUNT_NAME` | <output:storageAccountName> | Storage account name for imaging payloads. |
| `KEYVAULT_URI` | <output:keyVaultUri> | Key Vault URI; Functions use managed identity to read secrets. |

### Key Vault secrets (optional fallbacks)

| Setting | Value | Description |
|---------|-------|-------------|
| `storage-connection-string` | set post-deploy | If you must use connection strings, store them in Key Vault and use Key Vault references or runtime retrieval. Prefer RBAC + managed identity for Storage access when possible. |
| `cosmos-primary-key` | set post-deploy | Only if required by your application/SDK; prefer Entra ID RBAC for Cosmos DB data plane when possible. |

## Post-Deployment Validation

- [ ] Verify VPN Gateway and connection state: az network vpn-connection show -g <rg> -n <connName> -o table
- [ ] Verify Event Hubs namespace is Active and diagnostics are enabled to Log Analytics
- [ ] Verify Service Bus namespace and queue/topic exist and are reachable
- [ ] Verify Function App is running and has SystemAssigned identity enabled
- [ ] Verify Function App identity can read Key Vault secrets (RBAC): test by adding a secret and using app code or `az keyvault secret show` with appropriate identity context
- [ ] Verify Cosmos DB account endpoint resolves and that the function can write metadata (application test)
- [ ] Verify Storage account allows secure transfer and that functions can write blobs via managed identity (application test)
- [ ] Verify Log Analytics receives diagnostics from Event Hubs and Functions (Azure Portal -> Log Analytics -> Logs)
- [ ] Configure alerts: Function failures, Service Bus dead-letter messages, Event Hub throttling, VPN tunnel down

## Troubleshooting

**Issue:** Deployment fails with AuthorizationFailed when creating role assignments

**Solution:** Ensure the deploying identity has 'User Access Administrator' or 'Owner' at the scope (resource group or subscription). Re-run the deployment after permissions propagate (can take several minutes).

**Issue:** VPN connection shows NotConnected

**Solution:** Confirm on-prem public IP, shared key, IKE/IPsec parameters match (policy), and on-prem address prefixes do not overlap Azure VNet. Check NSGs/UDRs and confirm UDP 500/4500 are allowed on the on-prem firewall.

**Issue:** Function cannot access Key Vault (403)

**Solution:** Verify Key Vault uses RBAC authorization and that the Function's managed identity has 'Key Vault Secrets User' role at the vault scope. Also verify the Function is using the correct vault URI.

**Issue:** Function cannot write to Storage (403) using managed identity

**Solution:** Assign 'Storage Blob Data Contributor' to the Function managed identity at the Storage account scope (or container scope). Ensure your SDK uses DefaultAzureCredential/ManagedIdentityCredential and not a connection string.

**Issue:** Event Hub producer/consumer cannot authenticate

**Solution:** For Entra ID auth, ensure the client principal has 'Azure Event Hubs Data Sender' or 'Azure Event Hubs Data Receiver' on the namespace. For SAS fallback, ensure policies exist and connection strings are correct.

**Issue:** Cosmos DB access denied from Functions

**Solution:** If using Entra ID data-plane RBAC, assign the appropriate Cosmos DB built-in role (e.g., 'Cosmos DB Built-in Data Contributor') at account/database/container scope. If using keys, store them in Key Vault and retrieve at runtime.

**Issue:** No logs in Log Analytics

**Solution:** Confirm diagnostic settings are created for Event Hubs/Service Bus/Cosmos/Key Vault (as applicable) and point to the correct workspace. Allow 5-15 minutes for data ingestion.

---

*Generated: 2026-02-12, 5:00:01 p.m.*
