// keyvault.bicep

param location string
param environment string
param tags object

resource keyVault 'Microsoft.KeyVault/vaults@2022-07-01' = {
  name: 'imaging-keyvault-${environment}'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: [] // Access policies to be added post deployment or dynamically
    enabledForDeployment: true
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
  }
}

output keyVaultUri string = keyVault.properties.vaultUri
output keyVaultResourceId string = keyVault.id