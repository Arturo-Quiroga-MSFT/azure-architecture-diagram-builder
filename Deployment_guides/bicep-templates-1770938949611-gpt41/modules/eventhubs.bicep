// Event Hubs Namespace
param environment string
param location string
param resourcePrefix string
param keyVaultUri string

resource ehNamespace 'Microsoft.EventHub/namespaces@2023-01-01' = {
  name: '${resourcePrefix}-ehns-${environment}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
    capacity: 2
  }
  tags: {
    environment: environment
    service: 'eventhubs'
  }
}

resource eventHub 'Microsoft.EventHub/namespaces/eventhubs@2023-01-01' = {
  name: '${ehNamespace.name}/imaging-events'
}

// Diagnostic Settings (Log Analytics)
output namespace string = ehNamespace.name
output endpoint string = 'sb://${ehNamespace.name}.servicebus.windows.net/'
