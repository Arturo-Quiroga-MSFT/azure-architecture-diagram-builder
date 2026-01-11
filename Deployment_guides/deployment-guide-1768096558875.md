# Deploy React SPA + Node.js API + PostgreSQL + Blob Storage (with CDN, Key Vault, App Insights) to Azure

## Overview

This guide deploys a production-ready web application architecture on Azure consisting of a React single-page application served via Azure CDN, a Node.js backend API hosted on Azure App Service, Azure Database for PostgreSQL for relational data, and Azure Blob Storage for image uploads. It also provisions Azure Key Vault for secret management and Application Insights for end-to-end observability across the frontend and backend.

**Estimated Time:** 60-90 minutes (excluding DNS propagation and optional private networking)

**Estimated Cost:** $285.25 per month (estimated; varies by region, SKU, data transfer, and usage)

## Prerequisites

- Azure subscription with Owner or Contributor access on the target subscription/resource group (and User Access Administrator if you will assign RBAC roles)
- Azure CLI installed (version 2.50+ recommended) and authenticated: https://learn.microsoft.com/cli/azure/install-azure-cli
- Node.js 18+ and npm (for building the React app and packaging the API)
- Git installed (optional, for source control and deployments)
- Permissions to create: Resource Group, App Service Plans, Web Apps, CDN Profile/Endpoint, Storage Account, Key Vault, Application Insights, PostgreSQL Flexible Server
- A verified custom domain and ability to create DNS records (optional but recommended for production)
- TLS certificates for custom domains (recommended: Azure-managed certificates for App Service custom domains where applicable)
- If using private networking (optional advanced): permissions to create VNets, private endpoints, and private DNS zones

## Deployment Steps

### Step 1: Plan naming conventions and set environment variables

Define consistent resource names and common variables used throughout the deployment. Naming convention: {org}-{app}-{env}-{region}-{resource}. Keep names globally unique where required (Storage, Key Vault, CDN endpoint).

**Commands:**
```bash
export SUBSCRIPTION_ID='<your-subscription-id>'
export LOCATION='eastus2'
export ORG='contoso'
export APP='webapp'
export ENV='prod'
export RG="rg-${ORG}-${APP}-${ENV}-${LOCATION}"
export TAGS="env=${ENV} app=${APP} owner=${ORG}"
export ASP_WEB="asp-${ORG}-${APP}-${ENV}-web"
export ASP_API="asp-${ORG}-${APP}-${ENV}-api"
export WEBAPP_WEB="app-${ORG}-${APP}-${ENV}-web"
export WEBAPP_API="app-${ORG}-${APP}-${ENV}-api"
export PG_SERVER="pg-${ORG}-${APP}-${ENV}-${LOCATION}"
export PG_DB='appdb'
export STORAGE="st${ORG}${APP}${ENV}${LOCATION}"
export KV="kv-${ORG}-${APP}-${ENV}-${LOCATION}"
export AI_NAME="appi-${ORG}-${APP}-${ENV}-${LOCATION}"
export CDN_PROFILE="cdnp-${ORG}-${APP}-${ENV}-${LOCATION}"
export CDN_ENDPOINT="cdne-${ORG}-${APP}-${ENV}-${LOCATION}"
```

**Notes:**
- 💡 Storage account names must be 3-24 characters, lowercase letters and numbers only; adjust STORAGE if needed.
- 💡 Key Vault names must be globally unique; adjust KV if needed.
- 💡 CDN endpoint names must be globally unique; adjust CDN_ENDPOINT if needed.
- 💡 For production, prefer separate App Service Plans for web and API to isolate scaling and cost.

### Step 2: Set subscription and create resource group

Authenticate to Azure, select the subscription, and create a dedicated resource group for the deployment.

**Commands:**
```bash
az login
az account set --subscription "$SUBSCRIPTION_ID"
az group create --name "$RG" --location "$LOCATION" --tags $TAGS
```

**Notes:**
- 💡 If using multiple environments (dev/test/prod), create separate resource groups per environment.
- 💡 Consider Azure Policy and resource locks for production resource groups.

### Step 3: Create Application Insights (workspace-based) for observability

