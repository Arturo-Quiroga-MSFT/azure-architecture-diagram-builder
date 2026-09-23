# Deploy React + Node.js API + PostgreSQL + Blob Storage (Entra ID, Key Vault, App Insights) to Azure

## Overview

This guide deploys a production-ready web application on Azure with a React frontend and Node.js backend hosted on Azure App Service, using Azure Database for PostgreSQL for relational data and Azure Blob Storage for image storage. Authentication and authorization are handled by Microsoft Entra ID (OIDC/OAuth2), secrets are stored in Azure Key Vault and accessed via Managed Identity, and end-to-end monitoring is enabled with Application Insights.

**Estimated Time:** 60-90 minutes

**Estimated Cost:** $285.16 per month for standard configuration

## Prerequisites

- Azure subscription with Owner (recommended) or Contributor access on the subscription/resource group; additionally, permissions to create app registrations in Microsoft Entra ID (Application Administrator or equivalent) and to grant admin consent
- Azure CLI installed (version 2.50+ recommended) and authenticated: https://learn.microsoft.com/cli/azure/install-azure-cli
- Node.js 18+ and npm installed locally for building the React app and API (or a CI pipeline that performs builds)
- Git installed (if using local Git deployment) or access to GitHub/Azure Repos for CI/CD
- A verified custom domain and TLS certificate plan (optional but recommended for production)
- Decide region (example uses eastus2) and naming prefix (example uses myapp); ensure names are globally unique where required (Storage account, Key Vault)
- Networking decision: public endpoints (simpler) vs private endpoints/VNet integration (more secure). This guide uses public endpoints with TLS and firewall restrictions where possible; add private networking as a hardening step if required

## Deployment Steps

### Step 1: Define naming conventions and set environment variables

Set a consistent naming prefix and derive resource names. Adjust values to match your organization standards and ensure globally unique names for Storage and Key Vault.

**Commands:**
```bash
export LOCATION='eastus2'
export PREFIX='myapp'
export RG="rg-${PREFIX}-${LOCATION}"
export PLAN="asp-${PREFIX}-${LOCATION}"
export WEBAPP="app-${PREFIX}-web-${LOCATION}"
export APIAPP="app-${PREFIX}-api-${LOCATION}"
export PG_SERVER="pg-${PREFIX}-${LOCATION}"
export PG_DB='appdb'
export STORAGE="st${PREFIX}${LOCATION//-/}"
export KV="kv-${PREFIX}-${LOCATION}"
export AI_NAME="appi-${PREFIX}-${LOCATION}"
export LOG_WORKSPACE="log-${PREFIX}-${LOCATION}"
```

**Notes:**
- 💡 Recommended naming: rg-<app>-<region>, asp-<app>-<region>, app-<app>-<tier>-<region>, pg-<app>-<region>, kv-<app>-<region>, appi-<app>-<region>.
- 💡 Storage account names must be 3-24 characters, lowercase letters and numbers only, globally unique.
- 💡 Key Vault names must be globally unique and 3-24 characters; only alphanumerics and hyphens.

### Step 2: Login, select subscription, and create resource group

Authenticate to Azure, select the target subscription, and create the resource group.

**Commands:**
```bash
az login
az account set --subscription '<your-subscription-id-or-name>'
az group create --name "$RG" --location "$LOCATION"
```

**Notes:**
- 💡 If you manage multiple tenants, use: az login --tenant <tenant-id>.
- 💡 For production, consider using separate subscriptions/resource groups per environment (dev/test/prod).

### Step 3: Create Log Analytics workspace and Application Insights

Create a Log Analytics workspace and an Application Insights resource (workspace-based) for unified monitoring across the web app and API.

**Commands:**
```bash
az monitor log-analytics workspace create --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" --location "$LOCATION"
export WORKSPACE_ID=$(az monitor log-analytics workspace show --resource-group "$RG" --workspace-name "$LOG_WORKSPACE" --query id -o tsv)
az monitor app-insights component create --app "$AI_NAME" --location "$LOCATION" --resource-group "$RG" --workspace "$WORKSPACE_ID" --application-type web
export AI_CONNECTION_STRING=$(az monitor app-insights component show --app "$AI_NAME" --resource-group "$RG" --query connectionString -o tsv)
```

