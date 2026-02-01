# Deploy Machine Learning Pipeline to Azure

## Overview

This guide details deploying a scalable machine learning pipeline comprising data ingestion, training, and inference endpoints using key Azure services such as Event Hubs, Data Lake Storage, Azure Machine Learning, Container Registry, API Management, Key Vault, Microsoft Entra ID, and Application Insights.

**Estimated Time:** 45-60 minutes

**Estimated Cost:** $275.60/month

## Prerequisites

- Azure subscription with sufficient quota
- Azure CLI version 2.50 or higher
- User with Contributor role or higher on the target subscription
- Azure Machine Learning extension for Azure CLI (az extension add --name aml)
- Docker installed locally (for building container images)
- Access to Microsoft Entra ID to register and configure applications
- Permissions to create resources and assign roles

## Deployment Steps

### Step 1: Login and Select Subscription

Authenticate to Azure CLI and set the target subscription.

**Commands:**
```bash
az login
az account set --subscription <SUBSCRIPTION_ID>
```

**Notes:**
- 💡 Ensure you have proper access and the subscription ID is correct.

### Step 2: Create Resource Group

Create a dedicated resource group to logically organize all resources.

**Commands:**
```bash
az group create --name ml-pipeline-rg --location eastus
```

**Notes:**
- 💡 Replace 'eastus' with your preferred Azure region.

### Step 3: Deploy Infrastructure with Bicep

Deploy all infrastructure components via the main Bicep template.

**Commands:**
```bash
az deployment group create --resource-group ml-pipeline-rg --template-file main.bicep --parameters environment=prod location=eastus
```

**Notes:**
- 💡 The deployment creates Event Hubs namespace, Data Lake Storage Gen2, AML workspace, Container Registry, API Management, Key Vault, Application Insights, and configures Microsoft Entra ID.

### Step 4: Register Azure ML Workspace and Environments

Configure Azure Machine Learning workspace and environments post-deployment.

**Commands:**
```bash
az ml workspace show -n ml-workspace -g ml-pipeline-rg
az ml environment create --file environment.yml --name ml-env
```

**Notes:**
- 💡 Create or upload your training environment YAML separately.

### Step 5: Publish Training Model and Deploy Inference Container

Train model, build container image, push to Container Registry, and deploy inference service to AML.

**Commands:**
```bash
# Build and push container image
docker build -t <acr_login_server>/ml-model:latest .
docker push <acr_login_server>/ml-model:latest
# Deploy model endpoint
az ml model register -n my-model -p ./model
az ml online-endpoint create -n ml-inference-endpoint -f endpoint.yml
```

**Notes:**
- 💡 Replace <acr_login_server> with your Azure Container Registry login server.
- 💡 Use AML CLI v2 features for deployment automation.

### Step 6: Configure API Management and Microsoft Entra ID

Set up API Management with authentication against Microsoft Entra ID and link it to AML inference endpoint.

**Commands:**
```bash
az apim api create --service-name ml-apim --resource-group ml-pipeline-rg --api-id ml-inference-api --display-name 'ML Inference API' --path inference
az ad app create --display-name 'ML API Client'
az apim api operation update --api-id ml-inference-api --service-name ml-apim --resource-group ml-pipeline-rg --operation-id post --authentication-settings '{"openidConfig": "https://login.microsoftonline.com/<tenant_id>/v2.0/.well-known/openid-configuration", "bearerTokenSendingMethods": ["authorizationHeader"]}'
```

**Notes:**
- 💡 Replace <tenant_id> with your Microsoft Entra ID tenant ID.
- 💡 Configure API scopes and permissions as needed.

### Step 7: Verify Logging with Application Insights

Ensure API Management and AML components send telemetry data to Application Insights.

**Commands:**
```bash
az monitor app-insights component show --app ml-appinsights --resource-group ml-pipeline-rg
az monitor diagnostic-settings create --resource ml-apim --resource-group ml-pipeline-rg --workspace ml-appinsights --name apim-logs --logs '[{"category": "GatewayLogs", "enabled": true}]'
```

**Notes:**
- 💡 Adjust diagnostic settings to cover necessary Azure services.

## Configuration

### Environment Variables

| Setting | Value | Description |
|---------|-------|-------------|
| `AZURE_LOCATION` | eastus | Azure region where resources are deployed |
| `RESOURCE_GROUP` | ml-pipeline-rg | Resource group name for deployment |
| `AML_WORKSPACE_NAME` | ml-workspace | Azure ML workspace name |
| `ACR_NAME` | mlpipelineacr | Azure Container Registry name |
| `EVENTHUB_NAMESPACE` | ml-eventhubns | Event Hubs namespace |
| `APIM_NAME` | ml-apim | API Management service name |
| `APPINSIGHTS_NAME` | ml-appinsights | Application Insights resource name |
| `KEYVAULT_NAME` | ml-keyvault | Key Vault resource name |

## Post-Deployment Validation

- [ ] Use `az ml workspace show` to confirm Azure ML workspace readiness.
- [ ] Validate Event Hubs and Data Lake Storage by sending and retrieving sample events/data.
- [ ] Test the deployed inference API endpoint via API Management with authenticated calls.
- [ ] Check Application Insights for telemetry and logging from API Management and AML endpoints.
- [ ] Use Azure Portal or CLI to confirm all resources are deployed and connected.

## Troubleshooting

**Issue:** Deployment fails due to permission errors

**Solution:** Ensure your account has Contributor or Owner role on the target subscription and resource group.

**Issue:** Container image push fails

**Solution:** Verify Docker login to Azure Container Registry: `az acr login --name <acr_name>`; check image tags and network connectivity.

**Issue:** API Management cannot authenticate against Microsoft Entra ID

**Solution:** Ensure correct application registration and API permissions; verify tenant ID and client secrets.

**Issue:** AML workspace cannot access Data Lake Storage

**Solution:** Check managed identity permissions on Data Lake; assign Storage Blob Data Contributor role.

---

*Generated: 2026-02-01, 3:59:14 p.m.*
