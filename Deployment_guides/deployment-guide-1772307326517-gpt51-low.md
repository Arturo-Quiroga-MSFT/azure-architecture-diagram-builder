# Deploy ML Model Pipeline to Azure

## Overview

This guide deploys an end-to-end ML model pipeline to Azure using Bicep and Azure CLI. It provisions data prep, training, serving, feature store, monitoring, and web application components that match the described architecture.

**Estimated Time:** 60-90 minutes

**Estimated Cost:** $339.20/month (estimated, assuming modest dev/test scale; actual cost depends on usage, SKUs, and region)

## Prerequisites

- Active Azure subscription with Owner or Contributor role on the target subscription
- Azure CLI 2.50+ installed and logged in (https://learn.microsoft.com/cli/azure/install-azure-cli)
- Bicep CLI v0.27+ (or az bicep upgrade) installed
- Permissions to register resource providers: Microsoft.Storage, Microsoft.DataFactory, Microsoft.MachineLearningServices, Microsoft.DocumentDB, Microsoft.Web, Microsoft.Insights, Microsoft.OperationalInsights
- Git installed (optional, if storing Bicep in a repo)
- Familiarity with Azure ML, Azure Storage, Azure Cosmos DB, Azure Monitor, and Azure Static Web Apps
- Custom domain or GitHub/Azure DevOps repo for Static Web App (for production scenarios)
- Configured Microsoft Entra ID tenant (for app authentication; app registration can be done post-deployment)

## Deployment Steps

### Step 1: Set Azure subscription and resource group

Select the target subscription and create (or reuse) a resource group for the ML pipeline.

**Commands:**
```bash
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"
az group create -n ml-pipeline-rg -l westus2
```

**Notes:**
- 💡 Replace <SUBSCRIPTION_ID_OR_NAME> with your subscription ID or name.
- 💡 Use a region that supports Azure Machine Learning, Cosmos DB, and Static Web Apps. westus2/eastus are commonly available.

### Step 2: Register required resource providers

Ensure all necessary resource providers are registered in the subscription.

**Commands:**
```bash
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.DataFactory
az provider register --namespace Microsoft.MachineLearningServices
az provider register --namespace Microsoft.DocumentDB
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.Insights
az provider register --namespace Microsoft.OperationalInsights
```

**Notes:**
- 💡 Provider registration is usually a one-time operation per subscription.
- 💡 You can check registration status with: az provider list --query "[?registrationState!='Registered']" -o table

### Step 3: Prepare deployment parameters and environment variables

Define environment variables used by the Bicep deployment.

**Commands:**
```bash
RESOURCE_GROUP="ml-pipeline-rg"
LOCATION="westus2"
ENVIRONMENT="dev"
BASENAME="mlpipe"
TAGS="env=dev project=ml-pipeline owner=ml-team"
```

**Notes:**
- 💡 BASENAME is used as a base for naming resources (storage account, AML workspace, etc.). Use only lowercase letters and numbers (no special characters).
- 💡 You can adjust TAGS as a space-separated list of key=value pairs.

### Step 4: Create Bicep files locally

Create main.bicep and module Bicep files in a directory (e.g., ./infra).

**Commands:**
```bash
mkdir -p infra
cd infra
## Create main.bicep and module files with content from bicepTemplates section of this document
```

**Notes:**
- 💡 Copy each Bicep template from the bicepTemplates array into its respective filename.
- 💡 Ensure the relative module paths in main.bicep match the file structure (all in the same folder in this example).

### Step 5: Validate the Bicep deployment

Run an ARM template validation to catch errors before deployment.

**Commands:**
```bash
az deployment group what-if \
  --name ml-pipeline-whatif \
  --resource-group $RESOURCE_GROUP \
  --template-file main.bicep \
  --parameters \
    location=$LOCATION \
    environment=$ENVIRONMENT \
    baseName=$BASENAME
```

**Notes:**
- 💡 Review the what-if output to ensure no unwanted changes will be made.
- 💡 If validation errors occur, fix the Bicep templates before proceeding.

### Step 6: Deploy the ML pipeline infrastructure

Perform the actual resource deployment into the resource group.

**Commands:**
```bash
az deployment group create \
  --name ml-pipeline-deployment \
  --resource-group $RESOURCE_GROUP \
  --template-file main.bicep \
  --parameters \
    location=$LOCATION \
    environment=$ENVIRONMENT \
    baseName=$BASENAME
```

**Notes:**
- 💡 Deployment can take 10-20 minutes, especially for AML workspace and compute.
- 💡 If deployment fails, use the --verbose or --debug flags to get more context.

### Step 7: Retrieve deployment outputs

Capture endpoints, connection strings, and workspace names for use by your pipelines and applications.

**Commands:**
```bash
az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name ml-pipeline-deployment \
  --query properties.outputs -o jsonc
```

**Notes:**
- 💡 Outputs include storage account name, AML workspace, online and batch endpoint names, Cosmos DB endpoint and key, Static Web App URL, and Log Analytics workspace ID.
- 💡 Store secrets (keys, connection strings) in Azure Key Vault rather than environment variables for production workloads.

### Step 8: Configure Azure ML training and deployment assets

Use Azure ML CLI or Studio to create training jobs, environments, model registrations, and link them to the deployed AML compute and endpoints.

**Commands:**
```bash
az ml workspace show -g $RESOURCE_GROUP -n "${BASENAME}mlw${ENVIRONMENT}"
## Example: attach the GPU compute in Azure ML CLI v2
az ml compute show -g $RESOURCE_GROUP -w "${BASENAME}mlw${ENVIRONMENT}" -n "${BASENAME}gpu${ENVIRONMENT}"
```

**Notes:**
- 💡 Training scripts and pipelines are typically managed via Azure ML CLI, Python SDK, or Studio, not Bicep.
- 💡 Configure your training pipeline to read from the storage account, write models to the AML model registry, and publish features to Cosmos DB as designed.

### Step 9: Connect Static Web App to model endpoints

Update application configuration to call the AML Online and Batch endpoints using Microsoft Entra ID-authenticated requests.

**Commands:**
```bash
## Retrieve Static Web App default hostname
SWA_NAME="${BASENAME}swa${ENVIRONMENT}"
az staticwebapp show -n $SWA_NAME -g $RESOURCE_GROUP --query "defaultHostname" -o tsv
```

**Notes:**
- 💡 Use deployment outputs to configure the front-end app (endpoint URLs, Entra app registration details).
- 💡 Add app settings or environment variables in the Static Web App configuration to store endpoint URLs and scopes.

## Configuration

### Core environment variables

| Setting | Value | Description |
|---------|-------|-------------|
| `AZURE_RESOURCE_GROUP` | ml-pipeline-rg | Resource group where all ML pipeline resources are deployed. |
| `AZURE_LOCATION` | westus2 | Azure region for all resources. Must match the deployment parameter. |
| `ML_ENVIRONMENT` | dev | Logical environment (dev/test/prod) used for naming and tagging. |
| `ML_BASENAME` | mlpipe | Base name prefix used in resource naming (e.g., storage account, AML workspace). Lowercase alphanumeric recommended. |

### Data & Feature Store

| Setting | Value | Description |
|---------|-------|-------------|
| `ML_STORAGE_ACCOUNT_NAME` | <output: storageAccountName> | Name of the storage account used for raw data, feature engineering outputs, and training data. |
| `ML_STORAGE_CONNECTION_STRING` | <from: az storage account show-connection-string> | Connection string used by Data Factory and AML jobs to access training and batch inference data. |
| `ML_FEATURES_COSMOS_URI` | <output: cosmosDbEndpoint> | Cosmos DB account endpoint used as online feature database. |
| `ML_FEATURES_COSMOS_KEY` | <output: cosmosDbKey> | Primary key for Cosmos DB used by feature store logic and AML online endpoint. |

### Azure Machine Learning

| Setting | Value | Description |
|---------|-------|-------------|
| `ML_WORKSPACE_NAME` | <output: amlWorkspaceName> | Azure Machine Learning workspace name for training, registry, and endpoints. |
| `ML_GPU_COMPUTE_NAME` | <output: amlGpuComputeName> | Name of AML managed compute cluster used for GPU training jobs. |
| `ML_ONLINE_ENDPOINT_NAME` | <output: amlOnlineEndpointName> | AML Online Endpoint name exposing the REST model server. |
| `ML_BATCH_ENDPOINT_NAME` | <output: amlBatchEndpointName> | AML Batch Endpoint used for batch scoring and A/B routing. |

### Web Application & Identity

| Setting | Value | Description |
|---------|-------|-------------|
| `WEB_STATIC_APP_URL` | <output: staticWebAppUrl> | Base URL of the Azure Static Web App serving the front-end. |
| `ENTRA_CLIENT_ID` | <Entra app registration client_id> | Microsoft Entra ID application (client) ID used by the static web app for authentication. |
| `ENTRA_TENANT_ID` | <Tenant ID> | Microsoft Entra ID tenant ID used for user sign-in and token acquisition. |
| `ML_API_SCOPE` | api://<api-app-id>/user_impersonation | Scope or audience for the AML endpoint-protecting API, used when requesting tokens from Entra ID. |

### Monitoring & Logging

| Setting | Value | Description |
|---------|-------|-------------|
| `LOG_ANALYTICS_WORKSPACE_ID` | <output: logAnalyticsWorkspaceId> | Log Analytics workspace resource ID used by Azure Monitor and AML diagnostics. |
| `LOG_ANALYTICS_CUSTOM_LOG_TABLE` | MLInferenceLogs | Logical table name for custom ML inference logs (if used). |
| `ALERT_LATENCY_THRESHOLD_MS` | 500 | Threshold for online prediction latency alerts. |
| `ALERT_ERROR_RATE_THRESHOLD` | 0.05 | Threshold for error rate alerts (5% in this example). |

## Post-Deployment Validation

- [ ] Use Azure Portal to verify that the resource group contains: Storage Account, Data Factory, AML Workspace (with managed compute and endpoints), Cosmos DB, Static Web App, Log Analytics workspace, and linked Azure Monitor diagnostic settings.
- [ ] From Azure Machine Learning Studio, confirm that the GPU compute cluster is available and that the workspace can access the storage account and Cosmos DB.
- [ ] Run a sample training job (e.g., via AML Studio or CLI) that reads training data from the Storage Account, trains a simple model, and registers it in the AML model registry.
- [ ] Deploy a sample model version to the AML Online Endpoint and call it using curl or Postman with an Entra ID token to verify end-to-end REST inference.
- [ ] Submit a batch scoring job to the AML Batch Endpoint that reads input data from Storage and writes outputs back to a designated container, validating the A/B routing logic if implemented.
- [ ] In Log Analytics, query the workspace for logs and metrics from the AML Online Endpoint (inference requests, latency, errors) and confirm Azure Monitor is ingesting telemetry.
- [ ] Access the Static Web App URL and verify that user authentication works via Microsoft Entra ID and that the app can successfully call the AML Online and Batch endpoints.

## Troubleshooting

**Issue:** Deployment fails with 'Resource provider is not registered' or 'InvalidResourceNamespace'.

**Solution:** Ensure all required resource providers are registered using az provider register (Microsoft.Storage, Microsoft.DataFactory, Microsoft.MachineLearningServices, Microsoft.DocumentDB, Microsoft.Web, Microsoft.Insights, Microsoft.OperationalInsights). Wait a few minutes after registration and re-run the deployment.

**Issue:** Storage account name or baseName is not globally unique or contains invalid characters.

**Solution:** Update the baseName parameter to a unique, lowercase alphanumeric string (e.g., mlpipe1234). Storage account names must be globally unique and 3-24 characters. Re-run deployment after changing baseName.

**Issue:** Azure Machine Learning workspace deployment succeeded, but Online/Batch endpoints did not deploy.

**Solution:** Check the deployment error details with az deployment group show. If the region does not support specific AML endpoint SKUs, change the location to a supported region or adjust endpoint configuration. Alternatively, create endpoints via AML CLI or Studio instead of ARM if needed.

**Issue:** Static Web App cannot reach AML Online Endpoint due to authentication or CORS errors.

**Solution:** Ensure the AML Online Endpoint has proper authentication configuration (AAD or managed identity). Configure CORS settings to allow the Static Web App origin. Verify that the front-end is including Entra ID access tokens in the Authorization header and that API scopes/audience match the Entra app registration.

**Issue:** Cosmos DB requests fail with 'Forbidden' or timeouts during feature retrieval.

**Solution:** Confirm that the Cosmos DB URI and key used by the feature store and AML endpoint match the deployment outputs. Ensure the correct database and container names are used. Check Cosmos DB firewall and network settings to allow access from AML and other components.

**Issue:** No logs or metrics visible in Log Analytics for the AML Online Endpoint.

**Solution:** Verify that diagnostic settings for the AML workspace and endpoints are configured to send logs and metrics to the Log Analytics workspace. Confirm that the logAnalyticsWorkspaceId in outputs is correct and that you are querying the correct workspace and tables. Allow a few minutes for data ingestion.

**Issue:** Data Factory pipeline cannot access Storage Account or returns authentication errors.

**Solution:** Check the linked service configuration in Data Factory for the Storage Account. Use managed identity where possible and assign Storage Blob Data Contributor role to the Data Factory managed identity on the storage account. Ensure the correct connection string or identity is used in activities.

---

*Generated: 2026-02-28, 2:35:22 p.m.*
