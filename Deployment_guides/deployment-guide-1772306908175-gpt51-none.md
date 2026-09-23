# Deploy ML Model Pipeline to Azure

## Overview

This guide deploys an end-to-end ML model pipeline on Azure including data prep, training, feature store, online and batch serving, monitoring, and a simple web front-end. It uses Azure Storage, Data Factory, Azure Machine Learning (workspace, managed compute, endpoints), Cosmos DB, Azure Static Web Apps, Microsoft Entra ID integration, Azure Monitor, and Log Analytics, all provisioned via Bicep.

**Estimated Time:** 60-90 minutes

**Estimated Cost:** $300-400/month (approx. $339.20 with small GPU cluster, low-throughput Cosmos DB, and light AML usage)

## Prerequisites

- Azure subscription with Owner or Contributor + User Access Administrator on the target resource group
- Azure CLI 2.50+ (with `bicep` installed: `az bicep install`)
- Permissions to register resource providers: Microsoft.MachineLearningServices, Microsoft.Insights, Microsoft.DocumentDB, Microsoft.Web, Microsoft.DataFactory
- Git installed (for managing Bicep templates and source code)
- Configured Microsoft Entra tenant with rights to create app registrations (for Static Web App -> API auth)
- Python 3.9+ and Azure ML Python SDK (optional, for training and deployment scripts)
- Storage Explorer / Azure Portal access (optional, for manual inspection)
- Network egress to Azure public endpoints (or configure private endpoints separately)

## Deployment Steps

### Step 1: Login and prepare resource group

Authenticate to Azure, select the subscription, and create (or reuse) a resource group for the ML pipeline.

**Commands:**
```bash
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"
az group create -n ml-pipeline-rg -l eastus
```

**Notes:**
- 💡 Replace <SUBSCRIPTION_ID_OR_NAME> with your subscription.
- 💡 Choose the same location for all resources to minimize data transfer latency.

### Step 2: Set environment variables

Configure shell variables used by subsequent Azure CLI and Bicep commands.

**Commands:**
```bash
RESOURCE_GROUP="ml-pipeline-rg"
LOCATION="eastus"
ENVIRONMENT="dev"
UNIQUE_SUFFIX="$(xxd -l 3 -p /dev/urandom 2>/dev/null || openssl rand -hex 3)"
DEPLOY_NAME="ml-pipeline-${ENVIRONMENT}-${UNIQUE_SUFFIX}"
```

**Notes:**
- 💡 UNIQUE_SUFFIX helps make globally unique names for storage and static web apps.
- 💡 For Windows PowerShell, use `$env:RESOURCE_GROUP = "ml-pipeline-rg"` style instead.

### Step 3: Create and review Bicep templates

Create a deployment folder and add the provided Bicep files: main.bicep and supporting modules.

**Commands:**
```bash
mkdir ml-pipeline-deploy
cd ml-pipeline-deploy
echo "<paste main.bicep content here>" > main.bicep
echo "<paste modules/storage.bicep here>" > modules.storage.bicep
echo "<paste modules/adf.bicep here>" > modules.adf.bicep
echo "<paste modules/aml.bicep here>" > modules.aml.bicep
echo "<paste modules/cosmos.bicep here>" > modules.cosmos.bicep
echo "<paste modules/monitoring.bicep here>" > modules.monitoring.bicep
echo "<paste modules/staticweb.bicep here>" > modules.staticweb.bicep
```

**Notes:**
- 💡 Keep all Bicep files in the same directory; filenames in this guide match the `module` declarations.
- 💡 Alternatively, store them in a Git repository and clone instead of echoing.

### Step 4: Run Bicep validation and deployment

Validate the deployment, then deploy the full ML pipeline infrastructure.

**Commands:**
```bash
az bicep build --file main.bicep
az deployment group what-if \
  --resource-group $RESOURCE_GROUP \
  --name ${DEPLOY_NAME}-preview \
  --template-file main.bicep \
  --parameters env=$ENVIRONMENT location=$LOCATION uniqueSuffix=$UNIQUE_SUFFIX
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --name $DEPLOY_NAME \
  --template-file main.bicep \
  --parameters env=$ENVIRONMENT location=$LOCATION uniqueSuffix=$UNIQUE_SUFFIX
```

