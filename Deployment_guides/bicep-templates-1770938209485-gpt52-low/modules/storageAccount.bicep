/* modules/storageAccount.bicep */

targetScope = 'resourceGroup'

param name string
param location string
param tags object

resource stg 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
    encryption: {
      services: {
        blob: {
          enabled: true
        }
        file: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  name: '${stg.name}/default/imaging'
  properties: {
    publicAccess: 'None'
  }
}

var key = listKeys(stg.id, '2023-05-01').keys[0].value

output name string = stg.name
output blobEndpoint string = stg.properties.primaryEndpoints.blob
@secure()
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${stg.name};AccountKey=${key};EndpointSuffix=${environment().suffixes.storage}'
