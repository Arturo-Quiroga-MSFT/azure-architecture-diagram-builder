# Deploy ML Pipeline (Ingestion, Training, Inference) to Azure

## Overview

This guide deploys an end-to-end machine learning pipeline on Azure: streaming ingestion (Event Hubs) to Data Lake, orchestration (Data Factory), model training + managed online inference (Azure Machine Learning), and an inference API surface (API Management -> App Service/Functions) with centralized secrets (Key Vault) and observability (Application Insights + Log Analytics). Microsoft Entra ID is used for OAuth2/OIDC auth to the inference API.

**Estimated Time:** 60-120 minutes

**Estimated Cost:** $302.27/month

## Prerequisites

- Azure subscription with permissions to create resource groups and deploy resources (Owner or Contributor) plus User Access Administrator for role assignments
- Azure CLI 2.50+ (recommended latest)
- Bicep CLI (az bicep install) or Azure CLI with Bicep support
- Providers registered: Microsoft.Storage, Microsoft.EventHub, Microsoft.KeyVault, Microsoft.Web, Microsoft.Insights, Microsoft.OperationalInsights, Microsoft.ContainerRegistry, Microsoft.MachineLearningServices, Microsoft.DataFactory, Microsoft.DocumentDB, Microsoft.ApiManagement
- For Entra ID (OAuth2/OIDC): permission to create App Registrations (Application Administrator or equivalent) if you will automate with az ad
- Optional: jq for parsing CLI output

## Deployment Steps

### Step 1: Set shell variables

Define naming and deployment variables. Use a short, globally-unique prefix for DNS-based resources (App Service, APIM).

**Commands:**
```bash
export SUBSCRIPTION_ID="<subscription-guid>"
export LOCATION="eastus"
export ENV="dev"  # dev|test|prod
export PREFIX="mlpipe"  # change to your org/app short name
export RG_NAME="rg-${PREFIX}-${ENV}-${LOCATION}"
```

**Notes:**
- 💡 Choose a LOCATION where all services are available (APIM, AML, etc.).
- 💡 Keep PREFIX <= ~10 chars to avoid name length issues.

### Step 2: Login and select subscription

Authenticate to Azure and target the correct subscription.

**Commands:**
```bash
az login
az account set --subscription "$SUBSCRIPTION_ID"
az account show -o table
```

**Notes:**
- 💡 If you use multiple tenants, add: az login --tenant <tenantId>.

### Step 3: Register required resource providers

Ensure all required Azure providers are registered.

**Commands:**
```bash
for p in Microsoft.Storage Microsoft.EventHub Microsoft.KeyVault Microsoft.Web Microsoft.Insights Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.MachineLearningServices Microsoft.DataFactory Microsoft.DocumentDB Microsoft.ApiManagement; do az provider register --namespace $p; done
az provider list --query "[?registrationState=='Registered'].namespace" -o tsv | sort
```

**Notes:**
- 💡 Provider registration can take several minutes; rerun deployment if you get 'provider not registered' errors.

### Step 4: Create resource group

Create the resource group where resources will be deployed.

**Commands:**
```bash
az group create -n "$RG_NAME" -l "$LOCATION"
```

**Notes:**
- 💡 If you have a standardized RG naming scheme, adjust RG_NAME.

### Step 5: Deploy infrastructure with Bicep

Deploy all Azure services (except Entra app registrations) using main.bicep and modules.

**Commands:**
```bash
az deployment group create \
  -g "$RG_NAME" \
  -n "deploy-${PREFIX}-${ENV}" \
  -f main.bicep \
  -p environment="$ENV" location="$LOCATION" prefix="$PREFIX"
```

**Notes:**
- 💡 If deployment fails due to naming conflicts, change PREFIX and redeploy.
- 💡 APIM Developer SKU can take 30-60 minutes to provision.

### Step 6: Create Microsoft Entra ID app registrations (OAuth2/OIDC) for API clients

Create an Entra app registration to represent the API and optionally a client application. Bicep/ARM cannot fully automate all Entra objects reliably; use CLI.