**Notes:**
- 💡 Review the `what-if` output to ensure only expected resources will be created or changed.
- 💡 Deployment may take 10–20 minutes, especially for Azure Machine Learning and Data Factory.

### Step 5: Retrieve deployment outputs (endpoints & connection strings)

Fetch important outputs such as AML workspace name, endpoints, and Cosmos DB connection information.

**Commands:**
```bash
OUTPUTS_JSON=$(az deployment group show -g $RESOURCE_GROUP -n $DEPLOY_NAME --query properties.outputs -o json)
echo $OUTPUTS_JSON | jq '.'
AML_WORKSPACE_NAME=$(echo $OUTPUTS_JSON | jq -r '.amlWorkspaceName.value')
COSMOS_CONN_STRING=$(echo $OUTPUTS_JSON | jq -r '.cosmosDbConnectionString.value')
ONLINE_ENDPOINT_NAME=$(echo $OUTPUTS_JSON | jq -r '.amlOnlineEndpointName.value')
BATCH_ENDPOINT_NAME=$(echo $OUTPUTS_JSON | jq -r '.amlBatchEndpointName.value')
STATIC_WEB_APP_URL=$(echo $OUTPUTS_JSON | jq -r '.staticWebAppUrl.value')
```

**Notes:**
- 💡 Install `jq` for JSON parsing or inspect outputs directly from the Azure Portal if preferred.
- 💡 These outputs are needed for application configuration and AML SDK-based deployments.

### Step 6: Configure Microsoft Entra ID and Static Web App auth

Create an Entra app registration for the front-end, configure authentication, and grant API permissions.

**Commands:**
```bash
APP_NAME="ml-pipeline-web-${ENVIRONMENT}-${UNIQUE_SUFFIX}"
az ad app create --display-name $APP_NAME --sign-in-audience "AzureADMyOrg"
APP_ID=$(az ad app list --display-name $APP_NAME --query "[0].appId" -o tsv)
echo "Entra app (client) ID: $APP_ID"
# Static Web App auth is primarily configured via the portal or staticwebapp.config.json; use the portal to bind the Entra app to the Static Web App.
```

**Notes:**
- 💡 Use Azure Portal -> Static Web App -> Authentication to bind the Entra app and configure login.
- 💡 Configure roles/claims if you need role-based access control to model APIs.

### Step 7: Connect Data Factory to storage and AML

In Data Factory, create linked services and datasets for the raw data store, feature engineering, and training data.

**Commands:**
```bash
# Open Data Factory Studio for your ADF instance:
echo "Navigate to: https://adf.azure.com"
# In the UI, create:
# 1) Linked service to the Storage Account using the connection string output.
# 2) Pipelines for Raw -> Features -> Training Data.
# 3) Optionally, an AzureML linked service for invoking training or batch scoring pipelines.
```

**Notes:**
- 💡 Use key vault or managed identity for secure ADF credentials.
- 💡 Map the logical stages (Raw Data Store, Feature Engineering, Training Data) to ADF pipelines and datasets.

### Step 8: Create AML compute cluster and register model

Use the Azure ML workspace to create GPU compute, run training, register models, and define feature store assets.

**Commands:**
```bash
az extension add -n ml -y
az ml workspace show -n $AML_WORKSPACE_NAME -g $RESOURCE_GROUP
# Create a GPU compute cluster:
az ml compute create \
  --name gpu-cluster \
  --size Standard_NC6s_v3 \
  --type amlcompute \
  --min-instances 0 \
  --max-instances 2 \
  --idle-time-before-scale-down 600 \
  -g $RESOURCE_GROUP \
  -w $AML_WORKSPACE_NAME
# Training, feature store registration, and model registration typically done via SDK:
echo "Use Azure ML SDK or UI to: run training; log experiments; register models; publish features to the feature store."
```

**Notes:**
- 💡 Choose compute size according to your training needs and budget.
- 💡 Use AML feature store (preview/GA depending on region) to align with the diagram’s Feature Store component.

### Step 9: Deploy models to AML Online and Batch endpoints

