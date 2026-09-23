# Deploy React + Node.js API + PostgreSQL + Blob Storage to Azure

## Overview

Deploy a React frontend on Azure Static Web Apps, a Node.js backend API on Azure App Service, Azure Database for PostgreSQL for relational data, Azure Blob Storage for images, Microsoft Entra ID for authentication/authorization, Azure Key Vault for secrets, and Application Insights for client/server telemetry. Infrastructure is provisioned with Bicep and deployed via Azure CLI.

**Estimated Time:** 45-90 minutes

**Estimated Cost:** $212.61/month

## Prerequisites

- Azure subscription
- Azure CLI 2.50+
- Bicep CLI (az bicep install)
- Permissions: Owner/Contributor on subscription or target resource group; User Access Administrator recommended for role assignments; Application Administrator or Cloud Application Administrator in Entra ID to create app registrations (or pre-create and pass IDs)
- GitHub repository for the React/Node projects (recommended for Static Web Apps GitHub Actions deployment)
- Node.js 18+ locally (to build/validate backend if needed)
- OpenSSL (optional) for generating secrets
- jq (optional) for parsing CLI outputs

## Deployment Steps

### Step 1: Install tools and login

Install/verify Azure CLI and Bicep, then authenticate to Azure and select the subscription.

**Commands:**
```bash
az version
az login
az account set --subscription <SUBSCRIPTION_ID>
az bicep install
az bicep version
```

**Notes:**
- 💡 If you will create Entra app registrations via CLI, you may need additional directory permissions.
- 💡 If your org restricts app registration creation, pre-create the Entra apps and provide their IDs as parameters.

### Step 2: Set deployment variables

Define environment, naming, location, and resource group variables used by later commands.

**Commands:**
```bash
export LOCATION="eastus"
export ENV="dev"
export PREFIX="contoso"
export RG="rg-${PREFIX}-${ENV}"
export DEPLOYMENT_NAME="webapp-${ENV}-$(date +%Y%m%d%H%M)"
```

**Notes:**
- 💡 Use a short PREFIX to keep resource names within Azure length limits.
- 💡 Pick a LOCATION that supports Static Web Apps and your desired PostgreSQL SKU.

### Step 3: Create resource group

Create the Azure resource group for all resources.

**Commands:**
```bash
az group create --name "$RG" --location "$LOCATION"
```

**Notes:**
- 💡 All Bicep deployments will target this resource group.

### Step 4: Create Microsoft Entra ID app registrations (frontend + API)

Create two Entra applications: one for the React SPA (client) and one for the backend API (resource). Then create a client secret for the API app (if needed).

**Commands:**
```bash
export AAD_TENANT_ID=$(az account show --query tenantId -o tsv)
export AAD_API_APP_NAME="${PREFIX}-${ENV}-api"
export AAD_SPA_APP_NAME="${PREFIX}-${ENV}-spa"
az ad app create --display-name "$AAD_API_APP_NAME" --sign-in-audience AzureADMyOrg > apiApp.json
export API_APP_ID=$(jq -r '.appId' apiApp.json)
export API_OBJECT_ID=$(jq -r '.id' apiApp.json)
az ad app create --display-name "$AAD_SPA_APP_NAME" --sign-in-audience AzureADMyOrg > spaApp.json
export SPA_APP_ID=$(jq -r '.appId' spaApp.json)
export SPA_OBJECT_ID=$(jq -r '.id' spaApp.json)
export API_SECRET=$(az ad app credential reset --id "$API_APP_ID" --display-name "api-secret" --years 1 --query password -o tsv)
```

**Notes:**
- 💡 This step uses Microsoft Graph permissions. If you get authorization errors, have an admin grant privileges or pre-create apps and set API_APP_ID/SPA_APP_ID/API_SECRET manually.
- 💡 You must also configure SPA redirect URIs and API scopes. For a production-ready guide, do this after Static Web Apps URL and API URL exist; see Post-Deployment.

### Step 5: Deploy infrastructure with Bicep

Deploy Key Vault, Storage, PostgreSQL, App Service, Static Web Apps, and Application Insights. Secrets are stored in Key Vault and referenced by App Service app settings.

