/* modules/serviceBus.bicep */

targetScope = 'resourceGroup'

param namespaceName string
param queueName string
param location string
param tags object
param logAnalyticsWorkspaceId string

resource sbns 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: namespaceName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource queue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  parent: sbns
  name: queueName
  properties: {
    lockDuration: 'PT1M'
    maxSizeInMegabytes: 1024
    requiresDuplicateDetection: false
    deadLetteringOnMessageExpiration: true
    defaultMessageTimeToLive: 'P14D'
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${namespaceName}-diag'
  scope: sbns
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

// Connection string (for legacy clients; prefer AAD + RBAC)
var authRuleId = resourceId('Microsoft.ServiceBus/namespaces/authorizationRules', namespaceName, 'RootManageSharedAccessKey')

output namespaceName string = sbns.name
output namespaceHostName string = '${sbns.name}.servicebus.windows.net'
@secure()
output connectionString string = listKeys(authRuleId, '2017-04-01').primaryConnectionString