Provision Application Insights for backend telemetry and optional frontend telemetry. Workspace-based is recommended for modern deployments.

**Commands:**
```bash
az monitor log-analytics workspace create --resource-group "$RG" --workspace-name "law-${ORG}-${APP}-${ENV}-${LOCATION}" --location "$LOCATION"
export LAW_ID=$(az monitor log-analytics workspace show -g "$RG" -n "law-${ORG}-${APP}-${ENV}-${LOCATION}" --query id -o tsv)
az monitor app-insights component create --app "$AI_NAME" --location "$LOCATION" --resource-group "$RG" --workspace "$LAW_ID" --application-type web
export AI_CONN=$(az monitor app-insights component show -g "$RG" -a "$AI_NAME" --query connectionString -o tsv)
```

**Notes:**
- 💡 Official docs: https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview
- 💡 Use the Application Insights connection string (preferred) rather than instrumentation key.

### Step 4: Create Key Vault for secrets and configuration

Provision Key Vault to store database credentials, storage connection strings (if needed), and other secrets. Use RBAC authorization for production.

**Commands:**
```bash
az keyvault create --name "$KV" --resource-group "$RG" --location "$LOCATION" --enable-rbac-authorization true --sku standard
az keyvault update --name "$KV" --resource-group "$RG" --public-network-access Enabled
```

**Notes:**
- 💡 For production, consider restricting Key Vault network access and using private endpoints: https://learn.microsoft.com/azure/key-vault/general/private-link-service
- 💡 RBAC for Key Vault: https://learn.microsoft.com/azure/key-vault/general/rbac-guide

### Step 5: Create Storage Account and Blob container for images

Provision a Storage Account with secure defaults and a private container for image uploads. Prefer Managed Identity + RBAC over account keys.

**Commands:**
```bash
az storage account create --name "$STORAGE" --resource-group "$RG" --location "$LOCATION" --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false --tags $TAGS
az storage account blob-service-properties update --account-name "$STORAGE" --resource-group "$RG" --enable-versioning true
export STORAGE_ID=$(az storage account show -g "$RG" -n "$STORAGE" --query id -o tsv)
export STORAGE_KEY=$(az storage account keys list -g "$RG" -n "$STORAGE" --query "[0].value" -o tsv)
az storage container create --name images --account-name "$STORAGE" --account-key "$STORAGE_KEY" --public-access off
```

**Notes:**
- 💡 Official docs: https://learn.microsoft.com/azure/storage/blobs/storage-blobs-introduction
- 💡 If your app serves images publicly, prefer generating SAS tokens per object or using a separate public container with strict CORS and caching rules.
- 💡 For production, consider enabling soft delete for blobs and containers.

### Step 6: Create Azure Database for PostgreSQL Flexible Server

Provision PostgreSQL Flexible Server with TLS enforced. For production, prefer private access (VNet integration) and disable public network access where possible.

**Commands:**
```bash
export PG_ADMIN_USER='pgadmin'
export PG_ADMIN_PASS='<generate-a-strong-password>'
az postgres flexible-server create --resource-group "$RG" --name "$PG_SERVER" --location "$LOCATION" --tier GeneralPurpose --sku-name Standard_D2s_v3 --storage-size 128 --version 16 --admin-user "$PG_ADMIN_USER" --admin-password "$PG_ADMIN_PASS" --public-access 0.0.0.0-0.0.0.0
az postgres flexible-server db create --resource-group "$RG" --server-name "$PG_SERVER" --database-name "$PG_DB"
az postgres flexible-server parameter set --resource-group "$RG" --server-name "$PG_SERVER" --name "ssl_min_protocol_version" --value "TLSv1.2"
```

**Notes:**
- 💡 Official docs: https://learn.microsoft.com/azure/postgresql/flexible-server/overview
- 💡 The public-access rule above is a placeholder; restrict it to your App Service outbound IPs or, preferably, use private access with VNet integration.
- 💡 For production, configure backups, HA, and maintenance window according to your RPO/RTO requirements.

### Step 7: Store secrets in Key Vault (DB credentials and optional storage key)

