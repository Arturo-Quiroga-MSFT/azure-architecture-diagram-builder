/*
  modules/serviceBus.bicep
  Service Bus for ordered routing and processing.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object
param logAnalyticsWorkspaceId string

@description('Service Bus SKU (Basic/Standard/Premium).')
param skuName string = 'Standard'

var nsName = toLower('${baseName}-sbns')

resource ns 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: nsName
  location: location
  tags: union(tags, {
    messaging: 'servicebus'
  })
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource queue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  name: '${ns.name}/imaging-queue'
  properties: {
    enablePartitioning: true
    lockDuration: 'PT1M'
    maxDeliveryCount: 10
    deadLetteringOnMessageExpiration: true
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${baseName}-sb-diag'
  scope: ns
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'OperationalLogs'
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

output serviceBusNamespaceName string = ns.name
output serviceBusNamespaceId string = ns.id
output serviceBusNamespaceFqdn string = '${ns.name}.servicebus.windows.net'
output serviceBusQueueName string = 'imaging-queue'
