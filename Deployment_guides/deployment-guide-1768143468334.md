# Deploy Static Web Apps + CDN + APIM + App Service (Node.js) + PostgreSQL + Blob Storage + Entra ID + Key Vault + Application Insights to Azure

## Overview

This guide deploys a production-ready web architecture with Azure Static Web Apps front-end accelerated by Azure CDN, a secured API surface via Azure API Management, and a Node.js backend hosted on Azure App Service. Data is stored in Azure Database for PostgreSQL and Azure Blob Storage, secrets are managed in Azure Key Vault using Managed Identity, authentication/authorization is handled by Microsoft Entra ID, and end-to-end observability is provided by Application Insights.

**Estimated Time:** 60-120 minutes

**Estimated Cost:** $325.13 per month (varies by region, SKU, data transfer, and usage)

## Prerequisites

- Azure subscription with Owner or Contributor access on the target subscription and permission to create role assignments (User Access Administrator or Owner recommended)
- Azure CLI installed (version 2.50+ recommended) and logged in (az login)
- Resource providers registered: Microsoft.Web, Microsoft.Cdn, Microsoft.ApiManagement, Microsoft.DBforPostgreSQL, Microsoft.Storage, Microsoft.KeyVault, Microsoft.Insights, Microsoft.ManagedIdentity, Microsoft.Authorization
- A GitHub repository for the Static Web Apps front-end (required for Static Web Apps build/deploy integration) and optionally for the Node.js API (if using CI/CD)
- Node.js LTS installed locally for building/testing the API (optional but recommended)
- A custom domain and DNS access (optional) if you will configure custom domains for CDN/SWA/APIM
- Permissions in Microsoft Entra ID to register applications (Application Developer or higher) or an admin to create the app registrations
- OpenSSL (or similar) available locally if you need to generate secrets/certificates (optional)
- Networking decision made: public endpoints (simpler) vs private endpoints/VNet integration (more secure; additional steps not fully covered here)

## Deployment Steps

### Step 1: Set variables and select subscription

Define naming conventions and select the Azure subscription. Use a short, unique suffix to avoid global name collisions (Storage/CDN).

**Commands:**
```bash
az login
az account set --subscription "<subscription-id>"
export LOCATION="eastus2"
export ENV="prod"
export APP="untitled"
export SUFFIX="$(openssl rand -hex 3)"
export RG="rg-${APP}-${ENV}-${LOCATION}"
export KV_NAME="kv-${APP}-${ENV}-${SUFFIX}"
export SA_NAME="st${APP}${ENV}${SUFFIX}"
export AI_NAME="appi-${APP}-${ENV}-${LOCATION}"
export LAW_NAME="law-${APP}-${ENV}-${LOCATION}"
export ASP_NAME="asp-${APP}-${ENV}-${LOCATION}"
export WEBAPP_NAME="app-${APP}-${ENV}-${SUFFIX}"
export APIM_NAME="apim-${APP}-${ENV}-${SUFFIX}"
export PG_NAME="pg-${APP}-${ENV}-${SUFFIX}"
export PG_DB="appdb"
export CDN_PROFILE="cdnp-${APP}-${ENV}-${SUFFIX}"
export CDN_ENDPOINT="cdne-${APP}-${ENV}-${SUFFIX}"
```

**Notes:**
- 💡 Naming guidance: use rg- for resource groups, kv- for Key Vault, apim- for API Management, app- for App Service, pg- for PostgreSQL, st* for Storage (must be globally unique, 3-24 lowercase alphanumeric).
- 💡 If openssl is not available, set SUFFIX manually (e.g., 001abc).

### Step 2: Register resource providers (if needed)

Ensure required Azure resource providers are registered in the subscription.

**Commands:**
```bash
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.Cdn
az provider register --namespace Microsoft.ApiManagement
az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.Insights
az provider register --namespace Microsoft.ManagedIdentity
az provider register --namespace Microsoft.Authorization
```

**Notes:**
- 💡 Provider registration can take a few minutes. You can check status with: az provider show -n Microsoft.Web --query registrationState -o tsv

### Step 3: Create resource group

Create a dedicated resource group for the environment.

**Commands:**
```bash
az group create --name "$RG" --location "$LOCATION"
```