Persist sensitive values in Key Vault. Prefer Managed Identity + Key Vault references from App Service so secrets are not stored in app settings in plaintext.

**Commands:**
```bash
az keyvault secret set --vault-name "$KV" --name "pg-admin-user" --value "$PG_ADMIN_USER"
az keyvault secret set --vault-name "$KV" --name "pg-admin-pass" --value "$PG_ADMIN_PASS"
az keyvault secret set --vault-name "$KV" --name "pg-server" --value "$PG_SERVER"
az keyvault secret set --vault-name "$KV" --name "pg-db" --value "$PG_DB"
az keyvault secret set --vault-name "$KV" --name "storage-account-name" --value "$STORAGE"
az keyvault secret set --vault-name "$KV" --name "storage-account-key" --value "$STORAGE_KEY"
```

**Notes:**
- 💡 If you use Managed Identity + RBAC for Storage, you can avoid storing storage keys entirely.
- 💡 Key Vault references in App Service: https://learn.microsoft.com/azure/app-service/app-service-key-vault-references

### Step 8: Create App Service Plans and Web Apps (React web + Node API)

Provision two App Service Plans and two Web Apps. Enable system-assigned managed identity for both apps and configure HTTPS-only.

**Commands:**
```bash
az appservice plan create --name "$ASP_WEB" --resource-group "$RG" --location "$LOCATION" --sku P1v3 --is-linux true --tags $TAGS
az appservice plan create --name "$ASP_API" --resource-group "$RG" --location "$LOCATION" --sku P1v3 --is-linux true --tags $TAGS
az webapp create --name "$WEBAPP_WEB" --resource-group "$RG" --plan "$ASP_WEB" --runtime "NODE|18-lts"
az webapp create --name "$WEBAPP_API" --resource-group "$RG" --plan "$ASP_API" --runtime "NODE|18-lts"
az webapp update --name "$WEBAPP_WEB" --resource-group "$RG" --https-only true
az webapp update --name "$WEBAPP_API" --resource-group "$RG" --https-only true
az webapp identity assign --name "$WEBAPP_WEB" --resource-group "$RG"
az webapp identity assign --name "$WEBAPP_API" --resource-group "$RG"
```

**Notes:**
- 💡 Official docs (App Service): https://learn.microsoft.com/azure/app-service/overview
- 💡 For Node.js API, consider enabling Always On (recommended for production) and setting health checks.
- 💡 If you plan to serve the SPA from CDN, the web app can still host the build output as the origin.

### Step 9: Grant Managed Identity access to Key Vault and Storage (RBAC)

Assign RBAC roles so the API can read secrets from Key Vault and access Blob Storage without embedding credentials. The web app typically does not need Storage access unless it uploads directly.

**Commands:**
```bash
export API_PRINCIPAL_ID=$(az webapp identity show -g "$RG" -n "$WEBAPP_API" --query principalId -o tsv)
export WEB_PRINCIPAL_ID=$(az webapp identity show -g "$RG" -n "$WEBAPP_WEB" --query principalId -o tsv)
export KV_ID=$(az keyvault show -g "$RG" -n "$KV" --query id -o tsv)
az role assignment create --assignee-object-id "$API_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" --scope "$KV_ID"
az role assignment create --assignee-object-id "$API_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope "$STORAGE_ID"
```

**Notes:**
- 💡 RBAC role propagation can take 2-10 minutes.
- 💡 If the frontend uploads directly to Blob, prefer issuing short-lived SAS tokens from the API rather than granting the SPA direct RBAC.
- 💡 Storage RBAC: https://learn.microsoft.com/azure/storage/blobs/assign-azure-role-data-access

### Step 10: Configure App Service settings (Key Vault references, CORS, App Insights)

Set application settings for both apps. Use Key Vault references for secrets. Configure CORS for the API and set the API base URL for the SPA.

