# Deploy ML Model Pipeline to Azure

## Overview

This guide deploys an end-to-end ML model pipeline to Azure using Bicep and Azure CLI. It provisions data prep (Storage + Data Factory), training (Azure Machine Learning workspace + GPU compute), serving (AML online and batch endpoints + Static Web Apps), a Cosmos DB–backed online feature store, and monitoring (Azure Monitor via Log Analytics).

**Estimated Time:** 60-90 minutes (infrastructure only; excludes model development and complex pipeline authoring).

**Estimated Cost:** Approximately $339.20/month for the reference configuration (single small GPU training cluster with low node count, serverless Cosmos DB, Standard Static Web App, and Log Analytics with 30-day retention). Actual costs vary with usage and sizing.

## Prerequisites

- Active Azure subscription with at least Contributor permissions on the target resource group (Owner or Contributor + User Access Administrator recommended).
- Azure CLI 2.50.0 or later installed (verify with: az --version).
- Bicep CLI available (bundled with Azure CLI 2.30+; verify with: az bicep version).
- Azure Machine Learning CLI extension installed/updated (az extension add -n ml --upgrade).
- Git installed if you plan to clone a repo for the Bicep files.
- Resource providers registered in the subscription: Microsoft.Storage, Microsoft.DataFactory, Microsoft.MachineLearningServices, Microsoft.DocumentDB, Microsoft.Web, Microsoft.OperationalInsights, Microsoft.Insights.
- Permissions in Microsoft Entra ID (Azure AD) to configure application authentication for the Static Web App (e.g., Application administrator or equivalent, or coordination with your identity team).

## Deployment Steps

### Step 1: Authenticate and select the target subscription

Sign in to Azure, select the subscription that will host the ML pipeline, and ensure the required resource providers are registered.

**Commands:**
```bash
az login
az account set --subscription <SUBSCRIPTION_ID>
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.DataFactory
az provider register --namespace Microsoft.MachineLearningServices
az provider register --namespace Microsoft.DocumentDB
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.Insights
```

**Notes:**
- 💡 Replace <SUBSCRIPTION_ID> with your target subscription ID.
- 💡 Provider registration is usually one-time per subscription; if already registered, these commands are no-ops.

### Step 2: Create (or choose) a resource group

Create the resource group that will contain all resources for this ML model pipeline.

**Commands:**
```bash
az group create --name rg-ml-pipeline-dev --location westeurope
```

**Notes:**
- 💡 Change rg-ml-pipeline-dev and westeurope to match your naming and regional standards.
- 💡 Use the same resource group name in subsequent deployment commands.

### Step 3: Prepare the Bicep templates locally

Create a folder and add the Bicep files (main.bicep and module files) from this guide.

**Commands:**
```bash
mkdir ml-pipeline-iac
cd ml-pipeline-iac
# Create main.bicep and the modules/ folder, then copy the Bicep content from this guide into those files.
```

**Notes:**
- 💡 Ensure the folder structure matches the filenames in this guide (e.g., modules/storage.bicep, modules/datafactory.bicep, etc.).

### Step 4: Validate the deployment with What-If

Run an Azure Resource Manager What-If deployment to preview the changes that will be made by the Bicep templates.

**Commands:**
```bash
az deployment group what-if --resource-group rg-ml-pipeline-dev --template-file main.bicep --parameters baseName=mlpipe environment=dev
```

**Notes:**
- 💡 Choose baseName so that the resulting storage account and Static Web App names are globally unique (3-11 lowercase alphanumeric characters).
- 💡 Review the what-if output carefully to ensure the changes match expectations.

### Step 5: Deploy the ML pipeline infrastructure

Deploy all core resources (storage, Data Factory, Azure ML workspace + GPU compute, Cosmos DB, AML endpoints, Static Web App, and Log Analytics) using the Bicep template.

**Commands:**
```bash
az deployment group create --resource-group rg-ml-pipeline-dev --template-file main.bicep --parameters baseName=mlpipe environment=dev
```

**Notes:**
- 💡 Deployment typically takes several minutes due to AML workspace and compute provisioning.
- 💡 If deployment fails, inspect the error details (provisioningState and error.message) in the CLI output or in the Azure Portal under the resource group deployments blade.

### Step 6: Verify core resources were created

Verify that the primary resources are present and reachable.

**Commands:**
```bash
az storage account show --name mlpipedevsa --resource-group rg-ml-pipeline-dev
az ml workspace show --name mlpipe-dev-mlw --resource-group rg-ml-pipeline-dev
az cosmosdb show --name mlpipedevcosmos --resource-group rg-ml-pipeline-dev
az staticwebapp show --name mlpipe-dev-swa --resource-group rg-ml-pipeline-dev
az monitor log-analytics workspace show --workspace-name mlpipe-dev-law --resource-group rg-ml-pipeline-dev
```

**Notes:**
- 💡 These names assume baseName=mlpipe and environment=dev. Adjust if you used different parameter values.
- 💡 For the Azure ML CLI commands, ensure the ml extension is installed (az extension list).

