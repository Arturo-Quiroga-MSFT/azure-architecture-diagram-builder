/*
  modules/keyVault.bicep
  Key Vault with RBAC authorization (recommended) and soft delete.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object

@description('Key Vault SKU name.')
param skuName string = 'standard'

resource kv 'Microsoft.KeyVault/vaults@2024-04-01' = {
  name: toLower('${baseName}-kv')
  location: location
  tags: union(tags, {
    dataClassification: 'PHI'
    security: 'keyvault'
  })
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    sku: {
      name: skuName
      family: 'A'
    }
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

output keyVaultId string = kv.id
output keyVaultName string = kv.name
output keyVaultUri string = kv.properties.vaultUri