**Notes:**
- 💡 Official docs: https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview
- 💡 Workspace-based Application Insights is recommended for modern deployments and centralized querying.

### Step 4: Create Azure Key Vault and lock down access

Create Key Vault to store secrets (PostgreSQL password, storage connection string if needed, Entra config). Use RBAC authorization and grant least-privilege access.

**Commands:**
```bash
az keyvault create --name "$KV" --resource-group "$RG" --location "$LOCATION" --enable-rbac-authorization true
export KV_ID=$(az keyvault show --name "$KV" --resource-group "$RG" --query id -o tsv)
```

**Notes:**
- 💡 Best practice: use RBAC for Key Vault access control and Managed Identity for apps. Docs: https://learn.microsoft.com/azure/key-vault/general/rbac-guide
- 💡 Consider enabling purge protection and soft delete for production (often enabled by default depending on policy).

### Step 5: Create Storage account and Blob container for images

Create a Storage account with a private container for images. Prefer Managed Identity with role assignments over storing account keys.

**Commands:**
```bash
az storage account create --name "$STORAGE" --resource-group "$RG" --location "$LOCATION" --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false
export STORAGE_ID=$(az storage account show --name "$STORAGE" --resource-group "$RG" --query id -o tsv)
export STORAGE_BLOB_ENDPOINT=$(az storage account show --name "$STORAGE" --resource-group "$RG" --query primaryEndpoints.blob -o tsv)
export STORAGE_KEY=$(az storage account keys list --account-name "$STORAGE" --resource-group "$RG" --query '[0].value' -o tsv)
az storage container create --name images --account-name "$STORAGE" --account-key "$STORAGE_KEY" --public-access off
```

**Notes:**
- 💡 Best practice: avoid using account keys at runtime; use Managed Identity + role 'Storage Blob Data Contributor' for the API.
- 💡 If you need CDN later, keep the container private and use SAS tokens or a proxy endpoint.

### Step 6: Create Azure Database for PostgreSQL (Flexible Server) with TLS

Provision PostgreSQL Flexible Server, create a database, and configure firewall rules. For production, restrict firewall to known outbound IPs or use private networking.

**Commands:**
```bash
export PG_ADMIN='pgadminuser'
export PG_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/\n' | cut -c1-24)
az postgres flexible-server create --resource-group "$RG" --name "$PG_SERVER" --location "$LOCATION" --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" --sku-name Standard_D2s_v3 --tier GeneralPurpose --storage-size 128 --version 16 --public-access 0.0.0.0-0.0.0.0
az postgres flexible-server db create --resource-group "$RG" --server-name "$PG_SERVER" --database-name "$PG_DB"
export PG_FQDN=$(az postgres flexible-server show --resource-group "$RG" --name "$PG_SERVER" --query fullyQualifiedDomainName -o tsv)
```

**Notes:**
- 💡 Official docs: https://learn.microsoft.com/azure/postgresql/flexible-server/overview
- 💡 The example uses a permissive firewall rule (0.0.0.0) for initial setup. For production, replace with App Service outbound IPs or use Private Endpoint + VNet integration.
- 💡 Ensure your Node.js PostgreSQL client enforces SSL/TLS (sslmode=require).

### Step 7: Store secrets in Key Vault

Store PostgreSQL credentials and (optionally) storage connection string in Key Vault. Prefer Managed Identity and RBAC to retrieve secrets at runtime.

**Commands:**
```bash
az keyvault secret set --vault-name "$KV" --name 'pg-admin-user' --value "$PG_ADMIN"
az keyvault secret set --vault-name "$KV" --name 'pg-admin-password' --value "$PG_PASSWORD"
az keyvault secret set --vault-name "$KV" --name 'pg-host' --value "$PG_FQDN"
export STORAGE_CONN_STRING=$(az storage account show-connection-string --name "$STORAGE" --resource-group "$RG" --query connectionString -o tsv)
az keyvault secret set --vault-name "$KV" --name 'storage-connection-string' --value "$STORAGE_CONN_STRING"
```

**Notes:**
- 💡 If you use Managed Identity for Storage access, you may not need to store the storage connection string.
- 💡 Consider storing only non-rotating configuration in App Settings and keep secrets in Key Vault.

### Step 8: Create App Service plan and two App Services (Web + API)

Create an App Service plan (Linux) and two Web Apps: one for the React frontend and one for the Node.js API. Enable system-assigned managed identities.