**Commands:**
```bash
export DB_ADMIN_USER="pgadmin"
export DB_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | cut -c1-32)
az deployment group create \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RG" \
  --template-file main.bicep \
  --parameters \
      location="$LOCATION" \
      environment="$ENV" \
      namePrefix="$PREFIX" \
      tenantId="$AAD_TENANT_ID" \
      apiAppId="$API_APP_ID" \
      spaAppId="$SPA_APP_ID" \
      apiClientSecret="$API_SECRET" \
      pgAdminUser="$DB_ADMIN_USER" \
      pgAdminPassword="$DB_ADMIN_PASSWORD"
```

**Notes:**
- 💡 This template uses RBAC-based Key Vault access and configures App Service to use a managed identity to read secrets.
- 💡 PostgreSQL is created with public network access enabled by default; restrict it later with firewall rules/VNet integration for production.
- 💡 Static Web Apps deployment via Bicep provisions the resource; you still need to configure CI/CD (GitHub Actions) or use SWA CLI for content deployment.

### Step 6: Fetch outputs and configure app settings (if needed)

Retrieve important outputs (URLs, resource names) and optionally set additional runtime settings.

**Commands:**
```bash
az deployment group show --name "$DEPLOYMENT_NAME" --resource-group "$RG" --query properties.outputs -o json > outputs.json
export API_NAME=$(jq -r '.apiAppServiceName.value' outputs.json)
export SWA_NAME=$(jq -r '.staticWebAppName.value' outputs.json)
export API_URL=$(jq -r '.apiBaseUrl.value' outputs.json)
export SWA_URL=$(jq -r '.staticWebAppUrl.value' outputs.json)
echo "API URL: $API_URL"
echo "SWA URL: $SWA_URL"
```

**Notes:**
- 💡 If you add custom domains, update Entra redirect URIs accordingly.
- 💡 If you deploy the Node API separately (zip deploy), ensure WEBSITE_RUN_FROM_PACKAGE is set as appropriate.

### Step 7: Deploy application code (recommended paths)

Deploy the React frontend to Static Web Apps and the Node.js backend to App Service. Choose one deployment approach.

**Commands:**
```bash
# Option A: App Service - zip deploy (backend)
cd backend
npm ci
npm run build || true
zip -r ../api.zip .
az webapp deploy --resource-group "$RG" --name "$API_NAME" --src-path ../api.zip --type zip

# Option B: Static Web Apps - GitHub Actions (frontend)
# In Azure Portal or via CLI, connect the Static Web App to your GitHub repo. Example (repo must exist):
# az staticwebapp create --name "$SWA_NAME" --resource-group "$RG" --location "$LOCATION" --source https://github.com/<org>/<repo> --branch main --app-location "frontend" --output-location "build" --api-location ""

# Option C: Static Web Apps - SWA CLI (local) (frontend)
# npm install -g @azure/static-web-apps-cli
# cd frontend && npm ci && npm run build
# swa deploy ./build --env production --deployment-token <SWA_DEPLOYMENT_TOKEN>
```

**Notes:**
- 💡 Static Web Apps typically uses GitHub Actions for repeatable deployments. Bicep provisions the SWA resource; you still need a deployment pipeline.
- 💡 For secure production, avoid embedding secrets in frontend; use OIDC sign-in and call the backend API with bearer tokens.

## Configuration

### Environment variables / app settings (App Service - Node.js API)