**Notes:**
- 💡 Use separate resource groups per environment (dev/test/prod) to simplify RBAC and lifecycle management.

### Step 4: Create Log Analytics workspace and Application Insights

Create centralized logging and Application Insights for backend telemetry. (Workspace-based Application Insights is recommended.)

**Commands:**
```bash
az monitor log-analytics workspace create --resource-group "$RG" --workspace-name "$LAW_NAME" --location "$LOCATION"
export LAW_ID="$(az monitor log-analytics workspace show -g "$RG" -n "$LAW_NAME" --query id -o tsv)"
az monitor app-insights component create --app "$AI_NAME" --location "$LOCATION" --resource-group "$RG" --workspace "$LAW_ID" --application-type web
export AI_CONN="$(az monitor app-insights component show -g "$RG" -a "$AI_NAME" --query connectionString -o tsv)"
```

**Notes:**
- 💡 Prefer connection string over instrumentation key for newer SDKs.
- 💡 Official docs: https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview

### Step 5: Create Key Vault (secrets management)

Create Key Vault to store database credentials and other secrets. Use RBAC authorization for production.

**Commands:**
```bash
az keyvault create --name "$KV_NAME" --resource-group "$RG" --location "$LOCATION" --enable-rbac-authorization true --public-network-access Enabled
az keyvault update --name "$KV_NAME" --resource-group "$RG" --soft-delete-retention-days 90
```

**Notes:**
- 💡 Security best practice: enable purge protection for production: az keyvault update --name "$KV_NAME" --enable-purge-protection true
- 💡 Consider restricting Key Vault public network access and using private endpoints for higher security.
- 💡 Official docs: https://learn.microsoft.com/azure/key-vault/general/overview

### Step 6: Create Storage Account and Blob container

Create a Storage Account for image uploads/downloads and a private container. Use HTTPS-only and disable public blob access.

**Commands:**
```bash
az storage account create --name "$SA_NAME" --resource-group "$RG" --location "$LOCATION" --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 --allow-blob-public-access false
export SA_ID="$(az storage account show -g "$RG" -n "$SA_NAME" --query id -o tsv)"
export SA_KEY="$(az storage account keys list -g "$RG" -n "$SA_NAME" --query [0].value -o tsv)"
az storage container create --name "images" --account-name "$SA_NAME" --account-key "$SA_KEY" --public-access off
```

**Notes:**
- 💡 Security best practice: prefer Managed Identity + role assignments over storage account keys. You can avoid storing SA_KEY by using Azure AD auth for data-plane operations where possible.
- 💡 Official docs: https://learn.microsoft.com/azure/storage/blobs/storage-blobs-introduction

### Step 7: Create PostgreSQL database (Flexible Server)

Provision Azure Database for PostgreSQL Flexible Server. For production, consider zone redundancy, private access, and backups.

**Commands:**
```bash
export PG_ADMIN="pgadmin"
export PG_PASSWORD="$(openssl rand -base64 24 | tr -d '=+/')"
az postgres flexible-server create --resource-group "$RG" --name "$PG_NAME" --location "$LOCATION" --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" --sku-name Standard_D2s_v3 --tier GeneralPurpose --storage-size 128 --version 16 --backup-retention 7 --public-access 0.0.0.0-0.0.0.0
az postgres flexible-server db create --resource-group "$RG" --server-name "$PG_NAME" --database-name "$PG_DB"
export PG_FQDN="$(az postgres flexible-server show -g "$RG" -n "$PG_NAME" --query fullyQualifiedDomainName -o tsv)"
```

**Notes:**
- 💡 The public-access rule above is permissive; restrict it to your App Service outbound IPs or use private networking. For a quick start, you can later tighten firewall rules.
- 💡 Security best practice: use Microsoft Entra ID authentication for PostgreSQL where feasible; otherwise store credentials in Key Vault and rotate regularly.
- 💡 Official docs: https://learn.microsoft.com/azure/postgresql/flexible-server/overview

### Step 8: Store secrets in Key Vault

Store PostgreSQL credentials and Storage connection details in Key Vault. Prefer storing only what you must; use Managed Identity and RBAC where possible.

