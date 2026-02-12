// servicebus.bicep

param location string
param environment string
param tags object

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2021-06-01-preview' = {
  name: 'imaging-sb-${environment}'
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
}

resource imagingQueue 'Microsoft.ServiceBus/namespaces/queues@2021-06-01-preview' = {
  parent: serviceBusNamespace
  name: 'imagingnotifications'
  properties: {
    enablePartitioning: true
  }
}

output serviceBusNamespace string = serviceBusNamespace.name
output serviceBusNamespaceId string = serviceBusNamespace.id