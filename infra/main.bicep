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

// ── Azure OpenAI (bring-your-own) ─────────────────────────────────────────────
@description('Your Azure OpenAI endpoint URL.')
param azureOpenAiEndpoint string = ''

@secure()
@description('Your Azure OpenAI API key.')
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
    azureOpenAiEndpoint: azureOpenAiEndpoint
    azureOpenAiApiKey: azureOpenAiApiKey
    openAiDeploymentGpt51: openAiDeploymentGpt51
    openAiDeploymentGpt52: openAiDeploymentGpt52
    openAiDeploymentGpt52Codex: openAiDeploymentGpt52Codex
    openAiDeploymentGpt53Codex: openAiDeploymentGpt53Codex
    openAiDeploymentGpt54: openAiDeploymentGpt54
    openAiDeploymentDeepSeek: openAiDeploymentDeepSeek
    openAiDeploymentGrokFast: openAiDeploymentGrokFast
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

// Azure OpenAI — passed through to build-time Vite variables by the pre-package hook
output AZURE_OPENAI_ENDPOINT string = azureOpenAiEndpoint
output AZURE_OPENAI_API_KEY string = azureOpenAiApiKey
output AZURE_OPENAI_DEPLOYMENT_NAME string = openAiDeploymentGpt51
output AZURE_OPENAI_DEPLOYMENT_GPT52 string = openAiDeploymentGpt52
output AZURE_OPENAI_DEPLOYMENT_GPT52CODEX string = openAiDeploymentGpt52Codex
output AZURE_OPENAI_DEPLOYMENT_GPT53CODEX string = openAiDeploymentGpt53Codex
output AZURE_OPENAI_DEPLOYMENT_GPT54 string = openAiDeploymentGpt54
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
