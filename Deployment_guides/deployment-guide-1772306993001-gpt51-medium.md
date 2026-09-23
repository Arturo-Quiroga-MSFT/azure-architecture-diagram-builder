# Deploy ML Model Pipeline to Azure

## Overview

This guide deploys an end-to-end ML model pipeline on Azure using Bicep and Azure CLI. It provisions data prep (Storage + Data Factory), model training (Azure Machine Learning workspace + GPU compute), feature storage (Cosmos DB), serving (Azure ML Online & Batch Endpoints), frontend (Azure Static Web Apps with Entra ID auth), and monitoring (Azure Monitor via Log Analytics).

**Estimated Time:** 60-90 minutes

**Estimated Cost:** $339.20/month

## Prerequisites

- Azure subscription with Owner or Contributor + User Access Administrator on the target subscription
- Azure CLI 2.50+ installed (https://learn.microsoft.com/cli/azure/install-azure-cli)
- Bicep CLI 0.27+ (or use `az bicep install`)
- Azure ML CLI v2 extension (`az extension add -n ml`)
- Permissions to register resource providers in the subscription
- Git installed (if you plan to deploy from a repo to Static Web Apps)
- Basic familiarity with Azure Machine Learning, Data Factory, and Cosmos DB

## Deployment Steps

### Step 1: Login and select subscription

Authenticate with Azure and set the subscription that will host the ML pipeline.

**Commands:**
```bash
az login
az account list -o table
az account set --subscription <SUBSCRIPTION_ID_OR_NAME>
```

**Notes:**
- 💡 Use an account with permissions to create resource groups and register resource providers.
- 💡 If using a service principal, use `az login --service-principal -u <APP_ID> -p <PASSWORD> --tenant <TENANT_ID>`.

### Step 2: Register required resource providers

Ensure all required Azure resource providers are registered for ML, Data Factory, Static Web Apps, and monitoring.

**Commands:**
```bash
az provider register -n Microsoft.Storage
az provider register -n Microsoft.DataFactory
az provider register -n Microsoft.MachineLearningServices
az provider register -n Microsoft.DocumentDB
az provider register -n Microsoft.Web
az provider register -n Microsoft.Insights
az provider register -n Microsoft.OperationalInsights
```

**Notes:**
- 💡 Provider registration may take several minutes; you can check status with `az provider show -n <PROVIDER_NAME> -o table`.

### Step 3: Create resource group and clone templates

Create a resource group in your target region and ensure the Bicep files are available locally.

**Commands:**
```bash
az group create -n ml-pipeline-rg -l westeurope
# If your Bicep files are in a repo:
git clone <YOUR_REPO_URL> ml-pipeline-iac
cd ml-pipeline-iac
```

**Notes:**
- 💡 Replace `westeurope` with a region that supports Azure ML, Cosmos DB, and Static Web Apps (e.g., `westeurope`, `eastus`, `uksouth`).
- 💡 If you paste the Bicep templates from this guide, preserve the folder structure (main.bicep + modules/...).

### Step 4: Deploy core infrastructure with Bicep

Deploy Storage, Data Factory, Azure ML workspace + GPU compute, Cosmos DB, Log Analytics, endpoints, and Static Web Apps.

**Commands:**
```bash
az deployment group create \
  --resource-group ml-pipeline-rg \
  --name ml-pipeline-deployment \
  --template-file main.bicep \
  --parameters baseName=mlpipe environment=dev location=westeurope
```

**Notes:**
- 💡 `baseName` must be globally unique-ish and 3–15 lowercase alphanumeric characters (e.g., `mlpipe01`).
- 💡 Common environments: `dev`, `test`, `prod`. This is used in resource naming and tagging.
- 💡 Review the outputs printed after deployment; you will use them for app configuration and testing.

### Step 5: Configure Azure ML (datastores, compute, endpoints)

Validate the Azure ML workspace, GPU compute, and prepare the Online/Batch endpoints for model deployments.

**Commands:**
```bash
az extension add -n ml --upgrade
az ml workspace show --name <AML_WORKSPACE_NAME> --resource-group ml-pipeline-rg
# Example: show existing compute (GPU cluster should appear)
az ml compute list --workspace-name <AML_WORKSPACE_NAME> --resource-group ml-pipeline-rg
# After you train and register a model, you can create deployments for the online endpoint, e.g.:
# az ml online-endpoint update --name online-dev --workspace-name <AML_WORKSPACE_NAME> --resource-group ml-pipeline-rg --traffic blue=100
# az ml online-deployment create --name blue --endpoint-name online-dev --model <MODEL_ASSET_ID> --instance-type Standard_NC6s_v3 --instance-count 1
```

**Notes:**
- 💡 The Bicep deployment creates the workspace, GPU compute cluster, and empty endpoints. You must attach real model deployments later using Azure ML CLI or Studio.
- 💡 Use Azure ML Studio UI to create training jobs, pipelines, and feature store definitions aligned with this infrastructure.

### Step 6: Configure Static Web App and application settings

Wire the frontend to the ML Online & Batch endpoints and to Entra ID for authentication.

**Commands:**
```bash
# Get outputs (example using az CLI)
az deployment group show \
  --resource-group ml-pipeline-rg \
  --name ml-pipeline-deployment \
  --query properties.outputs
# Update Static Web App configuration (via portal or CLI):
# Example CLI to set app settings:
az staticwebapp appsettings set \
  --name <STATIC_WEB_APP_NAME> \
  --resource-group ml-pipeline-rg \
  --setting-names REACT_APP_ONLINE_ENDPOINT_URL=<ONLINE_ENDPOINT_URL> \
                  REACT_APP_BATCH_ENDPOINT_NAME=<BATCH_ENDPOINT_NAME> \
                  REACT_APP_COSMOS_CONN_STRING='<COSMOS_CONNECTION_STRING>'
# Configure Microsoft Entra ID for Static Web Apps via the Azure portal or SWA auth config file.
```

**Notes:**
- 💡 You will need the `onlineEndpointUrl`, `batchEndpointName`, `cosmosConnectionString`, and `staticWebAppUrl` outputs from the Bicep deployment.
- 💡 Configure Entra ID authentication for Static Web Apps using the built-in auth providers or a custom auth configuration (Azure portal → Static Web App → Authentication).

## Configuration

### Core deployment parameters

| Setting | Value | Description |
|---------|-------|-------------|
| `baseName` | mlpipe01 | Short, globally unique-ish base name used in all resource names (storage account, cosmos, workspace, etc.). Lowercase, 3–15 characters. |
| `environment` | dev | Environment tag and suffix used for resources and endpoints (e.g., dev, test, prod). |
| `location` | westeurope | Azure region for all resources. Must support Azure ML, Cosmos DB, and Static Web Apps. |

### Application (Static Web App) settings

| Setting | Value | Description |
|---------|-------|-------------|
| `REACT_APP_ONLINE_ENDPOINT_URL` | <onlineEndpointUrl output> | Full scoring URL of the Azure ML Online Endpoint used for real-time inference. |
| `REACT_APP_BATCH_ENDPOINT_NAME` | <batchEndpointName output> | Name of the Azure ML Batch Endpoint used for batch/A-B inference submissions. |
| `REACT_APP_AZURE_ML_WORKSPACE` | <amlWorkspaceName output> | Azure ML workspace name used by backend APIs or job submission logic. |
| `REACT_APP_COSMOS_CONN_STRING` | <cosmosConnectionString output> | Cosmos DB connection string for reading online feature vectors from the feature store. |
| `REACT_APP_ENVIRONMENT` | dev | Environment indicator used by the frontend for environment-specific behavior or telemetry tagging. |

### Azure ML configuration (CLI / pipelines)

| Setting | Value | Description |
|---------|-------|-------------|
| `AZURE_ML_WORKSPACE_NAME` | <amlWorkspaceName output> | Workspace name passed to `az ml` CLI commands. |
| `AZURE_ML_RESOURCE_GROUP` | ml-pipeline-rg | Resource group that contains the Azure ML workspace. |
| `AZURE_ML_COMPUTE_GPU` | gpu-cluster | GPU compute cluster name used for training jobs. |

### Data Factory configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `ADF_FACTORY_NAME` | <dataFactoryName output> | Azure Data Factory instance used for raw data ingestion and feature engineering pipelines. |
| `RAW_DATA_STORAGE_ACCOUNT` | <storageAccountName output> | Storage account that holds raw data, features, and training datasets. |

### Monitoring and retraining

| Setting | Value | Description |
|---------|-------|-------------|
| `LOG_ANALYTICS_WORKSPACE_ID` | <logAnalyticsWorkspaceId output> | Resource ID of the Log Analytics workspace used for Azure Monitor logs and metrics. |
| `RETRAINING_MONITOR_QUERY` | custom query in Log Analytics | Kusto query used to detect model performance degradation and trigger retraining pipelines. |

## Post-Deployment Validation

- [ ] In the Azure portal, verify all resources exist in the resource group: Storage Account, Data Factory, Azure ML workspace and compute, Cosmos DB, Static Web App, and Log Analytics workspace.
- [ ] Open Azure ML Studio, confirm the workspace and GPU compute cluster (`gpu-cluster`) are available, and run a small training job using the GPU cluster.
- [ ] After registering a model, create Online and Batch endpoint deployments (via Azure ML Studio or `az ml` CLI) so that the scaffolded endpoints start serving traffic.
- [ ] Deploy your frontend to Azure Static Web Apps (via GitHub/GitHub Actions or CLI) and configure app settings for Online/Batch endpoint URLs and Cosmos connection string.
- [ ] Send a test request to the Online Endpoint (via curl, Postman, or the Static Web App) and verify predictions are returned and telemetry appears in Log Analytics.
- [ ] Validate Cosmos DB is being used as the online feature store by writing sample feature vectors and retrieving them from the Online Endpoint.

## Troubleshooting

**Issue:** Deployment fails with `MissingSubscriptionRegistration` or similar provider errors.

**Solution:** Run `az provider register` for all required providers (Microsoft.MachineLearningServices, Microsoft.DataFactory, Microsoft.DocumentDB, Microsoft.Web, Microsoft.Insights, Microsoft.OperationalInsights, Microsoft.Storage). Wait a few minutes and re-run the deployment.

**Issue:** Storage account or Static Web App name already in use or invalid.

**Solution:** Change the `baseName` parameter to a unique, lowercase alphanumeric string (3–15 characters). Re-run the Bicep deployment with the updated parameter.

**Issue:** GPU compute cluster cannot be created due to quota or SKU availability.

**Solution:** Check region support and quotas for GPU SKUs. Use `az vm list-skus -l <region> -o table | grep NC` to see available GPU SKUs, or open a support ticket to increase GPU quota. Update the `vmSize` in the AML module if required.

**Issue:** Online endpoint URL (`onlineEndpointUrl` output) is null or endpoint returns 404.

**Solution:** The Bicep template creates an endpoint container but does not add deployments. Use Azure ML Studio or `az ml online-deployment create` to deploy a model to the endpoint, then update endpoint traffic (e.g., `az ml online-endpoint update --traffic blue=100`).

**Issue:** Static Web App cannot call the Online/Batch endpoints (401/403 errors).

**Solution:** Ensure Entra ID authentication is properly configured for the Static Web App and that access tokens are requested for the correct resource (Azure ML / Azure management). Check CORS settings on the endpoint and ensure the Static Web App URL is allowed, or use a backend API to proxy calls.

**Issue:** No logs or metrics appearing in Log Analytics for the Online Endpoint.

**Solution:** Confirm diagnostic settings from Azure ML workspace/endpoint to Log Analytics are configured (either via the portal or additional Bicep). Verify that your Log Analytics workspace ID in configuration matches the deployed workspace and that queries use the correct table names.

---

*Generated: 2026-02-28, 2:29:39 p.m.*