**Commands:**
```bash
az keyvault secret set --vault-name "$KV_NAME" --name "PostgresAdminUser" --value "$PG_ADMIN"
az keyvault secret set --vault-name "$KV_NAME" --name "PostgresAdminPassword" --value "$PG_PASSWORD"
az keyvault secret set --vault-name "$KV_NAME" --name "PostgresHost" --value "$PG_FQDN"
export STORAGE_CONN="DefaultEndpointsProtocol=https;AccountName=${SA_NAME};AccountKey=${SA_KEY};EndpointSuffix=core.windows.net"
az keyvault secret set --vault-name "$KV_NAME" --name "StorageConnectionString" --value "$STORAGE_CONN"
```

**Notes:**
- 💡 Security best practice: avoid storing Storage account keys by using Managed Identity with 'Storage Blob Data Contributor' and using SDKs that support Azure AD auth.
- 💡 If you must store keys, rotate them periodically and update Key Vault secret versions.

### Step 9: Create App Service plan and Web App (Node.js API)

Create an App Service plan and a Linux Web App for the Node.js API. Enable system-assigned managed identity and configure Application Insights.

**Commands:**
```bash
az appservice plan create --name "$ASP_NAME" --resource-group "$RG" --location "$LOCATION" --is-linux --sku P1v3
az webapp create --name "$WEBAPP_NAME" --resource-group "$RG" --plan "$ASP_NAME" --runtime "NODE:20-lts"
az webapp identity assign --name "$WEBAPP_NAME" --resource-group "$RG"
export WEBAPP_MI_PRINCIPAL_ID="$(az webapp identity show -g "$RG" -n "$WEBAPP_NAME" --query principalId -o tsv)"
az webapp config appsettings set --name "$WEBAPP_NAME" --resource-group "$RG" --settings "APPLICATIONINSIGHTS_CONNECTION_STRING=$AI_CONN" "NODE_ENV=$ENV"
```

**Notes:**
- 💡 For production, consider enabling zone redundancy where available, autoscale rules, and deployment slots.
- 💡 Official docs: https://learn.microsoft.com/azure/app-service/overview

### Step 10: Grant the Web App access to Key Vault (RBAC)

Assign Key Vault Secrets User role to the Web App managed identity so it can read secrets at runtime.

**Commands:**
```bash
export KV_ID="$(az keyvault show -g "$RG" -n "$KV_NAME" --query id -o tsv)"
az role assignment create --assignee-object-id "$WEBAPP_MI_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" --scope "$KV_ID"
```

**Notes:**
- 💡 RBAC assignments can take a few minutes to propagate.
- 💡 Official docs: https://learn.microsoft.com/azure/key-vault/general/rbac-guide

### Step 11: Configure Web App settings using Key Vault references

Configure the API to retrieve secrets via Key Vault references. This keeps secrets out of App Service configuration values.

**Commands:**
```bash
export KV_URI="$(az keyvault show -g "$RG" -n "$KV_NAME" --query properties.vaultUri -o tsv)"
az webapp config appsettings set --name "$WEBAPP_NAME" --resource-group "$RG" --settings "POSTGRES_HOST=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/PostgresHost/)" "POSTGRES_USER=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/PostgresAdminUser/)" "POSTGRES_PASSWORD=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/PostgresAdminPassword/)" "POSTGRES_DB=$PG_DB" "STORAGE_CONNECTION_STRING=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/StorageConnectionString/)"
```

**Notes:**
- 💡 Your Node.js app should build a PostgreSQL connection string from these values or accept them individually.
- 💡 Official docs: https://learn.microsoft.com/azure/app-service/app-service-key-vault-references

### Step 12: Create API Management instance

Deploy API Management to front the Node.js API. Developer SKU is cheaper for non-prod; for production consider Standard/Premium depending on SLA, VNet, and scale needs.

**Commands:**
```bash
az apim create --name "$APIM_NAME" --resource-group "$RG" --location "$LOCATION" --publisher-email "api-owner@contoso.com" --publisher-name "Contoso" --sku-name Developer --enable-managed-identity true
export APIM_ID="$(az apim show -g "$RG" -n "$APIM_NAME" --query id -o tsv)"
```

**Notes:**
- 💡 APIM provisioning can take 30-60+ minutes depending on SKU and region.
- 💡 Official docs: https://learn.microsoft.com/azure/api-management/api-management-key-concepts

### Step 13: Import the Node.js API into APIM and set backend

