// azurefunctions.bicep

param location string
param environment string
param tags object
param keyVaultId string
param eventHubsNamespace string
param serviceBusNamespace string

resource appServicePlan 'Microsoft.Web/serverfarms@2021-02-01' = {
  name: 'imaging-functions-plan-${environment}'
  location: location
  tags: tags
  sku: {
    name: 'Y1' // Consumption Plan
    tier: 'Dynamic'
  }
}

resource functionApp 'Microsoft.Web/sites@2021-02-01' = {
  name: 'imaging-functions-${environment}'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'UseDevelopmentStorage=true'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet'
        }
        {
          name: 'EVENTHUB_NAMESPACE'
          value: eventHubsNamespace
        }
        {
          name: 'SERVICEBUS_NAMESPACE'
          value: serviceBusNamespace
        }
        {
          name: 'KEYVAULT_URI'
          value: keyVaultId
        }
      ]
    }
  }
  dependsOn: [appServicePlan]
}

output functionAppName string = functionApp.name