# Deploy ML Pipeline (Ingestion → Training → Inference) to Azure

## Overview

Deploys an end-to-end machine learning pipeline on Azure using Event Hubs for ingestion, Azure Functions for validation/enrichment, ADLS Gen2 for raw/curated/features, Azure Machine Learning for training and managed inference, App Service + API Management for an external inference API, Cosmos DB for prediction persistence, Key Vault for secrets, and Azure Monitor/Log Analytics/Application Insights for observability. Microsoft Entra ID is used for OAuth2/OIDC authentication to API Management.

**Estimated Time:** 45-90 minutes

**Estimated Cost:** $299.59/month

## Prerequisites

- Azure subscription
- Azure CLI 2.50+
- Azure CLI extensions: ml (for AML endpoint operations, optional), account, resource
- Permissions: Owner or Contributor on the target subscription/resource group; User Access Administrator (for role assignments); Application Administrator or Cloud Application Administrator in Entra ID (for app registration)
- Tools: Git, PowerShell or Bash, jq (recommended), zip utility (for Functions deployment)
- Optional: Azure Functions Core Tools (for local build/deploy), .NET/Node/Python tooling depending on your Functions/App Service runtime

## Deployment Steps

### Step 1: Set variables and sign in

Define deployment variables and authenticate to Azure. These variables are referenced by the CLI commands below.

**Commands:**
```bash
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"
export LOCATION="eastus"
export ENVIRONMENT="dev"
export PREFIX="mlpipe"
export RG_NAME="${PREFIX}-${ENVIRONMENT}-rg"
```

**Notes:**
- 💡 Use a short PREFIX (<= 8-10 chars) to avoid name-length constraints on some resources.
- 💡 Valid environment values in the Bicep are dev|test|prod.

### Step 2: Create resource group

Create the target resource group for the deployment.

**Commands:**
```bash
az group create --name "$RG_NAME" --location "$LOCATION"
```

**Notes:**
- 💡 If you deploy to an existing RG, ensure you have permissions to create role assignments and deploy Microsoft.MachineLearningServices resources.

### Step 3: Deploy infrastructure with Bicep

Deploy all platform services using a single main.bicep file that orchestrates modules for each service.

**Commands:**
```bash
az deployment group create --resource-group "$RG_NAME" --name "${PREFIX}-${ENVIRONMENT}-deploy" --template-file main.bicep --parameters environment="$ENVIRONMENT" location="$LOCATION" prefix="$PREFIX"
az deployment group show --resource-group "$RG_NAME" --name "${PREFIX}-${ENVIRONMENT}-deploy" --query properties.outputs -o json
```

**Notes:**
- 💡 Outputs include key endpoints/hostnames and Key Vault secret URIs for connection details.
- 💡 If deployment fails on APIM SKU capacity/region availability, switch APIM skuName in the module to Consumption (where supported) or another region.

### Step 4: Create Microsoft Entra ID application (OAuth2/OIDC) for API consumers

Create an app registration for API clients and capture the client ID/tenant. Configure APIM to validate JWTs from Entra ID. (Entra app registration is not reliably deployable via Bicep across tenants; use CLI.)

**Commands:**
```bash
export TENANT_ID=$(az account show --query tenantId -o tsv)
export API_APP_NAME="${PREFIX}-${ENVIRONMENT}-apim-api"
az ad app create --display-name "$API_APP_NAME" --sign-in-audience AzureADMyOrg --query "{appId:appId,id:id}" -o json
export API_CLIENT_ID=$(az ad app list --display-name "$API_APP_NAME" --query "[0].appId" -o tsv)
az ad sp create --id "$API_CLIENT_ID"
```

**Notes:**
- 💡 Next steps typically include: defining an Application ID URI, exposing scopes, creating client apps, and configuring APIM JWT validation policy.
- 💡 You can manage these via az ad app update / Microsoft Graph as needed.

### Step 5: Configure API Management (import API + JWT validation policy)

Create an API that routes to App Service and apply a validate-jwt policy that uses your Entra tenant and app registration. The APIM service is deployed by Bicep, but API definitions and policies are usually applied post-deploy.

