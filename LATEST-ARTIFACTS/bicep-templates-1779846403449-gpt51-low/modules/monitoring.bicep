param baseName string
param location string
param tags object
param iotHubId string
param storageAccountId string

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${baseName}-law'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource iotHubDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${baseName}-iothub-diag'
  scope: resource(iotHubId, 'Microsoft.Devices/IotHubs')
  properties: {
    workspaceId: law.id
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    logs: [
      {
        category: 'Operations'
        enabled: true
      }
    ]
  }
}

resource storageDiag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${baseName}-stg-diag'
  scope: resource(storageAccountId, 'Microsoft.Storage/storageAccounts')
  properties: {
    workspaceId: law.id
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
    ]
    logs: [
      {
        category: 'StorageRead'
        enabled: true
      }
    ]
  }
}

output logAnalyticsWorkspaceName string = law.name
output logAnalyticsWorkspaceId string = law.id
