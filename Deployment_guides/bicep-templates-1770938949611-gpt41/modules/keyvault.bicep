// Key Vault
param environment string
param location string
param resourcePrefix string

resource kv 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: '${resourcePrefix}-kv-${environment}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [] // Policies added by module consumers
    enabledForDeployment: true
    enabledForTemplateDeployment: true
  }
  tags: {
    environment: environment
    service: 'keyvault'
  }
}

output keyVaultUri string = kv.properties.vaultUri