Create an API in APIM and route to the App Service backend. This example uses a basic HTTP API; adjust paths/operations to your API.

**Commands:**
```bash
export WEBAPP_HOST="$(az webapp show -g "$RG" -n "$WEBAPP_NAME" --query defaultHostName -o tsv)"
az apim api create --resource-group "$RG" --service-name "$APIM_NAME" --api-id "node-api" --display-name "Node API" --path "api" --protocols https
az apim api operation create --resource-group "$RG" --service-name "$APIM_NAME" --api-id "node-api" --operation-id "proxy" --display-name "Proxy" --method GET --url-template "/{*path}"
az apim api operation policy set --resource-group "$RG" --service-name "$APIM_NAME" --api-id "node-api" --operation-id "proxy" --xml-policy "<policies><inbound><base /><set-backend-service base-url='https://${WEBAPP_HOST}' /></inbound><backend><base /></backend><outbound><base /></outbound><on-error><base /></on-error></policies>"
```

**Notes:**
- 💡 This is a simplified catch-all example; for production, define explicit operations, validate inputs, and apply rate limiting, caching, and JWT validation policies.
- 💡 If your API uses POST/PUT/etc., create corresponding operations or use an OpenAPI import.
- 💡 Portal approach: APIM -> APIs -> + Add API -> App Service -> select your Web App.

### Step 14: Create Microsoft Entra ID app registrations (SPA + API)

Create Entra ID app registrations for the SPA (Static Web Apps) and the API (APIM-protected). Configure OAuth2/OIDC and scopes. This step is commonly done in the Portal; CLI support varies by tenant policy.

**Commands:**
```bash
echo "Portal recommended: create two app registrations (SPA and API) and configure scopes/redirect URIs."
```

