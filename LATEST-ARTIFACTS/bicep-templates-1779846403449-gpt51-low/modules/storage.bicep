param baseName string
param location string
param vnetId string
param subnetId string
param tags object

@description('Storage account SKU')
param storageSku string = 'Standard_LRS'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: toLower('${baseName}stg')
  location: location
  kind: 'StorageV2'
  sku: {
    name: storageSku
  }
  tags: tags
  properties: {
    accessTier: 'Hot'
    isHnsEnabled: true // ADLS Gen2
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
      virtualNetworkRules: [
        {
          virtualNetworkResourceId: vnetId
          action: 'Allow'
        }
      ]
    }
  }
}

// Lifecycle management: 6-month hot, archive for long-term
resource managementPolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2022-09-01' = {
  name: 'default'
  parent: storageAccount
  properties: {
    policy: {
      rules: [
        {
          enabled: true
          name: 'move-to-cool-after-180-days'
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 180
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 365
                }
                delete: {
                  daysAfterModificationGreaterThan: 365 * 7
                }
              }
            }
          }
        }
      ]
    }
  }
}

// Private endpoint for Blob (optional; can be extended for DFS)
resource peBlob 'Microsoft.Network/privateEndpoints@2023-04-01' = {
  name: '${storageAccount.name}-pe-blob'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'blob'
        properties: {
          privateLinkServiceId: storageAccount.id
          groupIds: ['blob']
        }
      }
    ]
  }
}

output dataLakeStorageName string = storageAccount.name
output dataLakeStorageId string = storageAccount.id