### Step 7: Bootstrap a sample model deployment (optional)

After the infrastructure is in place, you can deploy an initial model to the AML online endpoint for REST-based serving and (optionally) configure batch deployments.

**Commands:**
```bash
# Example: create a simple registered model (adjust paths and workspace parameters as needed)
az ml model create --name demo-model --version 1 --type custom_model --path ./model --workspace-name mlpipe-dev-mlw --resource-group rg-ml-pipeline-dev
# Example: create an online deployment (requires a YAML config with environment, code, and scoring script)
az ml online-deployment create --name blue --endpoint-name mlpipe-dev-online --file endpoint/online/blue-deployment.yml --all-traffic --workspace-name mlpipe-dev-mlw --resource-group rg-ml-pipeline-dev
```

**Notes:**
- 💡 These commands are examples; you must supply your own model artifacts, environment definition, and deployment YAML files.
- 💡 Batch endpoints can be configured similarly via az ml batch-endpoint and az ml batch-deployment commands once your batch scoring containers and data paths are defined.

### Step 8: Configure Entra ID authentication for the Static Web App

Wire up Microsoft Entra ID (Azure AD) authentication so your frontend can securely call the AML endpoints.

**Commands:**
```bash
# Configure AAD authentication in the Static Web App via the Azure Portal or ARM template (not fully automated in these Bicep files).
# In the Portal: Static Web App -> Authentication -> Add identity provider -> Microsoft -> Configure with a new or existing AAD app registration.
```

**Notes:**
- 💡 After configuring auth, your frontend should call the AML REST endpoints using access tokens obtained from Entra ID.
- 💡 Ensure CORS and network settings on the AML endpoints allow calls from the Static Web App origin.

## Configuration

### General Deployment Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `AZURE_SUBSCRIPTION_ID` | <your-subscription-id> | Subscription ID used for az account set and for billing of all resources in this deployment. |
| `AZURE_RESOURCE_GROUP` | rg-ml-pipeline-dev | Resource group that hosts the ML pipeline resources created by main.bicep. |
| `AZURE_LOCATION` | westeurope | Azure region for all resources. Must support Azure ML, Data Factory, Static Web Apps, Cosmos DB, and Log Analytics. |
| `ENVIRONMENT` | dev | Logical environment identifier (dev, test, prod) used in resource naming. |
| `BASE_NAME` | mlpipe | Base name prefix (3-11 lowercase alphanumeric chars) used to construct globally unique resources such as storage accounts and Static Web Apps. |

### Data Prep & Storage

| Setting | Value | Description |
|---------|-------|-------------|
| `STORAGE_ACCOUNT_NAME` | mlpipedevsa | Storage account used for raw data, engineered features, training data, and batch inference outputs. |
| `STORAGE_CONNECTION_STRING` | <from main.bicep output: storageAccountConnectionString> | Connection string used by Data Factory and ad-hoc tools to read/write blobs. |
| `CONTAINER_RAW_DATA` | raw-data | Blob container name used for ingesting raw data. |
| `CONTAINER_FEATURES` | features | Blob container for engineered features used during training. |
| `CONTAINER_TRAINING_DATA` | training-data | Blob container for curated training data sets fed into the GPU cluster. |
| `CONTAINER_BATCH_OUTPUT` | batch-output | Blob container where batch A/B inference jobs will write results. |

### Feature Store (Cosmos DB)

| Setting | Value | Description |
|---------|-------|-------------|
| `COSMOS_ACCOUNT_NAME` | mlpipedevcosmos | Cosmos DB account hosting the online feature store. |
| `COSMOS_FEATURE_DB` | featuresdb | Logical database within Cosmos DB for feature vectors. |
| `COSMOS_FEATURE_CONTAINER` | features | Container within featuresdb used for storing feature vectors keyed by featureKey. |
| `COSMOS_CONNECTION_STRING` | <from main.bicep output: cosmosConnectionString> | Connection string for services that query the online feature store (e.g., AML scoring code). |

### Training (Azure Machine Learning)

| Setting | Value | Description |
|---------|-------|-------------|
| `AML_WORKSPACE_NAME` | mlpipe-dev-mlw | Azure Machine Learning workspace representing the central training and registry environment. |
| `AML_GPU_COMPUTE_NAME` | gpu-cluster | AML-managed GPU compute cluster used for running training jobs. |
| `AML_EXPERIMENT_NAME` | ml-pipeline-experiments | Logical experiment name to use in training scripts for grouping runs within the workspace. |

### Serving (Online & Batch Endpoints)

| Setting | Value | Description |
|---------|-------|-------------|
| `AML_ONLINE_ENDPOINT_NAME` | mlpipe-dev-online | Online endpoint exposing a REST model server for real-time inference. |
| `AML_ONLINE_ENDPOINT_URL` | <from main.bicep output: amlOnlineEndpointUrl> | Computed scoring URL for the AML online endpoint used by applications and the Static Web App. |
| `AML_BATCH_ENDPOINT_NAME` | mlpipe-dev-batch | Batch endpoint that orchestrates batch A/B inference jobs and writes results to Storage. |
| `STATIC_WEBAPP_URL` | <from main.bicep output: staticWebAppUrl> | Public URL of the Azure Static Web App consumed by end users and client applications. |

