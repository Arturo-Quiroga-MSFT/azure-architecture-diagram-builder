// main.bicep — subscription-scoped entry point for azd
// Provisions the resource group and all resources for the
// Azure Architecture Diagram Builder.
targetScope = 'subscription'

// ── Environment ────────────────────────────────────────────────────────────────
@minLength(1)
@maxLength(64)
@description('Name of the azd environment (used to derive resource names).')
param environmentName string

@minLength(1)
@description('Primary Azure region for all resources.')
param location string

// ── Microsoft Foundry / Azure OpenAI ──────────────────────────────────────────
@description('Provision a destination-owned Microsoft Foundry resource and model deployment. Set false to use an existing endpoint.')
param deployFoundry bool = true

@description('Model name provisioned by the greenfield Foundry path.')
param foundryModelName string = 'gpt-5.6-luna'

@description('Model version provisioned by the greenfield Foundry path.')
param foundryModelVersion string = '2026-07-09'

@description('Deployment name exposed to the AADB web application.')
param foundryDeploymentName string = 'gpt-5.6-luna'

@allowed([
  'GlobalStandard'
  'DataZoneStandard'
])
@description('Model deployment SKU. Confirm regional availability and quota before provisioning.')
param foundryModelSkuName string = 'GlobalStandard'

@minValue(1)
@description('Model deployment capacity in thousands of tokens per minute.')
param foundryModelCapacity int = 10

@description('Existing Azure OpenAI endpoint URL used only when deployFoundry is false.')
param azureOpenAiEndpoint string = ''

@secure()
@description('Existing Azure OpenAI API key used only when deployFoundry is false. Prefer managed identity.')
param azureOpenAiApiKey string = ''

@description('GPT-5.1 deployment name.')
param openAiDeploymentGpt51 string = ''

@description('GPT-5.2 deployment name.')
param openAiDeploymentGpt52 string = ''

@description('GPT-5.2 Codex deployment name.')
param openAiDeploymentGpt52Codex string = ''

@description('GPT-5.3 Codex deployment name.')
param openAiDeploymentGpt53Codex string = ''

@description('GPT-5.4 deployment name.')
param openAiDeploymentGpt54 string = ''

@description('GPT-5.4 Mini deployment name.')
param openAiDeploymentGpt54Mini string = ''

@description('GPT-5.6 Luna deployment name used only when deployFoundry is false.')
param openAiDeploymentGpt56Luna string = ''

@description('DeepSeek deployment name.')
param openAiDeploymentDeepSeek string = ''

@description('Grok Fast deployment name.')
param openAiDeploymentGrokFast string = ''

// ── Avatar presenter (Speech) ──────────────────────────────────────────────────
@description('Provision an Azure Speech resource for the avatar presenter feature.')
param deploySpeech bool = true

@description('Azure region for the Speech resource (must support Avatar API: westus2, eastus2, etc.).')
param speechRegion string = 'westus2'

// ── Diagram persistence (Cosmos DB) ───────────────────────────────────────────
@description('Provision an Azure Cosmos DB account for saving diagrams across sessions.')
param deployCosmos bool = false

// ── MCP server (decoupled Container App) ──────────────────────────────────────
@secure()
@description('Optional bearer token required on the MCP /mcp endpoint. Empty = open.')
param mcpAuthToken string = ''

// ── Internals ──────────────────────────────────────────────────────────────────
var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

// ── Resource group ─────────────────────────────────────────────────────────────
resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// ── All resources ──────────────────────────────────────────────────────────────
module resources './resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    abbrs: abbrs
    resourceToken: resourceToken
    deploySpeech: deploySpeech
    speechRegion: speechRegion
    deployCosmos: deployCosmos
    mcpAuthToken: mcpAuthToken
    deployFoundry: deployFoundry
    foundryModelName: foundryModelName
    foundryModelVersion: foundryModelVersion
    foundryDeploymentName: foundryDeploymentName
    foundryModelSkuName: foundryModelSkuName
    foundryModelCapacity: foundryModelCapacity
    azureOpenAiEndpoint: azureOpenAiEndpoint
    azureOpenAiApiKey: azureOpenAiApiKey
  }
}

// ── Outputs captured by azd ────────────────────────────────────────────────────
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_RESOURCE_GROUP string = rg.name

// Container registry — azd uses this to push the built image
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.registryName

// Container app — azd locates it by the azd-service-name tag, but the name is
// also emitted here for reference and for the pre-package hook.
output SERVICE_APP_NAME string = resources.outputs.containerAppName
output SERVICE_APP_IDENTITY_PRINCIPAL_ID string = resources.outputs.appIdentityPrincipalId

// App URL
output SERVICE_APP_URL string = 'https://${resources.outputs.containerAppFqdn}'

// MCP server (decoupled) — azd locates it by the azd-service-name: mcp tag.
output SERVICE_MCP_NAME string = resources.outputs.mcpAppName
output SERVICE_MCP_URL string = 'https://${resources.outputs.mcpAppFqdn}'
output MCP_ENDPOINT string = 'https://${resources.outputs.mcpAppFqdn}/mcp'

// Microsoft Foundry / Azure OpenAI — captured by azd and consumed by the
// pre-package hook and the web app's runtime proxy.
output AZURE_AI_ACCOUNT_NAME string = resources.outputs.foundryAccountName
output AZURE_AI_ACCOUNT_ID string = resources.outputs.foundryAccountId
output AZURE_OPENAI_ENDPOINT string = resources.outputs.azureOpenAiEndpoint
output AZURE_OPENAI_DEPLOYMENT_NAME string = openAiDeploymentGpt51
output AZURE_OPENAI_DEPLOYMENT_GPT52 string = openAiDeploymentGpt52
output AZURE_OPENAI_DEPLOYMENT_GPT52CODEX string = openAiDeploymentGpt52Codex
output AZURE_OPENAI_DEPLOYMENT_GPT53CODEX string = openAiDeploymentGpt53Codex
output AZURE_OPENAI_DEPLOYMENT_GPT54 string = openAiDeploymentGpt54
output AZURE_OPENAI_DEPLOYMENT_GPT54MINI string = openAiDeploymentGpt54Mini
output AZURE_OPENAI_DEPLOYMENT_GPT56LUNA string = deployFoundry ? foundryDeploymentName : openAiDeploymentGpt56Luna
output AZURE_OPENAI_DEPLOYMENT_DEEPSEEK string = openAiDeploymentDeepSeek
output AZURE_OPENAI_DEPLOYMENT_GROK4FAST string = openAiDeploymentGrokFast

// Speech
output AZURE_SPEECH_REGION string = resources.outputs.speechRegionOut
output AZURE_SPEECH_RESOURCE_ID string = resources.outputs.speechResourceId

// Cosmos DB (empty strings when deployCosmos = false)
output AZURE_COSMOS_ENDPOINT string = resources.outputs.cosmosEndpoint
output COSMOS_DATABASE_ID string = resources.outputs.cosmosDatabaseId
output COSMOS_CONTAINER_ID string = resources.outputs.cosmosContainerId

// App Insights — used by the pre-package hook to write .env.appinsights
output APPLICATIONINSIGHTS_CONNECTION_STRING string = resources.outputs.appInsightsConnectionString