**Commands:**
```bash
export TENANT_ID=$(az account show --query tenantId -o tsv)
export API_APP_NAME="api-${PREFIX}-${ENV}"
export CLIENT_APP_NAME="client-${PREFIX}-${ENV}"

# Create API app registration
API_APP_ID=$(az ad app create --display-name "$API_APP_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)
API_APP_OBJECT_ID=$(az ad app show --id "$API_APP_ID" --query id -o tsv)

# Expose an API scope
SCOPE_ID=$(uuidgen)
az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/applications/${API_APP_OBJECT_ID}" --headers 'Content-Type=application/json' --body @- <<EOF
{
  "api": {
    "requestedAccessTokenVersion": 2,
    "oauth2PermissionScopes": [
      {
        "id": "${SCOPE_ID}",
        "adminConsentDescription": "Access the inference API",
        "adminConsentDisplayName": "Inference API access",
        "userConsentDescription": "Access the inference API",
        "userConsentDisplayName": "Inference API access",
        "value": "inference.read",
        "type": "User",
        "isEnabled": true
      }
    ]
  }
}
EOF

# Create client app registration (optional, for testing)
CLIENT_APP_ID=$(az ad app create --display-name "$CLIENT_APP_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)
CLIENT_APP_OBJECT_ID=$(az ad app show --id "$CLIENT_APP_ID" --query id -o tsv)

# Add delegated permission from client -> API
az rest --method POST --uri "https://graph.microsoft.com/v1.0/applications/${CLIENT_APP_OBJECT_ID}/requiredResourceAccess" --headers 'Content-Type=application/json' --body @- <<EOF
{
  "resourceAppId": "${API_APP_ID}",
  "resourceAccess": [{"id": "${SCOPE_ID}", "type": "Scope"}]
}
EOF
```

**Notes:**
- 💡 The Graph calls require appropriate Entra permissions; if blocked, create app registrations manually in the Portal.
- 💡 You will configure APIM OAuth2 settings using the API app registration values (tenantId, clientId, scope).

### Step 7: Configure API Management to validate JWTs (Entra ID)

Add a validate-jwt policy in APIM and configure OAuth2 authorization server (optional). This step is typically done via APIM policy/ARM; below shows a simple policy example.

**Commands:**
```bash
# Get APIM name from deployment outputs
APIM_NAME=$(az deployment group show -g "$RG_NAME" -n "deploy-${PREFIX}-${ENV}" --query properties.outputs.apimName.value -o tsv)

# Example: set an API-level policy (replace <apiId>)
API_ID="inference"
az apim api create -g "$RG_NAME" --service-name "$APIM_NAME" --api-id "$API_ID" --display-name "Inference API" --path "inference" --protocols https --service-url "https://<appservice-default-hostname>"

cat > apim-policy.xml <<'XML'
<policies>
  <inbound>
    <base />
    <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Unauthorized">
      <openid-config url="https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration" />
      <required-claims>
        <claim name="scp" match="any">
          <value>inference.read</value>
        </claim>
      </required-claims>
    </validate-jwt>
  </inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>
XML

az apim api policy create -g "$RG_NAME" --service-name "$APIM_NAME" --api-id "$API_ID" --xml-policy @apim-policy.xml
```

**Notes:**
- 💡 Replace <appservice-default-hostname> with the App Service default hostname output from the deployment.
- 💡 For production, use APIM named values and Key Vault references instead of hardcoding values.

### Step 8: Configure Event Hubs Capture to Data Lake (optional validation)

The Bicep enables Event Hubs Capture to land raw events to ADLS Gen2. Validate capture status and container paths.

**Commands:**
```bash
EVENTHUB_NS=$(az deployment group show -g "$RG_NAME" -n "deploy-${PREFIX}-${ENV}" --query properties.outputs.eventHubNamespace.value -o tsv)
EVENTHUB_NAME=$(az deployment group show -g "$RG_NAME" -n "deploy-${PREFIX}-${ENV}" --query properties.outputs.eventHubName.value -o tsv)
az eventhubs eventhub show -g "$RG_NAME" --namespace-name "$EVENTHUB_NS" -n "$EVENTHUB_NAME" -o jsonc
```

**Notes:**
- 💡 Capture writes Avro files into the configured container/folder.

### Step 9: Deploy ML assets (pipelines/endpoints) and application code

Infrastructure is deployed by Bicep, but ML pipelines, model registration, and managed online endpoint deployments are typically done via Azure ML CLI v2, SDK, or GitHub/Azure DevOps pipelines.