| Setting | Value | Description |
|---------|-------|-------------|
| `NODE_ENV` | production | Node runtime environment. |
| `PORT` | 8080 | Port used by the Node.js server (App Service will proxy requests). Adjust if your app expects another port. |
| `APPINSIGHTS_CONNECTION_STRING` | @Microsoft.KeyVault(SecretUri=https://<kv-name>.vault.azure.net/secrets/appinsights-connection-string/...) | Application Insights connection string via Key Vault reference (set by Bicep). |
| `POSTGRES_CONNECTION_STRING` | @Microsoft.KeyVault(SecretUri=https://<kv-name>.vault.azure.net/secrets/pg-connection-string/...) | PostgreSQL connection string via Key Vault reference (set by Bicep). |
| `BLOB_CONNECTION_STRING` | @Microsoft.KeyVault(SecretUri=https://<kv-name>.vault.azure.net/secrets/storage-connection-string/...) | Storage connection string via Key Vault reference (set by Bicep). Prefer Managed Identity + role assignments for production. |
| `BLOB_CONTAINER_NAME` | images | Blob container used to store uploaded images. |
| `AZURE_TENANT_ID` | <tenant-guid> | Microsoft Entra tenant ID for JWT validation. |
| `AZURE_AD_API_AUDIENCE` | api://<api-app-id> | Expected audience (aud claim) for incoming JWTs. Match your API app registration configuration. |
| `AZURE_AD_ISSUER` | https://login.microsoftonline.com/<tenant-guid>/v2.0 | Expected issuer (iss claim) for JWTs. |

### Frontend configuration (Static Web Apps - React)

| Setting | Value | Description |
|---------|-------|-------------|
| `REACT_APP_API_BASE_URL` | https://<api-app-name>.azurewebsites.net | Base URL for HTTPS calls from the React frontend to the backend API. |
| `Auth (SWA + Entra)` | Configure authentication provider + redirect URIs | Static Web Apps supports built-in auth providers; for Entra ID you must configure app registration redirect URIs and SWA auth settings. See Post-Deployment steps. |

## Post-Deployment Validation

- [ ] Validate resources exist: az resource list -g <rg> -o table
- [ ] Confirm API health endpoint responds (implement /health): curl -i https://<api-app>.azurewebsites.net/health
- [ ] Verify App Service managed identity can read Key Vault secrets: check App Service Configuration -> Application settings show resolved values at runtime (do not print secrets in logs)
- [ ] Validate PostgreSQL connectivity from API (run a simple DB query endpoint or check app logs for successful connection)
- [ ] Validate Blob uploads/downloads from API (upload a test image and verify it appears in the 'images' container)
- [ ] Configure Entra ID app registrations: add SPA redirect URI = https://<static-web-app-url>/.auth/login/aad/callback and logout URL as needed; configure API scopes and grant SPA permissions
- [ ] Enable and review telemetry: open Application Insights -> Live Metrics and Logs; verify browser telemetry is sent from frontend and traces/requests are visible from API
- [ ] Set up monitoring alerts (recommended): availability test for API endpoint, failure rate alert, and PostgreSQL CPU/storage alerts

## Troubleshooting

**Issue:** Bicep deployment fails with AuthorizationFailed or insufficient privileges creating role assignments

**Solution:** Ensure you have Owner or User Access Administrator on the subscription/resource group. Retry after permissions propagate. If policies block role assignments, have an admin run the deployment or remove role assignment modules.

**Issue:** Key Vault references in App Service app settings show 'AccessToKeyVaultDenied'

**Solution:** Verify App Service system-assigned managed identity is enabled and has Key Vault Secrets User role scope on the vault. Also ensure Key Vault has RBAC authorization enabled (not access policies).

**Issue:** API cannot connect to PostgreSQL (timeouts or auth errors)

**Solution:** Check PostgreSQL firewall rules and that public network access is enabled for initial testing. Confirm connection string includes sslmode=require and correct username format. Review App Service outbound IPs and allow them if needed.

**Issue:** Static Web Apps login fails with redirect_uri_mismatch

**Solution:** Update the SPA app registration redirect URI to include: https://<swa-url>/.auth/login/aad/callback. If using a custom domain, add that callback URL too.

**Issue:** JWT validation fails in API (401/403) due to invalid audience/issuer

**Solution:** Ensure the API expects the correct aud/iss values. For v2 tokens, issuer is typically https://login.microsoftonline.com/<tenantId>/v2.0. Audience should match the API app's Application ID URI or client ID depending on your setup.

**Issue:** Blob upload fails with 403 AuthorizationPermissionMismatch

**Solution:** If using connection string, ensure it is correct and not rotated. If using managed identity, assign Storage Blob Data Contributor to the App Service identity at the storage account or container scope.

**Issue:** No telemetry appears in Application Insights

**Solution:** Confirm APPINSIGHTS_CONNECTION_STRING is set and resolved at runtime. For Node.js, install and initialize Application Insights SDK. For frontend, ensure instrumentation is configured (e.g., Azure Monitor OpenTelemetry for web or your preferred client SDK) and that ad blockers aren’t preventing requests.

---

*Generated: 2026-02-01, 8:20:35 p.m.*
