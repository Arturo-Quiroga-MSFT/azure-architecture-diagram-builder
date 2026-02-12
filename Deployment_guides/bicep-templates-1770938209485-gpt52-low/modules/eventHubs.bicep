/* modules/eventHubs.bicep */

targetScope = 'resourceGroup'

param namespaceName string
param eventHubName string
param location string
param tags object
param logAnalyticsWorkspaceId string

resource ehns 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: namespaceName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
    capacity: 1
  }
  properties: {
    isAutoInflateEnabled: true
    maximumThroughputUnits: 2
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource eh 'Microsoft.EventHub/namespaces/eventhubs@2024-01-01' = {
  parent: ehns
  name: eventHubName
  properties: {
    messageRetentionInDays: 1
    partitionCount: 4
    status: 'Active'
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${namespaceName}-diag'
  scope: ehns
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'OperationalLogs'
        enabled: true
      }
      {
        category: 'ArchiveLogs'
        enabled: false
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

output namespaceName string = ehns.name
output eventHubName string = eh.name
output namespaceHostName string = '${ehns.name}.servicebus.windows.net'