**Commands:**
```bash
az appservice plan create --name "$PLAN" --resource-group "$RG" --location "$LOCATION" --is-linux --sku P1v3
az webapp create --name "$WEBAPP" --resource-group "$RG" --plan "$PLAN" --runtime 'NODE:18-lts'
az webapp create --name "$APIAPP" --resource-group "$RG" --plan "$PLAN" --runtime 'NODE:18-lts'
az webapp identity assign --name "$WEBAPP" --resource-group "$RG"
az webapp identity assign --name "$APIAPP" --resource-group "$RG"
export WEBAPP_PRINCIPAL_ID=$(az webapp identity show --name "$WEBAPP" --resource-group "$RG" --query principalId -o tsv)
export APIAPP_PRINCIPAL_ID=$(az webapp identity show --name "$APIAPP" --resource-group "$RG" --query principalId -o tsv)
```

**Notes:**
- 💡 SKU recommendation depends on load; P1v3 is a common production baseline. Adjust to your needs.
- 💡 Official docs: https://learn.microsoft.com/azure/app-service/overview

### Step 9: Grant Managed Identity access to Key Vault and Blob Storage

Assign least-privilege roles so the API can read secrets from Key Vault and read/write blobs. The web app typically does not need direct access to secrets or storage.

**Commands:**
```bash
az role assignment create --assignee-object-id "$APIAPP_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal --role 'Key Vault Secrets User' --scope "$KV_ID"
az role assignment create --assignee-object-id "$APIAPP_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal --role 'Storage Blob Data Contributor' --scope "$STORAGE_ID"
```

**Notes:**
- 💡 If the web app needs Key Vault (generally avoid), grant it 'Key Vault Secrets User' as well.
- 💡 Docs: Key Vault roles https://learn.microsoft.com/azure/key-vault/general/rbac-guide and Storage roles https://learn.microsoft.com/azure/storage/blobs/authorize-access-azure-active-directory

### Step 10: Configure Application Insights for both apps

Set Application Insights connection string in App Service settings so server-side telemetry is collected automatically (with SDK instrumentation in code).

**Commands:**
```bash
az webapp config appsettings set --name "$WEBAPP" --resource-group "$RG" --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONNECTION_STRING"
az webapp config appsettings set --name "$APIAPP" --resource-group "$RG" --settings APPLICATIONINSIGHTS_CONNECTION_STRING="$AI_CONNECTION_STRING"
```

**Notes:**
- 💡 For Node.js, add the Application Insights SDK to your API for best results: https://learn.microsoft.com/azure/azure-monitor/app/nodejs
- 💡 For React client-side telemetry, use the JavaScript SDK and set the same connection string (or instrumentation key if required by your setup): https://learn.microsoft.com/azure/azure-monitor/app/javascript

### Step 11: Create Microsoft Entra ID app registrations (SPA + API) and configure OAuth2/OIDC

Create two app registrations: one for the React SPA (public client) and one for the Node.js API (resource server). Configure scopes, redirect URIs, and grant permissions.

**Commands:**
```bash
export TENANT_ID=$(az account show --query tenantId -o tsv)
export WEB_REDIRECT_URI="https://${WEBAPP}.azurewebsites.net"
export WEB_REDIRECT_URI_AUTH="https://${WEBAPP}.azurewebsites.net/auth/callback"
export API_IDENTIFIER_URI="api://${APIAPP}"
az ad app create --display-name "${PREFIX}-web" --sign-in-audience AzureADMyOrg --web-redirect-uris "$WEB_REDIRECT_URI" "$WEB_REDIRECT_URI_AUTH"
export WEB_APP_ID=$(az ad app list --display-name "${PREFIX}-web" --query '[0].appId' -o tsv)
az ad app create --display-name "${PREFIX}-api" --sign-in-audience AzureADMyOrg --identifier-uris "$API_IDENTIFIER_URI"
export API_APP_ID=$(az ad app list --display-name "${PREFIX}-api" --query '[0].appId' -o tsv)
```

**Notes:**
- 💡 You may need Microsoft Graph permissions to create app registrations via CLI; otherwise use the Azure Portal steps below.
- 💡 Official docs: App registrations https://learn.microsoft.com/entra/identity-platform/quickstart-register-app
- 💡 For SPA redirect URIs, ensure they match your actual auth library routes (e.g., MSAL).