Create or update AML endpoints for REST (online) and batch inference, mapping to Online Endpoint and Batch Endpoint in the diagram.

**Commands:**
```bash
# Example (simplified) online endpoint creation with a blue/green deployment:
az ml online-endpoint create \
  --name $ONLINE_ENDPOINT_NAME \
  --auth-mode aml_token \
  -g $RESOURCE_GROUP -w $AML_WORKSPACE_NAME
# Attach model and environment (replace placeholders with your artifacts):
az ml online-deployment create \
  --name blue \
  --endpoint $ONLINE_ENDPOINT_NAME \
  --model azureml:<your-model-name>:1 \
  --instance-type Standard_DS3_v2 \
  --instance-count 1 \
  -g $RESOURCE_GROUP -w $AML_WORKSPACE_NAME
az ml online-endpoint update \
  --name $ONLINE_ENDPOINT_NAME \
  --traffic "blue=100" \
  -g $RESOURCE_GROUP -w $AML_WORKSPACE_NAME
# Example batch endpoint:
az ml batch-endpoint create \
  --name $BATCH_ENDPOINT_NAME \
  -g $RESOURCE_GROUP -w $AML_WORKSPACE_NAME
az ml batch-deployment create \
  --name ab-deployment \
  --endpoint $BATCH_ENDPOINT_NAME \
  --model azureml:<your-model-name>:1 \
  --compute gpu-cluster \
  -g $RESOURCE_GROUP -w $AML_WORKSPACE_NAME
```

**Notes:**
- 💡 Configure traffic routing across multiple batch deployments to implement A/B logic (e.g., 50/50).
- 💡 Set endpoint auth mode to `aad_token` if you want to call endpoints directly from Static Web Apps using Entra tokens.

### Step 10: Wire up monitoring and retraining loop

Ensure AML Online Endpoint metrics are sent to Azure Monitor and Log Analytics, and configure alerts and retraining triggers.

**Commands:**
```bash
# AML endpoints emit metrics and logs to Log Analytics when diagnostic settings are enabled (configured in the Bicep template).
# Validate in portal: Monitor -> Logs and query using Kusto.
echo "Use Log Analytics queries and Azure Monitor alerts to trigger retraining via AML pipelines or Logic Apps."
```

**Notes:**
- 💡 Configure alert rules on latency, error rate, or feature drift metrics and trigger AML pipeline runs via webhooks or Event Grid.
- 💡 Use the monitoring data store (Log Analytics + Storage outputs from batch jobs) as inputs to new training data in Data Factory.

## Configuration

### Global Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `ENVIRONMENT` | dev | test | prod | Deployment environment identifier, used in naming and tagging resources. |
| `LOCATION` | eastus | Azure region for all resources. Choose a region supporting AML, Cosmos DB, and Static Web Apps. |
| `UNIQUE_SUFFIX` | random 3-byte hex (e.g., a3f9c1) | Short unique suffix to avoid name collisions for globally unique services like Storage and Static Web Apps. |

### Storage & Data Prep

| Setting | Value | Description |
|---------|-------|-------------|
| `rawContainerName` | raw | Blob container for raw, unprocessed data. |
| `featureContainerName` | features | Blob container for engineered features. |
| `trainingContainerName` | training | Blob container for curated training datasets. |

### Azure Machine Learning & Compute

| Setting | Value | Description |
|---------|-------|-------------|
| `amlWorkspaceName` | mlw-<env>-<suffix> | Azure Machine Learning workspace that hosts experiments, models, and feature store assets. |
| `gpuClusterName` | gpu-cluster | Managed AML compute cluster for GPU-accelerated training jobs. |
| `amlOnlineEndpointName` | online-endpoint-<env> | AML Online Endpoint name for real-time REST prediction serving. |
| `amlBatchEndpointName` | batch-endpoint-<env> | AML Batch Endpoint name for batch inference and A/B testing. |

### Feature Store & Cosmos DB

| Setting | Value | Description |
|---------|-------|-------------|
| `cosmosDbAccountName` | cosmos-<env>-<suffix> | Cosmos DB account storing online features and keys for low-latency lookups. |
| `cosmosDbDatabaseName` | featurestoredb | Database for feature collections. |
| `cosmosDbContainerName` | features | Container storing online feature vectors keyed by entity IDs. |