**Commands:**
```bash
export KV_URI=$(az keyvault show -g "$RG" -n "$KV" --query properties.vaultUri -o tsv)
export API_URL="https://${WEBAPP_API}.azurewebsites.net"
az webapp config appsettings set -g "$RG" -n "$WEBAPP_API" --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$AI_CONN" "NODE_ENV=production" "WEBSITE_NODE_DEFAULT_VERSION=18.0.0"
az webapp config appsettings set -g "$RG" -n "$WEBAPP_API" --settings "PGHOST=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/pg-server/)" "PGDATABASE=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/pg-db/)" "PGUSER=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/pg-admin-user/)" "PGPASSWORD=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/pg-admin-pass/)" "PGSSLMODE=require"
az webapp config appsettings set -g "$RG" -n "$WEBAPP_API" --settings "STORAGE_ACCOUNT_NAME=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/storage-account-name/)"
az webapp config appsettings set -g "$RG" -n "$WEBAPP_WEB" --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$AI_CONN" "NODE_ENV=production" "REACT_APP_API_BASE_URL=$API_URL"
az webapp config set -g "$RG" -n "$WEBAPP_API" --always-on true
az webapp cors add -g "$RG" -n "$WEBAPP_API" --allowed-origins "https://${WEBAPP_WEB}.azurewebsites.net"
```

**Notes:**
- 💡 If using CDN/custom domain for the SPA, add that origin to API CORS as well.
- 💡 Key Vault references require the app’s managed identity to have secret get permissions via RBAC and may take a few minutes to resolve.
- 💡 App Insights for Node.js: https://learn.microsoft.com/azure/azure-monitor/app/nodejs

### Step 11: Deploy the Node.js API to App Service

Deploy the backend API. Options include ZIP deploy via Azure CLI or GitHub Actions/Azure DevOps pipelines. Below uses ZIP deploy.

**Commands:**
```bash
cd <path-to-node-api>
npm ci
npm run build || true
zip -r api.zip . -x "node_modules/*" ".git/*"
az webapp deploy --resource-group "$RG" --name "$WEBAPP_API" --src-path api.zip --type zip
az webapp restart --resource-group "$RG" --name "$WEBAPP_API"
```

**Notes:**
- 💡 Ensure your API listens on process.env.PORT (App Service sets PORT).
- 💡 If using Prisma/Knex migrations, run migrations as part of a release step (recommended) rather than at app startup.
- 💡 Deployment options: https://learn.microsoft.com/azure/app-service/deploy-best-practices

### Step 12: Build and deploy the React SPA to the Web App (origin for CDN)

Build the React app and deploy the static build output to the web App Service. The CDN will use this web app as its origin.

**Commands:**
```bash
cd <path-to-react-app>
npm ci
export REACT_APP_API_BASE_URL="$API_URL"
npm run build
cd build
zip -r ../web.zip .
cd ..
az webapp deploy --resource-group "$RG" --name "$WEBAPP_WEB" --src-path web.zip --type zip
az webapp restart --resource-group "$RG" --name "$WEBAPP_WEB"
```

**Notes:**
- 💡 If you prefer a pure static hosting approach, consider Azure Static Web Apps; this guide follows the requested App Service + CDN pattern.
- 💡 For SPA routing, configure rewrite rules (e.g., serve index.html for unknown routes). On Linux App Service, you can use a Node/Express static server or configure your framework accordingly.

### Step 13: Create Azure CDN profile and endpoint (origin = Web App)

Provision Azure CDN and point it to the web App Service as the origin. Configure caching and compression as needed.

**Commands:**
```bash
az cdn profile create --name "$CDN_PROFILE" --resource-group "$RG" --sku Standard_Microsoft --location "$LOCATION" --tags $TAGS
az cdn endpoint create --name "$CDN_ENDPOINT" --profile-name "$CDN_PROFILE" --resource-group "$RG" --origin "${WEBAPP_WEB}.azurewebsites.net" --origin-host-header "${WEBAPP_WEB}.azurewebsites.net" --enable-compression true --query-string-caching IgnoreQueryString
az cdn endpoint rule add --resource-group "$RG" --profile-name "$CDN_PROFILE" --endpoint-name "$CDN_ENDPOINT" --order 1 --rule-name "CacheStaticAssets" --match-variable UrlFileExtension --operator Any --match-values "js" "css" "png" "jpg" "jpeg" "svg" "webp" "ico" "woff" "woff2" --action-name CacheExpiration --cache-behavior Override --cache-duration "7.00:00:00"
```

