// resources.bicep — all resources deployed into the resource group
targetScope = 'resourceGroup'

param location string
param tags object
param abbrs object
param resourceToken string

// Feature flags
param deploySpeech bool
param speechRegion string
param deployCosmos bool

// Azure OpenAI (passed through to container app env; not provisioned here)
param azureOpenAiEndpoint string
@secure()
param azureOpenAiApiKey string
param openAiDeploymentGpt51 string
param openAiDeploymentGpt52 string
param openAiDeploymentGpt52Codex string
param openAiDeploymentGpt53Codex string
param openAiDeploymentGpt54 string
param openAiDeploymentDeepSeek string
param openAiDeploymentGrokFast string

// ── Log Analytics ──────────────────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ── Application Insights ───────────────────────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${abbrs.insightsComponents}${resourceToken}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── Container Registry ─────────────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${abbrs.containerRegistryRegistries}${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// ── User-assigned Managed Identity ────────────────────────────────────────────
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${abbrs.managedIdentityUserAssignedIdentities}app-${resourceToken}'
  location: location
  tags: tags
}

// ── AcrPull role → managed identity ──────────────────────────────────────────
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, appIdentity.id, 'acrpull')
  scope: acr
  properties: {
    // AcrPull built-in role
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    )
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Container Apps Environment ────────────────────────────────────────────────
resource caEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${abbrs.appManagedEnvironments}${resourceToken}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ── Speech (optional) ─────────────────────────────────────────────────────────
resource speech 'Microsoft.CognitiveServices/accounts@2023-05-01' = if (deploySpeech) {
  name: '${abbrs.cognitiveServicesSpeech}${resourceToken}'
  // Speech Avatar API is only available in select regions; use the caller-supplied region.
  location: speechRegion
  tags: tags
  kind: 'SpeechServices'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${abbrs.cognitiveServicesSpeech}${resourceToken}'
    publicNetworkAccess: 'Enabled'
  }
}

// Cognitive Services Speech User role → managed identity
resource speechUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deploySpeech) {
  name: guid(deploySpeech ? speech.id : resourceToken, appIdentity.id, 'speechuser')
  scope: speech
  properties: {
    // Cognitive Services Speech User built-in role
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'f2dc8367-1007-4938-bd23-fe263f013447'
    )
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Cosmos DB (optional) ──────────────────────────────────────────────────────
var cosmosDatabaseId = 'diagrams'
var cosmosContainerId = 'diagrams'

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = if (deployCosmos) {
  name: '${abbrs.documentDBDatabaseAccounts}${resourceToken}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [
      { locationName: location, failoverPriority: 0, isZoneRedundant: false }
    ]
    enableFreeTier: true
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = if (deployCosmos) {
  parent: cosmos
  name: cosmosDatabaseId
  properties: {
    resource: { id: cosmosDatabaseId }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = if (deployCosmos) {
  parent: cosmosDb
  name: cosmosContainerId
  properties: {
    resource: {
      id: cosmosContainerId
      partitionKey: { paths: ['/id'], kind: 'Hash' }
    }
  }
}

// Cosmos DB Built-in Data Contributor → managed identity
resource cosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = if (deployCosmos) {
  parent: cosmos
  name: guid(deployCosmos ? cosmos.id : resourceToken, appIdentity.id, 'cosmoscontributor')
  properties: {
    roleDefinitionId: '${deployCosmos ? cosmos.id : ''}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: appIdentity.properties.principalId
    scope: deployCosmos ? cosmos.id : ''
  }
}

// ── Container App ─────────────────────────────────────────────────────────────
// azd locates the service by the 'azd-service-name' tag value matching
// the service key in azure.yaml ('app').
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${abbrs.appContainerApps}diagram-builder-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'app' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: caEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: appIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'app'
          // Placeholder image replaced by 'azd deploy'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: { cpu: json('0.5'), memory: '1.0Gi' }
          env: [
            // Identity — lets DefaultAzureCredential pick up the managed identity
            { name: 'AZURE_CLIENT_ID', value: appIdentity.properties.clientId }
            // Speech
            { name: 'AZURE_SPEECH_REGION', value: deploySpeech ? speech.location : '' }
            { name: 'AZURE_SPEECH_RESOURCE_ID', value: deploySpeech ? speech.id : '' }
            // Cosmos DB
            { name: 'AZURE_COSMOS_ENDPOINT', value: deployCosmos ? cosmos.properties.documentEndpoint : '' }
            { name: 'COSMOS_DATABASE_ID', value: deployCosmos ? cosmosDatabaseId : '' }
            { name: 'COSMOS_CONTAINER_ID', value: deployCosmos ? cosmosContainerId : '' }
            // Public URL (self-referential — set after first deploy if needed)
            {
              name: 'PUBLIC_URL'
              value: 'https://${abbrs.appContainerApps}diagram-builder-${resourceToken}.${caEnv.properties.defaultDomain}'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────────
output registryLoginServer string = acr.properties.loginServer
output registryName string = acr.name
output appIdentityPrincipalId string = appIdentity.properties.principalId
output containerAppName string = containerApp.name
output containerAppFqdn string = containerApp.properties.configuration.ingress.fqdn
output speechRegionOut string = deploySpeech ? speech.location : ''
output speechResourceId string = deploySpeech ? speech.id : ''
output cosmosEndpoint string = deployCosmos ? cosmos.properties.documentEndpoint : ''
output cosmosDatabaseId string = deployCosmos ? cosmosDatabaseId : ''
output cosmosContainerId string = deployCosmos ? cosmosContainerId : ''
output appInsightsConnectionString string = appInsights.properties.ConnectionString
