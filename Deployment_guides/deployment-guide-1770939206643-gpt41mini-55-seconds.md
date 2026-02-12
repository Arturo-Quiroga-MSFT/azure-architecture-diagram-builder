# Deploy Secure Imaging Event Processing Architecture to Azure

## Overview

This guide walks through deploying a secure imaging event processing system on Azure leveraging VPN Gateway, Event Hubs, Service Bus, Azure Functions, Cosmos DB, Storage Account, Log Analytics, Virtual Machines, Microsoft Entra ID, and Key Vault for enhanced security and seamless integration.

**Estimated Time:** 45-60 minutes

**Estimated Cost:** $90.90/month

## Prerequisites

- Azure subscription with contributor or owner access
- Azure CLI version 2.50 or higher installed (https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- Logged in to Azure CLI and selected target subscription (az login and az account set)
- Appropriate permissions to create/manage resources including Key Vault and managed identities
- Bicep CLI installed or Azure CLI with Bicep support for deploying templates

## Deployment Steps

### Step 1: Login and Set Subscription

Authenticate to Azure and select the subscription where you want to deploy the architecture.

**Commands:**
```bash
az login
az account set --subscription <subscription-id>
```

**Notes:**
- 💡 Replace <subscription-id> with your Azure Subscription ID.

### Step 2: Create Resource Group

Create an Azure resource group to host all deployed resources.

**Commands:**
```bash
az group create --name imaging-rg --location eastus
```

**Notes:**
- 💡 Change location if needed to your preferred Azure region.

### Step 3: Deploy Infrastructure with Bicep Template

Use the provided Bicep templates to deploy all infrastructure components with integrated Key Vault security.

**Commands:**
```bash
az deployment group create --resource-group imaging-rg --template-file main.bicep --parameters environment=prod location=eastus
```

**Notes:**
- 💡 This deploys VPN Gateway, Event Hubs, Service Bus, Azure Functions, Cosmos DB, Storage Account, Log Analytics workspace, Virtual Machines, Entra ID integrations, and Key Vault with proper secret references.
- 💡 Modify parameters as needed for your environment.

### Step 4: Verify Key Vault Access Policies

Ensure managed identities and resources have correct access policies to retrieve secrets and keys.

**Commands:**
```bash
az keyvault show --name imaging-keyvault
az keyvault set-policy --name imaging-keyvault --object-id <managed-identity-object-id> --secret-permissions get list
```

**Notes:**
- 💡 Replace <managed-identity-object-id> with the managed identity service principal IDs for Azure Functions, Cosmos DB, and Storage Account.

### Step 5: Configure Managed Identities and Authentication

Enable Managed Identities for Azure Functions and Virtual Machines and assign necessary permissions.

**Commands:**
```bash
az functionapp identity assign --name imaging-functionapp --resource-group imaging-rg
az vm identity assign --resource-group imaging-rg --name imaging-vm
```

**Notes:**
- 💡 This enables secure communication with Key Vault and Event Hubs through Entra ID authentication.

### Step 6: Configure Microsoft Entra ID Integrations

Ensure Event Hubs and Azure Functions authenticate clients via Microsoft Entra ID.

**Commands:**
```bash
# Register applications and assign access roles in Entra ID for Event Hubs and Azure Functions (done via Azure Portal or CLI)
```

**Notes:**
- 💡 This ensures only authorized identities can ingest or process events.

## Configuration

### Environment Variables & Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `EVENTHUB_NAMESPACE` | <eventhubs-namespace> | Namespace of the Event Hubs instance deployed. |
| `SERVICEBUS_NAMESPACE` | <servicebus-namespace> | Namespace of the Service Bus deployed. |
| `COSMOS_DB_CONNECTION_STRING` | @Microsoft.KeyVault(SecretUri=https://imaging-keyvault.vault.azure.net/secrets/CosmosDbConnectionString) | Cosmos DB connection string retrieved securely from Key Vault. |
| `STORAGE_ACCOUNT_CONNECTION_STRING` | @Microsoft.KeyVault(SecretUri=https://imaging-keyvault.vault.azure.net/secrets/StorageAccountConnectionString) | Storage Account connection string retrieved securely from Key Vault. |
| `LOG_ANALYTICS_WORKSPACE_ID` | <log-analytics-workspace-id> | Workspace ID for Log Analytics. |
| `LOG_ANALYTICS_WORKSPACE_KEY` | @Microsoft.KeyVault(SecretUri=https://imaging-keyvault.vault.azure.net/secrets/LogAnalyticsKey) | Log Analytics workspace key stored securely in Key Vault. |

## Post-Deployment Validation

- [ ] Validate all resource deployments via the Azure Portal or CLI (az resource list -g imaging-rg).
- [ ] Confirm that Azure Functions have their managed identities assigned and Key Vault access policies set correctly.
- [ ] Check Event Hubs and Service Bus namespaces and confirm connectivity.
- [ ] Verify VPN Gateway is configured and connected with on-premises VPN.
- [ ] Review Log Analytics workspace for ingestion of logs from Event Hubs and Functions.
- [ ] Test Azure Functions processing pipeline by sending test events through VPN Gateway.

## Troubleshooting

**Issue:** Azure Function cannot retrieve secrets from Key Vault.

**Solution:** Ensure Azure Function's managed identity is granted 'get' and 'list' secret permissions in the Key Vault access policies.

**Issue:** Event Hubs client authentication fails.

**Solution:** Verify that client applications use the correct Microsoft Entra ID credentials and that Event Hubs role assignments are configured properly.

**Issue:** VPN Gateway connection does not establish.

**Solution:** Check VPN gateway configuration, local network gateway settings, and shared key secrets between on-premises and Azure Gateway.

**Issue:** Azure Functions fail to write to Cosmos DB or Storage Account.

**Solution:** Verify the connection strings in Key Vault are correct and accessible; ensure appropriate Firewalls and VNet service endpoints are configured.

---

*Generated: 2026-02-12, 6:33:18 p.m.*