**Notes:**
- 💡 Official docs: https://learn.microsoft.com/azure/cdn/cdn-overview
- 💡 For SPA index.html, use a shorter cache duration (or no-cache) to ensure fast rollouts; keep hashed assets long-lived.
- 💡 If you use custom domains, configure HTTPS on the CDN endpoint and update DNS accordingly.

### Step 14: Portal-based deployment alternative (if not using CLI)

Use the Azure Portal to create and configure resources if CLI is not preferred.

**Notes:**
- 💡 App Service: Azure Portal → Create a resource → Web App → Publish: Code → Runtime stack: Node 18 LTS → Enable system-assigned managed identity → Configuration → Application settings.
- 💡 PostgreSQL Flexible Server: Azure Portal → Create → Azure Database for PostgreSQL flexible server → Networking: Public access (restricted) or Private access (recommended).
- 💡 Storage: Azure Portal → Storage accounts → Create → Data protection (enable soft delete/versioning) → Containers → images.
- 💡 Key Vault: Azure Portal → Key vaults → Create → Access configuration: Azure role-based access control → Secrets.
- 💡 Application Insights: Azure Portal → Application Insights → Create (workspace-based).
- 💡 CDN: Azure Portal → CDN profiles → Create → Endpoint → Origin: your web app hostname.

## Configuration

### Resource topology (logical organization)

| Setting | Value | Description |
|---------|-------|-------------|
| `Web Tier` | Azure CDN + Web App (React origin) | CDN caches and serves static SPA assets; origin is the web App Service. |
| `Application Tier` | API App Service (Node.js) | Backend API handles business logic, issues SAS tokens (recommended), and communicates with PostgreSQL and Blob Storage. |
| `Data Layer` | PostgreSQL Flexible Server + Blob Storage | PostgreSQL stores relational data; Blob Storage stores images. |
| `Operations & Security` | Key Vault + Application Insights | Key Vault stores secrets; App Insights collects logs, traces, metrics, and optional client telemetry. |

### Backend API (App Service) - required environment variables

| Setting | Value | Description |
|---------|-------|-------------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Set to the Application Insights connection string | Enables server telemetry, traces, and dependency tracking. |
| `NODE_ENV` | production | Enables production behavior in Node.js frameworks. |
| `PGHOST` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/pg-server/) | PostgreSQL server hostname (or FQDN if you store it). |
| `PGDATABASE` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/pg-db/) | Database name. |
| `PGUSER` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/pg-admin-user/) | Database username (prefer a least-privileged app user rather than admin). |
| `PGPASSWORD` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/pg-admin-pass/) | Database password stored in Key Vault. |
| `PGSSLMODE` | require | Forces TLS to PostgreSQL. |
| `STORAGE_ACCOUNT_NAME` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/storage-account-name/) | Storage account name for Blob operations. |
| `IMAGES_CONTAINER` | images | Blob container name for image storage. |

### Frontend (React) - required build-time variables

| Setting | Value | Description |
|---------|-------|-------------|
| `REACT_APP_API_BASE_URL` | https://<api-app>.azurewebsites.net | Base URL for API requests from the SPA. If using custom domain, set to that domain. |
| `REACT_APP_APPINSIGHTS_CONNECTION_STRING (optional)` | Application Insights connection string | Optional client telemetry. Ensure you do not send secrets/PII from the browser. |

### Security best practices (recommended configuration)

| Setting | Value | Description |
|---------|-------|-------------|
| `Managed Identity` | Enabled on both App Services | Use system-assigned managed identity for Key Vault and Storage access; avoid storing secrets in code. |
| `Key Vault access` | RBAC (Key Vault Secrets User) for API identity | Grant least privilege; avoid broad roles like Key Vault Administrator. |
| `Storage access` | Storage Blob Data Contributor for API identity | Prefer RBAC over account keys; use SAS tokens for client uploads/downloads. |
| `Network restrictions` | Restrict PostgreSQL public access; consider Private Endpoint for Key Vault/Storage/PostgreSQL | For production, use private networking to reduce exposure. |
| `TLS/HTTPS` | HTTPS-only on App Services; TLS 1.2+ on Storage and PostgreSQL | Enforce secure transport for all service connections. |