**Notes:**
- 💡 Portal steps (recommended): Entra ID -> App registrations -> New registration.
- 💡 Create API app: expose an API -> set Application ID URI -> add a scope (e.g., api://<api-client-id>/access_as_user).
- 💡 Create SPA app: add redirect URIs for your SWA (e.g., https://<swa-hostname>/auth/callback) and enable SPA platform.
- 💡 Grant SPA permission to call API scope; then grant admin consent if required.
- 💡 Official docs: https://learn.microsoft.com/entra/identity-platform/quickstart-register-app

### Step 15: Configure APIM JWT validation with Entra ID

Add a validate-jwt policy in APIM to enforce bearer token validation against Entra ID. Replace tenant/client IDs with your values.

**Commands:**
```bash
export TENANT_ID="<tenant-id>"
export API_AUDIENCE="api://<api-app-client-id>"
az apim api policy set --resource-group "$RG" --service-name "$APIM_NAME" --api-id "node-api" --xml-policy "<policies><inbound><base /><validate-jwt header-name='Authorization' failed-validation-httpcode='401' failed-validation-error-message='Unauthorized'><openid-config url='https://login.microsoftonline.com/${TENANT_ID}/v2.0/.well-known/openid-configuration' /><audiences><audience>${API_AUDIENCE}</audience></audiences></validate-jwt></inbound><backend><base /></backend><outbound><base /></outbound><on-error><base /></on-error></policies>"
```

**Notes:**
- 💡 Ensure your SPA requests tokens for the correct audience/scope and sends Authorization: Bearer <token> to APIM.
- 💡 Official docs: https://learn.microsoft.com/azure/api-management/api-management-access-restriction-policies#ValidateJWT

### Step 16: Deploy Azure Static Web Apps (front-end)

Create a Static Web App connected to your GitHub repo. Static Web Apps is typically created via Portal or CLI with GitHub integration.

**Commands:**
```bash
echo "CLI requires repo details. Example (replace placeholders):"
az staticwebapp create --name "swa-${APP}-${ENV}-${SUFFIX}" --resource-group "$RG" --location "$LOCATION" --source "https://github.com/<org>/<repo>" --branch "main" --app-location "/" --output-location "dist" --login-with-github
```

**Notes:**
- 💡 Portal approach: Static Web Apps -> Create -> connect GitHub -> set build details (app location/output).
- 💡 Configure SPA auth to Entra ID in your app code (MSAL) and set environment variables/secrets in SWA configuration as needed.
- 💡 Official docs: https://learn.microsoft.com/azure/static-web-apps/overview

### Step 17: Create CDN profile and endpoint (edge caching)

Create Azure CDN and point it to the Static Web Apps hostname as the origin to serve cached static assets.

**Commands:**
```bash
export SWA_NAME="swa-${APP}-${ENV}-${SUFFIX}"
export SWA_HOST="$(az staticwebapp show -g "$RG" -n "$SWA_NAME" --query defaultHostname -o tsv)"
az cdn profile create --name "$CDN_PROFILE" --resource-group "$RG" --sku Standard_Microsoft --location "$LOCATION"
az cdn endpoint create --name "$CDN_ENDPOINT" --profile-name "$CDN_PROFILE" --resource-group "$RG" --origin "$SWA_HOST" --origin-host-header "$SWA_HOST" --enable-compression true --query-string-caching IgnoreQueryString
```

**Notes:**
- 💡 If you use custom domains, configure HTTPS and set appropriate caching rules. Consider Azure Front Door if you need WAF and advanced routing.
- 💡 Official docs: https://learn.microsoft.com/azure/cdn/cdn-overview

### Step 18: Configure CORS and API base URLs

Ensure the API allows calls from the Static Web Apps and/or CDN domain, and configure the SPA to call APIM endpoint.

**Commands:**
```bash
export APIM_GATEWAY="$(az apim show -g "$RG" -n "$APIM_NAME" --query gatewayUrl -o tsv)"
az webapp cors add --resource-group "$RG" --name "$WEBAPP_NAME" --allowed-origins "https://${SWA_HOST}"
echo "If using CDN custom domain, also add it to CORS allowed origins."
```

**Notes:**
- 💡 Prefer enforcing auth at APIM and keep App Service accessible only via APIM (e.g., access restrictions) for production hardening.
- 💡 If you use cookies, configure CORS with credentials carefully; bearer tokens are simpler for SPAs.

### Step 19: Harden access: restrict App Service to APIM (recommended)

Limit direct access to the Web App so only APIM can reach it. This can be done via Access Restrictions using APIM outbound IPs (varies by SKU/region).

**Commands:**
```bash
echo "Portal recommended: App Service -> Networking -> Access restrictions -> allow APIM outbound IPs, deny all."
```

**Notes:**
- 💡 For stronger isolation, use VNet integration + private endpoints (APIM Premium/Developer in VNet) and disable public access.
- 💡 Official docs: https://learn.microsoft.com/azure/app-service/app-service-ip-restrictions

## Configuration

### Resource Naming Conventions

| Setting | Value | Description |
|---------|-------|-------------|
| `Resource group` | rg-<app>-<env>-<region> | One resource group per environment and region. |
| `Key Vault` | kv-<app>-<env>-<suffix> | Globally unique within Azure; keep short. |
| `Storage account` | st<app><env><suffix> | Must be globally unique, 3-24 chars, lowercase letters and numbers only. |
| `App Service` | app-<app>-<env>-<suffix> | Web App name becomes a public DNS name: <name>.azurewebsites.net. |
| `API Management` | apim-<app>-<env>-<suffix> | APIM name becomes part of gateway URL. |

### App Service (Node.js API) Application Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Set to the Application Insights connection string | Enables backend telemetry (requests, dependencies, traces). |
| `NODE_ENV` | prod | Node runtime environment. |
| `POSTGRES_HOST` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/PostgresHost/) | PostgreSQL server FQDN from Key Vault reference. |
| `POSTGRES_USER` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/PostgresAdminUser/) | DB username from Key Vault reference. |
| `POSTGRES_PASSWORD` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/PostgresAdminPassword/) | DB password from Key Vault reference. |
| `POSTGRES_DB` | appdb | Database name. |
| `STORAGE_CONNECTION_STRING` | @Microsoft.KeyVault(SecretUri=https://<kv>.vault.azure.net/secrets/StorageConnectionString/) | Blob Storage connection string (prefer MI-based auth if possible). |

### Static Web Apps (Front-end) Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `API_BASE_URL` | https://<apim-name>.azure-api.net/api | Base URL for calling backend APIs through APIM. |
| `ENTRA_TENANT_ID` | <tenant-id> | Tenant ID for MSAL/OIDC configuration. |
| `ENTRA_SPA_CLIENT_ID` | <spa-app-client-id> | Client ID for the SPA app registration. |
| `ENTRA_API_SCOPE` | api://<api-app-client-id>/access_as_user | Scope requested by SPA to call the API. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING (optional)` | <ai-connection-string-or-web-sdk-config> | Optional client-side telemetry configuration (use the JS SDK; avoid exposing secrets). |

### API Management Settings/Policies

| Setting | Value | Description |
|---------|-------|-------------|
| `validate-jwt policy` | OpenID config: https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration; audience: api://<api-app-client-id> | Validates bearer tokens from Entra ID and enforces authorization at the gateway. |
| `Backend` | https://<webapp>.azurewebsites.net | Routes requests from APIM to the Node.js API. |

## Post-Deployment Validation

- [ ] Validate resource provisioning: confirm App Service, APIM, PostgreSQL, Storage, Key Vault, Application Insights, Static Web Apps, and CDN are all created and in a healthy state in the Azure Portal.
- [ ] Verify the API is reachable through APIM: GET https://<apim-name>.azure-api.net/api/<health-or-sample-endpoint> and confirm 401 without token and 200 with a valid Entra ID access token.
- [ ] Verify the Web App can read Key Vault references: in App Service -> Diagnose and solve problems / Log stream, confirm no Key Vault reference resolution errors.
- [ ] Verify database connectivity from the API: run a smoke test endpoint that performs a simple SELECT 1 or reads a known table; confirm dependency telemetry appears in Application Insights.
- [ ] Verify Blob operations: upload and download a test image blob via the API; confirm container permissions are private and access is only via the API.
- [ ] Validate SPA authentication: sign in via Entra ID, acquire access token for the API scope, and call APIM with Authorization: Bearer <token>.
- [ ] Enable monitoring and alerts: create Azure Monitor alerts for App Service HTTP 5xx, APIM capacity/errors, PostgreSQL CPU/storage, and availability tests for the public endpoints.
- [ ] Set up dashboards/workbooks: use Application Insights and Log Analytics to create a workbook for request rates, failures, dependency duration, and APIM gateway metrics.
- [ ] Security checks: confirm Key Vault purge protection (recommended), Storage public access disabled, PostgreSQL firewall restricted, and App Service access restrictions (recommended) are in place.

## Troubleshooting

**Issue:** APIM returns 401/403 even with a token

**Solution:** Confirm the validate-jwt policy audience matches the API app registration Application ID URI (aud). Ensure the SPA requests the correct scope and sends the access token (not ID token). Check token claims at jwt.ms and verify tenant ID and issuer.

**Issue:** App Service cannot resolve Key Vault references

**Solution:** Verify the Web App has a system-assigned managed identity enabled and has 'Key Vault Secrets User' role on the Key Vault scope. Wait 5-10 minutes for RBAC propagation. Confirm Key Vault uses RBAC authorization and that the secret URIs are correct.

**Issue:** PostgreSQL connection failures from App Service

**Solution:** Check PostgreSQL firewall rules and ensure App Service outbound IPs are allowed (or use private networking). Confirm SSL requirements and connection parameters. Validate host FQDN and credentials stored in Key Vault. Review App Insights dependency failures for details.

**Issue:** Static Web Apps build/deploy fails

**Solution:** Verify app-location and output-location match your repo structure and build output. Confirm Node version and build commands in the workflow. Check GitHub Actions logs for missing dependencies or incorrect paths.

**Issue:** CDN endpoint serves stale content

**Solution:** Purge CDN content after deployments or configure cache-control headers appropriately. Ensure query-string caching behavior matches your app needs. Validate origin host header is set to the SWA hostname.

**Issue:** CORS errors when SPA calls APIM or API

**Solution:** Prefer calling APIM from the SPA and configure CORS at the backend only if needed. If calling App Service directly, add allowed origins for SWA/CDN domains. Ensure preflight OPTIONS requests are handled and allowed headers include Authorization.

**Issue:** No telemetry in Application Insights

**Solution:** Confirm APPLICATIONINSIGHTS_CONNECTION_STRING is set and the Node.js SDK is initialized. For client-side telemetry, ensure the JS SDK is configured correctly and ad blockers are not preventing ingestion. Check sampling settings.

---

*Generated: 2026-01-11, 9:56:15 a.m.*