### Step 12: Portal alternative: Configure Entra ID (recommended for precision)

Use the Azure Portal to configure app registrations, scopes, and permissions if CLI is restricted or you need fine-grained settings.

**Notes:**
- 💡 Portal steps (API app): Entra ID > App registrations > New registration (name: <prefix>-api). Then: Expose an API > Set Application ID URI (api://<apiapp>), Add a scope (e.g., access_as_user).
- 💡 Portal steps (Web app): Entra ID > App registrations > New registration (name: <prefix>-web). Then: Authentication > Add SPA platform > Redirect URI(s) (https://<webapp>.azurewebsites.net and your callback route).
- 💡 Portal steps (Permissions): In Web app registration > API permissions > Add permission > My APIs > select <prefix>-api > delegated permission for the scope; then Grant admin consent (if required).
- 💡 Docs: https://learn.microsoft.com/entra/identity-platform/scenario-spa-overview and https://learn.microsoft.com/entra/identity-platform/scenario-protected-web-api-overview

### Step 13: Configure API App Service settings (Key Vault references, auth config, storage, CORS)

Set runtime configuration for the Node.js API. Use Key Vault references for secrets and configure allowed origins for the React frontend.

**Commands:**
```bash
export WEB_ORIGIN="https://${WEBAPP}.azurewebsites.net"
az webapp config appsettings set --name "$APIAPP" --resource-group "$RG" --settings \
  NODE_ENV=production \
  PORT=8080 \
  CORS_ALLOWED_ORIGINS="$WEB_ORIGIN" \
  ENTRA_TENANT_ID="$TENANT_ID" \
  ENTRA_API_AUDIENCE="$API_IDENTIFIER_URI" \
  STORAGE_ACCOUNT_NAME="$STORAGE" \
  STORAGE_CONTAINER_NAME='images' \
  PGHOST="@Microsoft.KeyVault(SecretUri=https://${KV}.vault.azure.net/secrets/pg-host/)" \
  PGUSER="@Microsoft.KeyVault(SecretUri=https://${KV}.vault.azure.net/secrets/pg-admin-user/)" \
  PGPASSWORD="@Microsoft.KeyVault(SecretUri=https://${KV}.vault.azure.net/secrets/pg-admin-password/)" \
  PGDATABASE="$PG_DB" \
  PGSSLMODE=require
```

**Notes:**
- 💡 Key Vault references require the app's managed identity to have 'Key Vault Secrets User' on the vault. Docs: https://learn.microsoft.com/azure/app-service/app-service-key-vault-references
- 💡 Prefer using Azure AD auth to PostgreSQL (more secure) if feasible; otherwise rotate passwords regularly and keep them only in Key Vault.
- 💡 If using Managed Identity for Blob, use Azure SDK DefaultAzureCredential in the API and do not use connection strings.

### Step 14: Configure Web App settings (API base URL, Entra ID client settings, optional App Insights JS)

Set environment variables for the React app (either at build time or runtime depending on your hosting approach). For App Service static hosting via Node, you can inject runtime settings via App Settings and serve a config endpoint/file.

**Commands:**
```bash
export API_BASE_URL="https://${APIAPP}.azurewebsites.net"
az webapp config appsettings set --name "$WEBAPP" --resource-group "$RG" --settings \
  NODE_ENV=production \
  REACT_APP_API_BASE_URL="$API_BASE_URL" \
  REACT_APP_ENTRA_TENANT_ID="$TENANT_ID" \
  REACT_APP_ENTRA_CLIENT_ID="$WEB_APP_ID" \
  REACT_APP_API_SCOPE="${API_IDENTIFIER_URI}/access_as_user" \
  REACT_APP_APPINSIGHTS_CONNECTION_STRING="$AI_CONNECTION_STRING"
```

**Notes:**
- 💡 React environment variables are typically baked at build time. If you deploy pre-built static assets, ensure these values are present during build or implement runtime configuration.
- 💡 For SPA routing on App Service, configure rewrite rules (e.g., web.config for Windows or custom server for Linux) so deep links route to index.html.

### Step 15: Enable App Service Authentication (optional) or implement JWT validation in API

Choose one approach: (A) validate JWTs in your Node.js API using middleware (recommended for flexibility), or (B) enable App Service built-in authentication (Easy Auth) for the API. This step outlines the portal approach for Easy Auth.

**Notes:**
- 💡 Option A (recommended): Use a library like passport-azure-ad, jose, or express-jwt with JWKS discovery from https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys and validate audience=api://<apiapp>.
- 💡 Option B (Easy Auth): Portal > API App Service > Authentication > Add identity provider > Microsoft > Use existing app registration (<prefix>-api) > Require authentication. Docs: https://learn.microsoft.com/azure/app-service/overview-authentication-authorization
- 💡 If using Easy Auth, ensure CORS and token forwarding behavior match your frontend auth flow.

### Step 16: Deploy the Node.js API to App Service (CLI zip deploy example)

Build and deploy the API. This example uses zip deployment. Replace paths with your repo structure.

**Commands:**
```bash
cd <path-to-your-api-project>
npm ci
npm run build
zip -r api.zip . -x "node_modules/*" ".git/*"
az webapp deployment source config-zip --resource-group "$RG" --name "$APIAPP" --src api.zip
```

**Notes:**
- 💡 Alternative: Use GitHub Actions or Azure DevOps pipelines for repeatable deployments (recommended for production).
- 💡 Ensure the API listens on process.env.PORT and binds to 0.0.0.0.

### Step 17: Deploy the React frontend to App Service

Build the React app and deploy. If hosting as static files, you can deploy the build output via zip deploy with a lightweight Node server or use a static hosting approach. This example assumes a Node-based static server in the web app.

**Commands:**
```bash
cd <path-to-your-react-project>
npm ci
npm run build
zip -r web.zip build package.json package-lock.json server.js -x "node_modules/*" ".git/*"
az webapp deployment source config-zip --resource-group "$RG" --name "$WEBAPP" --src web.zip
```

**Notes:**
- 💡 If you do not have a Node server for static hosting, consider Azure Static Web Apps (not included in this architecture) or add a minimal Express server to serve /build and SPA fallback.
- 💡 Ensure the frontend uses HTTPS API base URL and sends bearer tokens to the API.

### Step 18: Harden App Service (TLS, HTTPS-only, health checks, scaling)

Apply baseline security and reliability settings to both App Services.

**Commands:**
```bash
az webapp update --resource-group "$RG" --name "$WEBAPP" --https-only true
az webapp update --resource-group "$RG" --name "$APIAPP" --https-only true
az webapp config set --resource-group "$RG" --name "$APIAPP" --always-on true
az webapp config set --resource-group "$RG" --name "$WEBAPP" --always-on true
```

**Notes:**
- 💡 Configure Health Check endpoint (Portal > App Service > Health check) for better instance management.
- 💡 Consider deployment slots (staging/production) for zero-downtime releases. Docs: https://learn.microsoft.com/azure/app-service/deploy-staging-slots

## Configuration

### Backend API (App Service) - Required App Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `NODE_ENV` | production | Enables production behavior in Node.js. |
| `PORT` | 8080 | Port the API listens on (App Service sets PORT; ensure your app respects it). |
| `CORS_ALLOWED_ORIGINS` | https://<webapp>.azurewebsites.net | Comma-separated list of allowed origins for browser calls. |
| `ENTRA_TENANT_ID` | <tenant-guid> | Microsoft Entra tenant ID used for token validation. |
| `ENTRA_API_AUDIENCE` | api://<apiapp> | Expected audience (aud) claim for access tokens. |
| `PGHOST` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/pg-host/) | PostgreSQL server FQDN retrieved from Key Vault. |
| `PGUSER` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/pg-admin-user/) | PostgreSQL username retrieved from Key Vault. |
| `PGPASSWORD` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/pg-admin-password/) | PostgreSQL password retrieved from Key Vault. |
| `PGDATABASE` | appdb | Database name. |
| `PGSSLMODE` | require | Forces TLS to PostgreSQL. |
| `STORAGE_ACCOUNT_NAME` | <storage-account> | Storage account name used by the API. |
| `STORAGE_CONTAINER_NAME` | images | Blob container for image objects. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | <from-app-insights> | Enables server-side telemetry to Application Insights. |

