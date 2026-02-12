/* modules/keyVaultSecrets.bicep */

targetScope = 'resourceGroup'

param keyVaultName string
param tags object

@secure()
param storageConnectionString string
@secure()
param cosmosPrimaryKey string
@secure()
param serviceBusConnectionString string

resource kv 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

// Secret names are referenced by Function app settings
resource stgSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = {
  parent: kv
  name: 'StorageConnectionString'
  tags: tags
  properties: {
    value: storageConnectionString
  }
}

resource cosmosSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = {
  parent: kv
  name: 'CosmosPrimaryKey'
  tags: tags
  properties: {
    value: cosmosPrimaryKey
  }
}

resource sbSecret 'Microsoft.KeyVault/vaults/secrets@2024-11-01' = {
  parent: kv
  name: 'ServiceBusConnectionString'
  tags: tags
  properties: {
    value: serviceBusConnectionString
  }
}

output storageSecretUri string = stgSecret.properties.secretUriWithVersion
output cosmosSecretUri string = cosmosSecret.properties.secretUriWithVersion
output serviceBusSecretUri string = sbSecret.properties.secretUriWithVersion