**Commands:**
```bash
export APIM_NAME=$(az deployment group show -g "$RG_NAME" -n "${PREFIX}-${ENVIRONMENT}-deploy" --query "properties.outputs.apiManagementName.value" -o tsv)
export APIM_RG="$RG_NAME"
export APP_HOSTNAME=$(az deployment group show -g "$RG_NAME" -n "${PREFIX}-${ENVIRONMENT}-deploy" --query "properties.outputs.appServiceHostname.value" -o tsv)
az apim api create --resource-group "$APIM_RG" --service-name "$APIM_NAME" --api-id inference --path inference --display-name "Inference API" --protocols https --service-url "https://${APP_HOSTNAME}"
cat > apim-policy.xml << 'EOF'
<policies>
  <inbound>
    <base />
    <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized">
      <openid-config url="https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration" />
      <audiences>
        <audience>${API_CLIENT_ID}</audience>
      </audiences>
      <issuers>
        <issuer>https://login.microsoftonline.com/${TENANT_ID}/v2.0</issuer>
      </issuers>
    </validate-jwt>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
EOF
az apim api policy create --resource-group "$APIM_RG" --service-name "$APIM_NAME" --api-id inference --xml-policy @apim-policy.xml
```

**Notes:**
- 💡 Adjust the audience/issuer to match your Entra configuration and token version.
- 💡 For production, consider using APIM named values and certificates for advanced auth scenarios.

### Step 6: Deploy Function App code (ingestion validation/enrichment)

Publish your Azure Functions code. The infrastructure deploy creates the Function App; you supply the function code artifact.

**Commands:**
```bash
export FUNC_NAME=$(az deployment group show -g "$RG_NAME" -n "${PREFIX}-${ENVIRONMENT}-deploy" --query "properties.outputs.functionAppName.value" -o tsv)
# Example (zip deploy):
cd functions && zip -r ../functions.zip . && cd ..
az functionapp deployment source config-zip --resource-group "$RG_NAME" --name "$FUNC_NAME" --src functions.zip
```

**Notes:**
- 💡 Your function should use an Event Hub trigger and write to ADLS Gen2 paths for raw/curated/features.
- 💡 Prefer Key Vault references in app settings for any secrets.

### Step 7: Deploy App Service code (inference API backend)

Publish your inference API backend to the deployed Web App. The backend should call an Azure ML managed online endpoint and persist prediction context to Cosmos DB.

**Commands:**
```bash
export WEBAPP_NAME=$(az deployment group show -g "$RG_NAME" -n "${PREFIX}-${ENVIRONMENT}-deploy" --query "properties.outputs.appServiceName.value" -o tsv)
# Example (zip deploy):
cd app && zip -r ../app.zip . && cd ..
az webapp deployment source config-zip --resource-group "$RG_NAME" --name "$WEBAPP_NAME" --src app.zip
```

**Notes:**
- 💡 For calling AML online endpoints, use managed identity where possible; otherwise store endpoint keys in Key Vault and reference them from app settings.
- 💡 For Cosmos DB, store endpoint/key in Key Vault and use app settings Key Vault references.

### Step 8: Create Azure ML assets and (optional) managed online endpoint

The Bicep deploys the AML workspace and connects it to ACR/Storage/Key Vault/App Insights. Create pipelines, compute, environments, and optionally a managed online endpoint using the Azure ML CLI extension.

**Commands:**
```bash
az extension add -n ml -y || true
export AML_WORKSPACE=$(az deployment group show -g "$RG_NAME" -n "${PREFIX}-${ENVIRONMENT}-deploy" --query "properties.outputs.amlWorkspaceName.value" -o tsv)
az configure --defaults group="$RG_NAME" workspace="$AML_WORKSPACE" location="$LOCATION"
# Example placeholders (requires aml folder with YAML):
# az ml compute create -f aml/compute.yml
# az ml job create -f aml/train-pipeline.yml
# az ml online-endpoint create -f aml/online-endpoint.yml
# az ml online-deployment create -f aml/online-deployment.yml --all-traffic
```

**Notes:**
- 💡 End-to-end AML endpoint deployment is typically application-specific; keep infrastructure in Bicep and ML assets in AML YAML.

## Configuration

### Environment variables (CLI)

| Setting | Value | Description |
|---------|-------|-------------|
| `LOCATION` | eastus | Azure region for deployment. |
| `ENVIRONMENT` | dev | Environment tag and naming (dev|test|prod). |
| `PREFIX` | mlpipe | Short naming prefix for resources. |
| `RG_NAME` | mlpipe-dev-rg | Target resource group name. |

### App Service settings (recommended)

