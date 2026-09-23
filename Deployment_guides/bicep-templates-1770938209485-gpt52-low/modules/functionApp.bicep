/* modules/functionApp.bicep */

targetScope = 'resourceGroup'

param name string
param location string
param tags object
param logAnalyticsWorkspaceId string
param storageAccountName string
param keyVaultName string
param cosmosAccountName string
param serviceBusNamespaceName string

resource stg 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource kv 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${name}-plan'
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {}
}

resource app 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|8.0'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        // Runtime settings
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
        // Key Vault references (Secrets are created by modules/keyVaultSecrets.bicep)
        {
          name: 'AzureWebJobsStorage'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/StorageConnectionString)'
        }
        {
          name: 'Cosmos__Endpoint'
          value: 'https://${cosmosAccountName}.documents.azure.com:443/'
        }
        {
          name: 'Cosmos__Key'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/CosmosPrimaryKey)'
        }
        {
          name: 'ServiceBus__Connection'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVaultName}.vault.azure.net/secrets/ServiceBusConnectionString)'
        }
        {
          name: 'ServiceBus__Namespace'
          value: '${serviceBusNamespaceName}.servicebus.windows.net'
        }
      ]
    }
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${name}-diag'
  scope: app
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'FunctionAppLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output functionName string = app.name
output functionHostName string = app.properties.defaultHostName
output functionPrincipalId string = app.identity.principalId
