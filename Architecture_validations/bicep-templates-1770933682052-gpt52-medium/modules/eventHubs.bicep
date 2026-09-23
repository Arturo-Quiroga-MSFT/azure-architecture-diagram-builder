/*
  modules/eventHubs.bicep
  Event Hubs for imaging event ingestion.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object
param logAnalyticsWorkspaceId string

@description('Event Hubs SKU tier.')
param skuName string = 'Standard'

var nsName = toLower('${baseName}-ehns')

resource ns 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: nsName
  location: location
  tags: union(tags, {
    messaging: 'eventhubs'
  })
  sku: {
    name: skuName
    tier: skuName
    capacity: 1
  }
  properties: {
    isAutoInflateEnabled: true
    maximumThroughputUnits: 4
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource hub 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  name: '${ns.name}/imaging-events'
  properties: {
    messageRetentionInDays: 1
    partitionCount: 4
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${baseName}-eh-diag'
  scope: ns
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'OperationalLogs'
        enabled: true
      }
      {
        category: 'AutoScaleLogs'
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

output eventHubNamespaceName string = ns.name
output eventHubNamespaceId string = ns.id
output eventHubNamespaceFqdn string = '${ns.name}.servicebus.windows.net'
output eventHubName string = hub.name