### Web Front-End & Auth

| Setting | Value | Description |
|---------|-------|-------------|
| `staticWebAppName` | ml-web-<env>-<suffix> | Azure Static Web App hosting the UI that calls AML endpoints. |
| `entraClientId` | <guid> | Microsoft Entra app registration client ID used by Static Web App for authentication. |
| `entraTenantId` | <guid> | Azure AD tenant ID. Used for validating issued tokens. |

### Monitoring & Logging

| Setting | Value | Description |
|---------|-------|-------------|
| `logAnalyticsWorkspaceName` | law-ml-<env>-<suffix> | Log Analytics workspace collecting logs and metrics from AML endpoints, Data Factory, and other services. |
| `azureMonitorAlerts` | enabled | Enable alert rules for latency, error rate, and feature drift thresholds on AML Online Endpoint metrics. |

## Post-Deployment Validation

- [ ] Open Azure Machine Learning studio for the deployed workspace and verify that the workspace, compute targets, and model registry are available.
- [ ] Verify the Storage Account has containers for raw, features, and training data and that Data Factory pipelines can read/write to them.
- [ ] Confirm Cosmos DB account, database, and container exist for the feature store; test read/write using Data Explorer.
- [ ] Check AML Online and Batch endpoints exist via `az ml online-endpoint list` and `az ml batch-endpoint list` and can serve test requests.
- [ ] Browse to the Static Web App URL output and confirm authentication via Microsoft Entra ID and successful API calls to the online endpoint.
- [ ] Use Azure Monitor and Log Analytics to query logs from AML Online Endpoint and confirm metrics like latency and error rate are flowing.
- [ ] Validate that diagnostic settings are configured for AML workspace and endpoints to send telemetry to Log Analytics.

## Troubleshooting

**Issue:** Bicep deployment fails with authorization or provider registration errors

**Solution:** Ensure your account has at least Contributor + User Access Administrator on the subscription or resource group. Run `az provider register --namespace Microsoft.MachineLearningServices` and similarly for Microsoft.Insights, Microsoft.DocumentDB, Microsoft.Web, Microsoft.DataFactory, then retry the deployment.

**Issue:** Storage account or Static Web App name conflicts (already taken)

**Solution:** Update the `uniqueSuffix` parameter to another random value and re-run the deployment. Globally unique resources like Storage and Static Web Apps require distinct names across Azure.

**Issue:** AML online endpoint returns 401 Unauthorized when called from Static Web App

**Solution:** Ensure the online endpoint `auth-mode` matches your calling pattern. For AAD-based auth, set `auth-mode aad_token`, configure access policies for the Entra app/service principal calling the endpoint, and ensure access tokens are attached in the Authorization header (`Bearer <token>`). Verify clock skew and token audience/issuer.

**Issue:** Cosmos DB connection failures from AML Online Endpoint

**Solution:** Verify the Cosmos DB connection string in AML environment or code is correct and uses TLS. Check that the endpoint and account keys are up to date. If using firewall or private endpoints, ensure the AML endpoint network is allowed to reach Cosmos DB.

**Issue:** No logs or metrics appear in Log Analytics for AML endpoints

**Solution:** Confirm diagnostic settings on the AML workspace and endpoints are enabled and pointing to the correct Log Analytics workspace. It may take a few minutes for logs to appear; run simple test requests against the endpoint to generate traffic, then query again.

**Issue:** GPU cluster fails to scale or training jobs stay queued

**Solution:** Check the AML compute quota for your subscription/region (e.g., NC-series). Increase quota via Azure Portal if needed or choose a different VM size. Verify that the compute target name in your training job configuration matches the deployed compute cluster.

**Issue:** Data Factory cannot access Storage or AML workspace

**Solution:** If using managed identity, grant the ADF managed identity appropriate roles on the Storage Account (e.g., Storage Blob Data Contributor) and AML workspace (e.g., Contributor or custom role). Re-authenticate linked services in Data Factory Studio.

---

*Generated: 2026-02-28, 2:28:12 p.m.*