### Frontend Web (App Service) - Required App Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `REACT_APP_API_BASE_URL` | https://<apiapp>.azurewebsites.net | Base URL for API calls from the React app. |
| `REACT_APP_ENTRA_TENANT_ID` | <tenant-guid> | Tenant used by MSAL/OIDC configuration. |
| `REACT_APP_ENTRA_CLIENT_ID` | <web-app-registration-client-id> | Client ID of the SPA app registration. |
| `REACT_APP_API_SCOPE` | api://<apiapp>/access_as_user | Delegated scope requested by the SPA to call the API. |
| `REACT_APP_APPINSIGHTS_CONNECTION_STRING` | <from-app-insights> | Optional: client-side telemetry configuration. |

### Key Vault Secrets (Recommended)

| Setting | Value | Description |
|---------|-------|-------------|
| `pg-host` | <pg-fqdn> | PostgreSQL server hostname. |
| `pg-admin-user` | <username> | PostgreSQL admin username (or app-specific user if you create one). |
| `pg-admin-password` | <password> | PostgreSQL password; rotate regularly. |
| `storage-connection-string` | <connection-string> | Optional; avoid if using Managed Identity for Blob access. |

## Post-Deployment Validation

- [ ] Validate resource provisioning: confirm both App Services are running, PostgreSQL server is 'Ready', Storage container 'images' exists, Key Vault is accessible, and Application Insights is receiving data.
- [ ] Verify authentication flow: open https://<webapp>.azurewebsites.net, sign in via Entra ID, and confirm an access token is acquired for scope api://<apiapp>/access_as_user.
- [ ] Verify API authorization: call a protected endpoint with a bearer token and confirm 200 OK; without token confirm 401/403.
- [ ] Verify database connectivity: trigger an API operation that reads/writes PostgreSQL; confirm TLS is used (sslmode=require) and errors are not present in App Service logs.
- [ ] Verify blob operations: upload an image via the API and confirm it appears in the 'images' container; ensure blobs are not publicly accessible unless explicitly intended.
- [ ] Monitoring setup: in Application Insights, confirm requests, dependencies (PostgreSQL/Storage), exceptions, and traces are visible; create alerts for failed requests, high response time, and server errors.
- [ ] Security hardening: restrict PostgreSQL firewall to App Service outbound IPs or implement Private Endpoint; disable local auth where possible; enable Key Vault purge protection; review role assignments for least privilege.
- [ ] Operational readiness: configure deployment slots, backups (PostgreSQL automated backups), and a rollback strategy; document runbooks for secret rotation and incident response.

