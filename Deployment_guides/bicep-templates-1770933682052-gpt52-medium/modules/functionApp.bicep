/*
  modules/functionApp.bicep
  Function App with system-assigned identity. Uses Storage for runtime.
  Note: Event triggers/bindings are application-level and configured in code.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object
param logAnalyticsWorkspaceId string

param storageAccountName string
param keyVaultUri string
param eventHubNamespaceName string
param serviceBusNamespaceName string
param cosmosAccountName string

@description('Functions runtime version.')
param functionsExtensionVersion string = '~4'

@description('SKU for the hosting plan. Y1 is Consumption for Functions.')
param planSku string = 'Y1'

var funcName = toLower('${baseName}-func')
var appInsightsName = toLower('${baseName}-appi')

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${baseName}-func-plan'
  location: location
  tags: tags
  sku: {
    name: planSku
    tier: planSku == 'Y1' ? 'Dynamic' : 'ElasticPremium'
  }
  properties: {
    reserved: false
  }
}

resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

// Build the storage connection string (runtime requirement). Consider using Key Vault references in app settings if desired.
var storageConn = 'DefaultEndpointsProtocol=https;AccountName=${sa.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${listKeys(sa.id, sa.apiVersion).keys[0].value}'

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: funcName
  location: location
  tags: union(tags, {
    compute: 'functions'
  })
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION'; value: functionsExtensionVersion }
        { name: 'FUNCTIONS_WORKER_RUNTIME'; value: 'dotnet-isolated' }
        { name: 'AzureWebJobsStorage'; value: storageConn }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY'; value: appi.properties.InstrumentationKey }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'; value: appi.properties.ConnectionString }

        // App-specific config (prefer Entra ID auth in code)
        { name: 'KEYVAULT_URI'; value: keyVaultUri }
        { name: 'EVENTHUB_NAMESPACE_FQDN'; value: '${eventHubNamespaceName}.servicebus.windows.net' }
        { name: 'SERVICEBUS_NAMESPACE_FQDN'; value: '${serviceBusNamespaceName}.servicebus.windows.net' }
        { name: 'COSMOS_ACCOUNT_ENDPOINT'; value: 'https://${cosmosAccountName}.documents.azure.com:443/' }
        { name: 'STORAGE_ACCOUNT_NAME'; value: storageAccountName }
      ]
    }
  }
}

output functionAppName string = site.name
output functionDefaultHostname string = site.properties.defaultHostName
output functionPrincipalId string = site.identity.principalId
