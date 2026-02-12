/*
  modules/storage.bicep
  Storage Account with secure defaults and diagnostics.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object
param logAnalyticsWorkspaceId string

@description('Storage account SKU.')
param skuName string = 'Standard_LRS'

var saName = toLower(replace('${baseName}sa', '-', ''))

resource sa 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: saName
  location: location
  tags: union(tags, {
    dataClassification: 'PHI'
    storage: 'imaging'
  })
  sku: {
    name: skuName
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
    encryption: {
      services: {
        blob: { enabled: true }
        file: { enabled: true }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${sa.name}/default/imaging'
  properties: {
    publicAccess: 'None'
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${baseName}-sa-diag'
  scope: sa
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'StorageRead'
        enabled: true
      }
      {
        category: 'StorageWrite'
        enabled: true
      }
      {
        category: 'StorageDelete'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
    ]
  }
}

output storageAccountName string = sa.name
output storageAccountId string = sa.id
