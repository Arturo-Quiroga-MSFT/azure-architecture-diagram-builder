
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_config

TENANT_ID="$(az account show --query tenantId -o tsv)"
SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
ENVIRONMENT_ID="$(az containerapp env show -g "$AZURE_RESOURCE_GROUP" -n "$CONTAINER_APP_ENVIRONMENT" --query id -o tsv)"
ACR_SERVER="$(az acr show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_CONTAINER_REGISTRY" --query loginServer -o tsv)"

ENTRA_CLIENT_ID="$(az ad app list --display-name "$ANALYTICS_ENTRA_APP_NAME" --query '[0].appId' -o tsv)"
if [[ -z "$ENTRA_CLIENT_ID" ]]; then
  ENTRA_CLIENT_ID="$(az ad app create --display-name "$ANALYTICS_ENTRA_APP_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)"
  az ad app update --id "$ENTRA_CLIENT_ID" --identifier-uris "api://$ENTRA_CLIENT_ID"
  az ad sp create --id "$ENTRA_CLIENT_ID" >/dev/null
fi
az ad app update --id "$ENTRA_CLIENT_ID" --enable-id-token-issuance true
ENTRA_OBJECT_ID="$(az ad app show --id "$ENTRA_CLIENT_ID" --query id -o tsv)"
ENTRA_SECRET="$(az ad app credential reset --id "$ENTRA_OBJECT_ID" --display-name container-app-auth --years 1 --query password -o tsv)"
SP_OBJECT_ID="$(az ad sp show --id "$ENTRA_CLIENT_ID" --query id -o tsv)"
az rest --method PATCH --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$SP_OBJECT_ID" --headers Content-Type=application/json --body '{"appRoleAssignmentRequired":true}' >/dev/null

IMAGE="$ACR_SERVER/aadb-product-analytics:bootstrap"
az acr build -g "$AZURE_RESOURCE_GROUP" -r "$AZURE_CONTAINER_REGISTRY" -t "aadb-product-analytics:bootstrap" "$APP_DIR"
az deployment group create -g "$AZURE_RESOURCE_GROUP" -f "$APP_DIR/infra/main.bicep" -p \
  location="$AZURE_LOCATION" appName="$ANALYTICS_APP_NAME" containerAppsEnvironmentId="$ENVIRONMENT_ID" \
  registryName="$AZURE_CONTAINER_REGISTRY" managedIdentityName="$ANALYTICS_IDENTITY_NAME" \
  containerImage="$IMAGE" analyticsLogAnalyticsWorkspaceName="$ANALYTICS_LOG_ANALYTICS_WORKSPACE" \
  sourceLogAnalyticsWorkspaceResourceGroup="$SOURCE_LOG_ANALYTICS_WORKSPACE_RESOURCE_GROUP" \
  sourceLogAnalyticsWorkspaceName="$SOURCE_LOG_ANALYTICS_WORKSPACE" \
  entraClientId="$ENTRA_CLIENT_ID" entraTenantId="$TENANT_ID" entraClientSecret="$ENTRA_SECRET" \
  cosmosEndpoint="${AZURE_COSMOS_ENDPOINT:-}" cosmosDatabaseId="${COSMOS_DATABASE_ID:-diagrams-db}" \
  azureOpenAiEndpoint="${AZURE_OPENAI_ENDPOINT:-}" azureOpenAiDeployment="${AZURE_OPENAI_DEPLOYMENT:-}" >/dev/null

IDENTITY_PRINCIPAL_ID="$(az identity show -g "$AZURE_RESOURCE_GROUP" -n "$ANALYTICS_IDENTITY_NAME" --query principalId -o tsv)"
if [[ -n "${AZURE_COSMOS_ACCOUNT_NAME:-}" ]]; then
  COSMOS_ID="$(az cosmosdb show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_COSMOS_ACCOUNT_NAME" --query id -o tsv)"
  az cosmosdb sql role assignment create -g "$AZURE_RESOURCE_GROUP" -a "$AZURE_COSMOS_ACCOUNT_NAME" \
    --scope "$COSMOS_ID" --principal-id "$IDENTITY_PRINCIPAL_ID" \
    --role-definition-id "$COSMOS_ID/sqlRoleDefinitions/00000000-0000-0000-0000-000000000001" >/dev/null
fi
if [[ -n "${AZURE_OPENAI_RESOURCE_NAME:-}" ]]; then
  OPENAI_RG="${AZURE_OPENAI_RESOURCE_GROUP:-$AZURE_RESOURCE_GROUP}"
  OPENAI_ID="$(az cognitiveservices account show -g "$OPENAI_RG" -n "$AZURE_OPENAI_RESOURCE_NAME" --query id -o tsv)"
  az role assignment create --assignee-object-id "$IDENTITY_PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "Cognitive Services OpenAI User" --scope "$OPENAI_ID" >/dev/null
fi

CALLBACK="https://$(az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$ANALYTICS_APP_NAME" --query properties.configuration.ingress.fqdn -o tsv)/.auth/login/aad/callback"
az ad app update --id "$ENTRA_OBJECT_ID" --web-redirect-uris "$CALLBACK"
printf 'Provisioned %s in subscription %s.\nRun scripts/02-deploy.sh next.\n' "$ANALYTICS_APP_NAME" "$SUBSCRIPTION_ID"