**Commands:**
```bash
# (Example placeholders)
# az extension add -n ml -y
# az ml workspace show -g "$RG_NAME" -n <aml-workspace-name>
# az ml online-endpoint create -f endpoint.yml -g "$RG_NAME" -w <aml-workspace-name>
# az ml online-deployment create -f deployment.yml -g "$RG_NAME" -w <aml-workspace-name>
```

**Notes:**
- 💡 Use managed identity wherever possible; store any secrets in Key Vault.

## Configuration

### Common naming parameters (Bicep)

| Setting | Value | Description |
|---------|-------|-------------|
| `prefix` | mlpipe | Short workload prefix used to generate resource names. |
| `environment` | dev | Deployment environment (dev/test/prod). |
| `location` | eastus | Azure region for all resources. |

### App Service / Functions application settings (recommended)

| Setting | Value | Description |
|---------|-------|-------------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | <from deployment output appInsightsConnectionString> | Send traces and dependency telemetry to Application Insights. |
| `KEYVAULT_URI` | <from deployment output keyVaultUri> | Key Vault URI used by the application to retrieve secrets. |
| `COSMOS_ENDPOINT` | <from deployment output cosmosEndpoint> | Cosmos DB account endpoint (use managed identity + RBAC for data-plane access when possible). |
| `AML_ONLINE_ENDPOINT_URL` | <set after endpoint creation> | Azure ML managed online endpoint scoring URL. |

### Key Vault secrets (examples)

| Setting | Value | Description |
|---------|-------|-------------|
| `cosmos-primary-key` | <set via az keyvault secret set> | Only if you cannot use managed identity data-plane RBAC for Cosmos DB. Prefer identity-based access. |
| `aml-endpoint-key` | <set via AML deployment output> | If using key-based auth for AML online endpoint. Prefer AAD token-based auth if supported by your client. |

## Post-Deployment Validation

- [ ] Verify all resources deployed: az resource list -g <rg> -o table
- [ ] Validate ingestion: send test events to Event Hubs and confirm files appear in ADLS Gen2 raw container
- [ ] Validate Data Factory: create a linked service/dataset and run a debug pipeline to move raw->curated
- [ ] Validate AML workspace health: open Azure ML Studio, confirm workspace linked storage/acr/keyvault/app insights
- [ ] Deploy a managed online endpoint and test inference via AML endpoint directly, then through App Service, then through APIM
- [ ] Validate monitoring: confirm App Service/Functions traces in Application Insights and queries in Log Analytics workspace
- [ ] Configure alert rules (HTTP 5xx, Function failures, AML endpoint 4xx/5xx, Event Hubs ingress/egress anomalies)

## Troubleshooting

**Issue:** Deployment fails with 'ProviderNotRegistered' or similar

**Solution:** Register providers (Microsoft.MachineLearningServices, Microsoft.ApiManagement, etc.) and redeploy. Provider registration may take several minutes.

**Issue:** APIM provisioning takes too long or times out

**Solution:** APIM (especially Developer) can take 30-60 minutes. Re-check provisioning state in the Portal; rerun deployment if it failed mid-way.

**Issue:** Name collision for globally-scoped resources (Storage, App Service, ACR, APIM)

**Solution:** Change prefix/environment values to generate new unique names, then redeploy.

**Issue:** Event Hubs Capture not writing to Data Lake

**Solution:** Confirm storage container exists, capture is enabled, and EventHub has correct capture destination. Ensure the storage account supports hierarchical namespace and the capture path is valid.

**Issue:** App Service/Functions cannot read secrets from Key Vault

**Solution:** Ensure managed identity is enabled and role assignment 'Key Vault Secrets User' is granted at the vault scope (RBAC). Also ensure Key Vault RBAC authorization is enabled.

**Issue:** App Service/Functions cannot write to Cosmos DB

**Solution:** If using keys, confirm the correct key is stored in Key Vault and configuration points to it. If using identity-based access, assign appropriate Cosmos DB data-plane roles to the managed identity.

**Issue:** APIM returns 401 despite a valid token

**Solution:** Confirm validate-jwt policy uses the correct tenant, issuer/audience, and required scopes. Check that the token contains 'scp' with inference.read and that the API is configured to accept v2 tokens.

**Issue:** AML workspace creation fails due to dependencies

**Solution:** AML requires linked storage, ACR, Key Vault, and App Insights. Ensure those resources exist and are in a supported region; redeploy after provider registration completes.

---

*Generated: 2026-02-01, 4:10:25 p.m.*