## Post-Deployment Validation

- [ ] Validate resource provisioning: az resource list -g <rg> -o table and confirm all 7 services exist (CDN, 2x App Service, PostgreSQL, Storage, Key Vault, App Insights).
- [ ] Verify API health: curl -i https://<api-app>.azurewebsites.net/health (implement a /health endpoint returning 200).
- [ ] Verify SPA loads via CDN: browse https://<cdn-endpoint>.azureedge.net and confirm assets are served with cache headers; check CDN origin health in Azure Portal → CDN endpoint → Origin.
- [ ] Verify API-to-PostgreSQL connectivity: check API logs for successful DB connection; run a simple query endpoint or migration status endpoint.
- [ ] Verify API-to-Blob connectivity: upload an image through the app; confirm blob appears in the images container and that access pattern (SAS/public) matches your design.
- [ ] Verify Key Vault references resolve: Azure Portal → App Service → Configuration → Application settings should show Key Vault reference status as 'Resolved'.
- [ ] Enable monitoring and alerts: create alerts for App Service HTTP 5xx, response time, CPU/memory, PostgreSQL CPU/storage, and Storage availability; configure action groups (email/Teams/webhook).
- [ ] Set up log review: Application Insights → Failures/Performance/Dependencies; enable diagnostic settings for App Service, PostgreSQL, Key Vault, Storage to Log Analytics if required for compliance.
- [ ] Security checks: confirm Storage public access is disabled (unless intentionally enabled), Key Vault access is least-privilege, and PostgreSQL firewall rules are restricted.

## Troubleshooting

**Issue:** Key Vault references show 'Access denied' or do not resolve in App Service

**Solution:** Ensure the App Service has a managed identity enabled and has the 'Key Vault Secrets User' role on the Key Vault scope. Wait 2-10 minutes for RBAC propagation. Confirm Key Vault is using RBAC authorization and that public network access/firewall settings allow the app to reach it (or configure private endpoints). Docs: https://learn.microsoft.com/azure/app-service/app-service-key-vault-references

**Issue:** API cannot connect to PostgreSQL (timeout or 'no pg_hba.conf entry')

**Solution:** If using public access, add firewall rules for the API outbound IPs (App Service → Properties → Outbound IP addresses) to PostgreSQL Flexible Server networking rules, or move to private access with VNet integration. Ensure PGSSLMODE=require and the server requires TLS 1.2+. Docs: https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-networking

**Issue:** CORS errors when SPA calls the API

**Solution:** Add the SPA origin(s) (CDN custom domain and/or azurewebsites.net) to App Service CORS for the API. Ensure the API returns proper Access-Control-Allow-Origin headers and handles preflight OPTIONS requests. If using credentials, configure allowed headers/methods accordingly.

**Issue:** CDN serves old SPA after deployment

**Solution:** Purge CDN endpoint content after releasing a new build (especially index.html). Use versioned/hashed asset filenames and set long cache for assets, short cache for index.html. CLI purge: az cdn endpoint purge -g <rg> --profile-name <profile> --name <endpoint> --content-paths '/*'. Docs: https://learn.microsoft.com/azure/cdn/cdn-purge-endpoint

**Issue:** Blob upload/download fails with authorization errors

**Solution:** If using Managed Identity, ensure the API identity has 'Storage Blob Data Contributor' on the storage account scope and that your SDK uses DefaultAzureCredential/ManagedIdentityCredential. If using account keys, verify the key in Key Vault is current and the container name is correct. Consider SAS token approach for browser uploads.

**Issue:** App Service deployment succeeds but app returns 502/503

**Solution:** Check App Service logs (Log stream) and Application Insights traces. Confirm the Node app binds to process.env.PORT and does not hardcode a port. Ensure startup command is correct and dependencies are installed. Docs: https://learn.microsoft.com/azure/app-service/troubleshoot-diagnostic-logs

---

*Generated: 2026-01-10, 8:53:01 p.m.*
