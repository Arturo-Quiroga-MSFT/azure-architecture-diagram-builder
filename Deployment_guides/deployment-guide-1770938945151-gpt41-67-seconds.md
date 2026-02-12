# Deploy Secure Healthcare Imaging Pipeline with Azure Key Vault Integration

## Overview

This guide enables deployment of a secure, scalable healthcare imaging pipeline on Azure, integrating Azure Key Vault for secret management across all pertinent resources. The architecture includes VPN Gateway, Event Hubs, Service Bus, Azure Functions, Cosmos DB, Storage Account, Log Analytics, Virtual Machines, Microsoft Entra ID, and Key Vault. Proper resource connections and identity-based access secure imaging data transmission, storage, and processing.

**Estimated Time:** 45-60 minutes

**Estimated Cost:** $90.90/month

## Prerequisites

- Active Azure subscription
- Azure CLI version 2.50.0 or higher
- Bicep CLI installed (v0.18+)
- Contributor or Owner permissions on the subscription
- Microsoft Entra ID (formerly Azure AD) admin rights
- VS Code or another IDE for editing templates
- Internet access for deploying resources

## Deployment Steps

### Step 1: Login and Set Subscription

Authenticate Azure CLI and set the target subscription.

**Commands:**
```bash
az login
az account set --subscription <YourSubscriptionID>
```

**Notes:**
- 💡 Ensure you have rights. Substitute <YourSubscriptionID> with your Azure subscription GUID.

### Step 2: Initialize Deployment Parameters

Set environment variables for deployment parameters (e.g., environment, location).

**Commands:**
```bash
export ENVIRONMENT=prod
export LOCATION=eastus
```

**Notes:**
- 💡 These will be passed to Bicep templates. Adjust as needed.

### Step 3: Deploy Infrastructure with Bicep

Use the main Bicep template to orchestrate creation of all resources.

**Commands:**
```bash
az deployment sub create --location $LOCATION --template-file main.bicep --parameters environment=$ENVIRONMENT location=$LOCATION
```

**Notes:**
- 💡 Deployment creates all resources, configures identity, and establishes connections.

### Step 4: Review Outputs and Configure Access

Review deployment outputs for endpoints and connection strings. Configure Microsoft Entra ID applications if needed.

**Commands:**
```bash
az deployment sub show --name <DEPLOYMENT_NAME>
```

**Notes:**
- 💡 Outputs include resource endpoints and Key Vault URIs. Configure client applications per output information.

### Step 5: Validate Resource Connectivity

Verify connections (e.g., VMs through VPN Gateway, Function access to Key Vault, Event Hubs streaming).

**Commands:**
```bash
az network vpn-gateway show --name <VPNGateway> --resource-group <ResourceGroup>
az vm show --name <VMName> --resource-group <ResourceGroup>
```

**Notes:**
- 💡 Replace placeholders with output values from step 4.

## Configuration

### Key Vault and Identity

| Setting | Value | Description |
|---------|-------|-------------|
| `KEYVAULT_URI` | <Output from deployment> | Key Vault endpoint for secure secret retrieval. |
| `FUNCTIONS_IDENTITY` | <Assigned identity> | Managed identity for Azure Functions to access Key Vault, Storage, Cosmos DB. |

### Storage and Database

| Setting | Value | Description |
|---------|-------|-------------|
| `COSMOS_CONNECTION_STRING` | <Secured in Key Vault> | Azure Functions retrieve from Key Vault. |
| `STORAGE_CONNECTION_STRING` | <Secured in Key Vault> | Azure Functions retrieve from Key Vault. |

### Event Hubs and Service Bus

| Setting | Value | Description |
|---------|-------|-------------|
| `EVENTHUBS_NAMESPACE` | <Output from deployment> | Used for ingestion of imaging events. |
| `SERVICEBUS_NAMESPACE` | <Output from deployment> | Routing and notification events. |

## Post-Deployment Validation

- [ ] Verify VPN connectivity from on-premises to Azure via VPN Gateway.
- [ ] Validate Event Hubs ingestion and streaming to Service Bus.
- [ ] Check that Azure Functions can retrieve secrets from Key Vault and interact with Storage and Cosmos DB.
- [ ] Ensure Log Analytics is collecting and displaying telemetry from Event Hubs and Functions.
- [ ] Confirm Entra ID identities are assigned and have correct permissions.

## Troubleshooting

**Issue:** Azure Functions cannot retrieve secrets from Key Vault.

**Solution:** Check that managed identity for Functions is assigned and has Key Vault access policy for Get secrets.

**Issue:** VPN Gateway not connecting to on-premises.

**Solution:** Verify VPN settings, IP addresses, and ensure local gateway configuration matches. Use 'az network vpn-gateway show' for status.

**Issue:** Event ingestion failing with authentication errors.

**Solution:** Confirm that Microsoft Entra ID client app registration is complete and connection strings are valid.

**Issue:** Cosmos DB or Storage Account access denied.

**Solution:** Ensure secrets are stored in Key Vault, and proper access policies are granted for Functions' identity.

**Issue:** Log Analytics not showing expected telemetry.

**Solution:** Verify diagnostic settings on Event Hubs and Functions point to Log Analytics workspace.

---

*Generated: 2026-02-12, 6:28:53 p.m.*
