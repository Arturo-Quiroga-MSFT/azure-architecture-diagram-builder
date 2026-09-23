targetScope = 'resourceGroup'

@description('Azure region for the analytics resources.')
param location string = resourceGroup().location

@description('Container App name.')
param appName string = 'aadb-usage-analytics'

@description('Existing Container Apps environment resource ID.')
param containerAppsEnvironmentId string

@description('Existing ACR login server, for example contoso.azurecr.io.')
param registryName string

@description('Dedicated user-assigned managed identity name.')
param managedIdentityName string = 'id-aadb-usage-analytics'

@description('Container image built by the deployment script.')
param containerImage string

@description('Existing Log Analytics workspace used for this analytics app observability.')
param analyticsLogAnalyticsWorkspaceName string

@description('Resource group containing the AADB source telemetry workspace.')
param sourceLogAnalyticsWorkspaceResourceGroup string

@description('Existing Log Analytics workspace containing AADB usage telemetry.')
param sourceLogAnalyticsWorkspaceName string

@description('Microsoft Entra application client ID for Container Apps built-in authentication.')
param entraClientId string

@description('Microsoft Entra tenant ID.')
param entraTenantId string

@secure()
@description('Microsoft Entra application client secret used only by Container Apps built-in authentication.')
param entraClientSecret string

@description('Optional Cosmos DB endpoint for durable AADB feedback.')
param cosmosEndpoint string = ''

@description('Cosmos DB database containing durable AADB feedback.')
param cosmosDatabaseId string = 'diagrams-db'

@description('Optional Azure OpenAI endpoint for aggregate-only recommendation enhancement.')
param azureOpenAiEndpoint string = ''

@description('Optional Azure OpenAI deployment name.')
param azureOpenAiDeployment string = ''

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: registryName
}

resource analyticsLogAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: analyticsLogAnalyticsWorkspaceName
}

resource sourceLogAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  scope: resourceGroup(sourceLogAnalyticsWorkspaceResourceGroup)
  name: sourceLogAnalyticsWorkspaceName
}

resource analyticsIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdentityName
  location: location
}

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, analyticsIdentity.id, 'acrpull')
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: analyticsIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

module sourceWorkspaceRole './source-workspace-role.bicep' = {
  name: 'sourceWorkspaceRole'
  scope: resourceGroup(sourceLogAnalyticsWorkspaceResourceGroup)
  params: {
    workspaceName: sourceLogAnalyticsWorkspaceName
    principalId: analyticsIdentity.properties.principalId
  }
}

resource analyticsInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: analyticsLogAnalyticsWorkspace.id
  }
}

resource analyticsApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${analyticsIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        { server: registry.properties.loginServer, identity: analyticsIdentity.id }
      ]
      secrets: [
        { name: 'entra-client-secret', value: entraClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'analytics'
          image: containerImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'PORT', value: '8080' }
            { name: 'AZURE_CLIENT_ID', value: analyticsIdentity.properties.clientId }
            { name: 'LOG_ANALYTICS_WORKSPACE_ID', value: sourceLogAnalyticsWorkspace.properties.customerId }
            { name: 'ANALYTICS_CACHE_TTL_SECONDS', value: '120' }
            { name: 'AZURE_COSMOS_ENDPOINT', value: cosmosEndpoint }
            { name: 'COSMOS_DATABASE_ID', value: cosmosDatabaseId }
            { name: 'COSMOS_FEEDBACK_CONTAINER_ID', value: 'feedback' }
            { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
            { name: 'AZURE_OPENAI_DEPLOYMENT', value: azureOpenAiDeployment }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: analyticsInsights.properties.ConnectionString }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/api/health', port: 8080, scheme: 'HTTP' }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/api/health', port: 8080, scheme: 'HTTP' }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
        rules: [
          { name: 'http', http: { metadata: { concurrentRequests: '50' } } }
        ]
      }
    }
  }
  dependsOn: [ acrPullRole, sourceWorkspaceRole ]
}

resource authConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: analyticsApp
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          clientSecretSettingName: 'entra-client-secret'
          openIdIssuer: '${environment().authentication.loginEndpoint}${entraTenantId}/v2.0'
        }
        validation: {
          allowedAudiences: [ entraClientId, 'api://${entraClientId}' ]
        }
      }
    }
    login: { tokenStore: { enabled: false } }
  }
}

output appName string = analyticsApp.name
output appFqdn string = analyticsApp.properties.configuration.ingress.fqdn
output appUrl string = 'https://${analyticsApp.properties.configuration.ingress.fqdn}'
output applicationInsightsName string = analyticsInsights.name
output managedIdentityName string = analyticsIdentity.name
output managedIdentityPrincipalId string = analyticsIdentity.properties.principalId
