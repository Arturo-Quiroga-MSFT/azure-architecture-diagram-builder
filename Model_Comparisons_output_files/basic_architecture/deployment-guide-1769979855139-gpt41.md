# Deploy Machine Learning Pipeline Architecture to Azure

## Overview

This deployment guide provisions a comprehensive Azure-based machine learning pipeline suitable for production workloads. The architecture includes real-time data ingestion (Event Hubs), centralized storage (Data Lake Storage), managed ML experimentation and inference (Azure Machine Learning), secure container hosting (Container Registry), API layer (API Management), integrated monitoring (Application Insights), secure secret management (Key Vault), and enterprise-grade authentication (Microsoft Entra ID, formerly Azure AD).

**Estimated Time:** 45-60 minutes

**Estimated Cost:** $275.60/month

## Prerequisites

- Azure subscription (Owner or Contributor role)
- Azure CLI 2.50.0 or newer
- Bicep CLI 0.7+ (included in recent Azure CLI)
- Permissions to create resource groups and assign RBAC roles
- Owner/Contributor on target Azure subscription
- Service Principal credentials for automated deployments (optional but recommended)
- Python (for AML SDK, not strictly required for infra deployment)

## Deployment Steps

### Step 1: Login & Set Subscription

Authenticate with your Azure account and set the desired subscription.

**Commands:**
```bash
az login
az account set --subscription <your-subscription-id>
```

**Notes:**
- 💡 Use 'az account list' to view your subscriptions.
- 💡 Make sure you have Owner/Contributor permissions.

### Step 2: Prepare Deployment Variables

Define environment variables for consistent naming and deployment context.

**Commands:**
```bash
export ENV=prod
export LOCATION=westeurope
export RESOURCE_GROUP=mlarch-${ENV}-rg
```

**Notes:**
- 💡 Choose a unique ENV value for each environment (e.g., dev, staging, prod).

### Step 3: Create Resource Group

Provision a dedicated resource group for the resources.

**Commands:**
```bash
az group create --name $RESOURCE_GROUP --location $LOCATION
```

**Notes:**
- 💡 Resource group will contain all deployed resources.

### Step 4: Deploy Bicep Templates

Initiate deployment using main.bicep with parameters for your environment.

**Commands:**
```bash
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file main.bicep \
  --parameters environment=$ENV location=$LOCATION
```

**Notes:**
- 💡 Ensure all .bicep modules are in the same directory.

### Step 5: Post-Deployment: ID and Endpoint Collection

Retrieve resource outputs such as endpoint URLs and connection strings.

**Commands:**
```bash
az deployment group show --resource-group $RESOURCE_GROUP --name <deployment-name> --query properties.outputs
```

**Notes:**
- 💡 You can also inspect outputs in the Azure Portal or via the deployment log.

## Configuration

### Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `environment` | prod / dev / stage | Target environment for resource naming and policies. |
| `location` | westeurope | Azure region for resource deployment. |
| `eventHubNamespaceName` | mlarch-${ENV}-ehns | Event Hub namespace for ingestion. |
| `eventHubName` | ingest-hub | Event Hub for incoming data. |
| `dataLakeName` | mlarch${ENV}adl | Data Lake Storage account for storing raw and processed data. |
| `amlWorkspaceName` | mlarch-${ENV}-aml | Azure Machine Learning workspace. |
| `containerRegistryName` | mlarch${ENV}acr | Azure Container Registry for model images. |
| `keyVaultName` | mlarch-${ENV}-kv | Key Vault for secrets and credentials. |
| `apiManagementName` | mlarch-${ENV}-apim | API Management instance. |
| `appInsightsName` | mlarch-${ENV}-appi | Application Insights for monitoring. |

## Post-Deployment Validation

- [ ] Verify Event Hub and Data Lake Storage linkage by sending test messages.
- [ ] Check Azure Machine Learning workspace status in the portal.
- [ ] Validate storage account, container registry, and Key Vault access.
- [ ] Ensure API Management instance is running and endpoints are enabled.
- [ ] Review Application Insights for telemetry signals.
- [ ] Check assigned RBAC permissions and Managed Identities.

## Troubleshooting

**Issue:** Deployment fails with 'AuthorizationFailed'

**Solution:** Ensure your user or Service Principal has Contributor or Owner permissions on the target subscription & resource group.

**Issue:** AML workspace not linked to Storage/Key Vault

**Solution:** Review managed identity setup and ensure correct RBAC assignments. Retry deployment if needed.

**Issue:** Access denied errors in Event Hubs or Data Lake

**Solution:** Confirm MSI and RBAC assignments for Azure ML and related identities; reapply roles if necessary.

**Issue:** API Management service creation fails

**Solution:** API Management names must be globally unique. Adjust the name parameter and redeploy.

---

*Generated: 2026-02-01, 4:04:04 p.m.*
