// Service Bus Namespace
param environment string
param location string
param resourcePrefix string
param keyVaultUri string

resource sbNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01' = {
  name: '${resourcePrefix}-sbns-${environment}'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  tags: {
    environment: environment
    service: 'servicebus'
  }
}

// Output connection for consumers
output namespace string = sbNamespace.name
output endpoint string = 'sb://${sbNamespace.name}.servicebus.windows.net/'