## Troubleshooting

**Issue:** API returns 401/403 when called from the React app

**Solution:** Confirm the SPA requests the correct scope (api://<apiapp>/access_as_user), the API validates audience and issuer correctly, and CORS_ALLOWED_ORIGINS includes the web app origin. If using Easy Auth, ensure the identity provider is configured and 'Require authentication' is enabled.

**Issue:** Key Vault reference values are empty or show as unresolved in App Service

**Solution:** Verify the API app has a system-assigned managed identity enabled and has the 'Key Vault Secrets User' role assignment on the Key Vault scope. Also confirm the SecretUri is correct and includes a trailing slash. See: https://learn.microsoft.com/azure/app-service/app-service-key-vault-references

**Issue:** PostgreSQL connection fails (timeout or 'no pg_hba.conf entry')

**Solution:** Check PostgreSQL firewall rules and ensure the server allows connections from the App Service outbound IPs (or temporarily allow Azure services). Ensure the connection uses TLS (sslmode=require) and the host is the server FQDN.

**Issue:** Blob upload fails with AuthorizationPermissionMismatch or 403

**Solution:** If using Managed Identity, ensure the API managed identity has 'Storage Blob Data Contributor' on the storage account scope and that your code uses DefaultAzureCredential. If using connection strings, confirm the secret value is correct and not expired/rotated.

**Issue:** React app loads but API calls fail due to mixed content or blocked requests

**Solution:** Ensure REACT_APP_API_BASE_URL uses https:// and the API enforces HTTPS-only. Confirm the browser console for CORS errors and update CORS_ALLOWED_ORIGINS accordingly.

**Issue:** No telemetry appears in Application Insights

**Solution:** Confirm APPLICATIONINSIGHTS_CONNECTION_STRING is set on both apps. For Node.js, ensure the Application Insights SDK is initialized early in startup. For client-side telemetry, ensure the JS SDK is configured and allowed by CSP if you use one.

---

*Generated: 2026-01-11, 4:44:30 p.m.*
