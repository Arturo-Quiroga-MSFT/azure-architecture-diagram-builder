/* modules/keyVault.bicep */

targetScope = 'resourceGroup'

param name string
param location string
param tags object

resource kv 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      name: 'standard'
      family: 'A'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    accessPolicies: []
  }
}

output name string = kv.name
output vaultUri string = kv.properties.vaultUri
output id string = kv.id