| Setting | Value | Description |
|---------|-------|-------------|
| `KEYVAULT_URI` | https://<kv-name>.vault.azure.net/ | Key Vault URI used by the app for secret retrieval. |
| `COSMOS_ENDPOINT` | @Microsoft.KeyVault(SecretUri=<secret-uri>) | Cosmos DB endpoint stored in Key Vault (Key Vault reference). |
| `COSMOS_KEY` | @Microsoft.KeyVault(SecretUri=<secret-uri>) | Cosmos DB primary key stored in Key Vault (Key Vault reference). |
| `AML_ENDPOINT_URL` | https://<your-aml-online-endpoint>.<region>.inference.ml.azure.com/score | Managed online endpoint scoring URL (set after endpoint creation). |
| `AML_ENDPOINT_KEY` | @Microsoft.KeyVault(SecretUri=<secret-uri>) | AML endpoint key stored in Key Vault (if not using managed identity). |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | <set by Bicep> | App Insights connection string for telemetry; Bicep sets this automatically. |

### Function App settings (recommended)

| Setting | Value | Description |
|---------|-------|-------------|
| `KEYVAULT_URI` | https://<kv-name>.vault.azure.net/ | Key Vault URI used by Functions for secret retrieval. |
| `EVENTHUB_CONNECTION` | @Microsoft.KeyVault(SecretUri=<secret-uri>) | Event Hubs listen connection string stored in Key Vault (Key Vault reference). |
| `EVENTHUB_NAME` | <eventhub-name> | Event Hub name for trigger binding. |
| `ADLS_ACCOUNT_NAME` | <storage-account-name> | ADLS Gen2 account name for writing raw/curated/features. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | <set by Bicep> | App Insights connection string for telemetry; Bicep sets this automatically. |

## Post-Deployment Validation

- [ ] Verify resource provisioning: az resource list -g <rg> -o table
- [ ] Check App Service health: browse https://<appServiceHostname>/health (implement a health endpoint in your API)
- [ ] Check Function triggers and logs: az functionapp log tail -g <rg> -n <functionAppName>
- [ ] Confirm ADLS containers (raw/curated/features) exist and data is written
- [ ] Validate Cosmos DB database/container exist and can persist prediction records
- [ ] Validate APIM gateway endpoint routes to App Service and returns expected responses
- [ ] Confirm Application Insights receives telemetry for both Function App and App Service
- [ ] Use Log Analytics to run cross-service queries and correlate traces/dependencies
- [ ] Configure additional Azure Monitor alerts/dashboards based on SLOs (latency, error rates, ingestion lag)

## Troubleshooting

**Issue:** Bicep deployment fails creating API Management due to region/SKU capacity constraints

**Solution:** Change the APIM skuName to a supported SKU in your region (Developer/Basic/Standard) or deploy APIM to a different region. Re-run deployment.

**Issue:** Function App Event Hub trigger not firing

**Solution:** Confirm the Function App app settings include EVENTHUB_CONNECTION and EVENTHUB_NAME, and that the managed identity has 'Azure Event Hubs Data Receiver' on the Event Hubs namespace. Ensure the consumer group exists and the function bindings match.

**Issue:** 403 when Functions/App Service try to read Key Vault secrets

**Solution:** Ensure Key Vault is using RBAC (enableRbacAuthorization=true) and role assignments exist: 'Key Vault Secrets User' for the system-assigned identities. Also ensure network restrictions (firewall/private endpoints) are not blocking access.

**Issue:** App Service cannot write to Cosmos DB

**Solution:** If using key-based auth, verify Cosmos endpoint/key are correct in Key Vault and referenced correctly in app settings. If using RBAC data plane, ensure appropriate Cosmos DB data roles are assigned to the managed identity.

**Issue:** No telemetry in Application Insights

**Solution:** Verify APPLICATIONINSIGHTS_CONNECTION_STRING is set. For Functions, ensure host.json/log level settings allow telemetry. For App Service, ensure the SDK/agent is enabled and outbound connectivity to Azure Monitor endpoints is allowed.

**Issue:** AML workspace deploy succeeds but model endpoint creation fails

**Solution:** AML endpoints are typically created via AML CLI/YAML and require specific roles and quota. Verify you have permissions (Contributor on AML workspace), compute quota in the region, and that the ml extension is installed/updated.

---

*Generated: 2026-02-01, 4:17:29 p.m.*