### Monitoring & Retraining

| Setting | Value | Description |
|---------|-------|-------------|
| `LOG_ANALYTICS_WORKSPACE_ID` | <from main.bicep output: logAnalyticsWorkspaceId> | Resource ID of the Log Analytics workspace where Azure Monitor sends metrics and logs. |
| `LOG_ANALYTICS_WORKSPACE_NAME` | mlpipe-dev-law | Name of the Log Analytics workspace for querying telemetry and building dashboards/alerts. |
| `RETRAINING_TRIGGER_QUERY` | AzureMLOnlineEndpointRequestLogs | summarize count() by bin(TimeGenerated, 1h) | Example Kusto query pattern that can be used as a basis for alerts or retraining triggers (e.g., on drift or error rate). |

## Post-Deployment Validation

- [ ] Use the Azure Portal to confirm the presence of the Storage Account, Data Factory, Azure ML workspace, Cosmos DB account, Static Web App, and Log Analytics workspace in the target resource group.
- [ ] Open Azure Machine Learning studio for the workspace (mlpipe-dev-mlw), verify that the GPU compute cluster (gpu-cluster) is available, and run a small test training job that logs metrics and registers a model.
- [ ] Implement feature engineering pipelines in Azure Data Factory using the provided storage-linked service, and confirm they read from raw-data and write engineered features and training datasets to features and training-data containers.
- [ ] Deploy a test model to the AML online endpoint and invoke it using az ml online-endpoint invoke or curl to verify that the REST Model Server responds with predictions.
- [ ] Define and run a batch deployment for the AML batch endpoint, writing scores into the batch-output container, then check the files in the storage account.
- [ ] In the Log Analytics workspace, run basic Kusto queries over AML endpoint metrics (e.g., AzureMetrics or AzureMLOnlineEndpoint* tables) to confirm telemetry from Azure Monitor is flowing correctly.
- [ ] From the Static Web App, perform authenticated calls to the online endpoint using Entra ID tokens and verify that end-to-end requests succeed and are logged in Log Analytics.

## Troubleshooting

**Issue:** Deployment fails with AuthorizationFailed or insufficient permissions.

**Solution:** Ensure your user or service principal has at least Contributor rights on the target resource group. If role assignments are part of your extended templates, you may also need User Access Administrator. Re-run az login and az account set to confirm you are deploying to the correct subscription.

**Issue:** Deployment fails with StorageAccountNameAlreadyTaken or Static Web App name conflicts.

**Solution:** The storage account and static site hostnames must be globally unique. Change the baseName parameter to a more unique value (3-11 lowercase alphanumeric characters) and redeploy. For example, use a prefix that includes your team, project, or random suffix (e.g., mlpipeabc).

**Issue:** Azure ML workspace or compute creation fails due to unsupported region.

**Solution:** Not all regions support Azure Machine Learning and GPU SKUs. Check the supported regions for Azure ML and the chosen GPU VM size (e.g., Standard_NC6s_v3), then set the AZURE_LOCATION and resource group location to a supported region such as westeurope, northeurope, eastus, or westus2.

**Issue:** Static Web App or client receives 401/403 when calling AML online endpoint.

**Solution:** Verify that Microsoft Entra ID authentication is correctly configured on the Static Web App and that your frontend attaches a valid Bearer token in the Authorization header. Ensure the AML online endpoint authMode is set to AADToken (as in the Bicep template) and that the service principal or user has permission to invoke the endpoint. Confirm CORS settings on the endpoint are configured to allow the Static Web App origin.

**Issue:** No logs or metrics from AML online endpoint appear in Log Analytics.

**Solution:** Confirm that the diagnosticSettings resource for the AML online endpoint is present (aml-online-endpoint-diagnostics) and points to the correct Log Analytics workspace ID. Generate traffic to the endpoint, wait a few minutes, and then query the workspace. Also verify that Microsoft.Insights and Microsoft.OperationalInsights providers are registered and that there are no RBAC restrictions preventing the AML service from sending telemetry.

**Issue:** Data Factory pipelines cannot access blob containers (authorization errors).

**Solution:** In this simplified template, Data Factory uses a connection string-based linked service. Ensure the storageConnectionString passed into the deployment is valid (via storage module output) and that the key has not been rotated. If you prefer managed identity, grant the Data Factory managed identity the Storage Blob Data Contributor role on the storage account and update the linked service to use MSI-based authentication.

**Issue:** Cosmos DB feature store connection fails from model scoring code.

**Solution:** Make sure your scoring code uses the COSMOS_CONNECTION_STRING output by the deployment. Verify that the database (featuresdb) and container (features) names in the code match the Bicep template. Check that the partition key path /featureKey is used consistently when writing and reading feature documents.

---

*Generated: 2026-02-28, 2:47:10 p.m.*
