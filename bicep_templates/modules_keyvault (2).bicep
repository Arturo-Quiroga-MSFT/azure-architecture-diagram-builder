/*
  modules/keyvault.bicep
  Key Vault configured for Private Link:
  - publicNetworkAccess can be Disabled
  - RBAC authorization enabled
*/

targetScope = 'resourceGroup'

param name string
param location string
param tags object
param enableSoftDelete bool = true
param enablePurgeProtection bool = false
@allowed([
  'Enabled'
  'Disabled'
])
param publicNetworkAccess string = 'Disabled'

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: enableSoftDelete
    enablePurgeProtection: enablePurgeProtection
    publicNetworkAccess: publicNetworkAccess
    sku: {
      family: 'A'
      name: 'standard'
    }
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Deny'
    }
  }
}

output keyVaultId string = kv.id
output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
