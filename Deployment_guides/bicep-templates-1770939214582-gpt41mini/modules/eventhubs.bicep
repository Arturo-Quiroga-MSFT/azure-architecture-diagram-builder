// eventhubs.bicep

param location string
param environment string
param tags object
param keyVaultId string

resource eventHubsNamespace 'Microsoft.EventHub/namespaces@2021-06-01-preview' = {
  name: 'imaging-eh-${environment}'
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
    capacity: 1
  }
  properties: {
    isAutoInflateEnabled: false
    zoneRedundant: false
  }
}

resource imagingEventHub 'Microsoft.EventHub/namespaces/eventhubs@2021-06-01-preview' = {
  parent: eventHubsNamespace
  name: 'imagingevents'
  properties: {
    messageRetentionInDays: 7
    partitionCount: 4
    status: 'Active'
  }
}

output eventHubsNamespace string = eventHubsNamespace.name
output eventHubsNamespaceId string = eventHubsNamespace.id