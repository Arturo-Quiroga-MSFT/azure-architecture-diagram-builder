/* modules/keyVaultRbac.bicep */

targetScope = 'resourceGroup'

param keyVaultName string
param principalId string

resource kv 'Microsoft.KeyVault/vaults@2024-11-01' existing = {
  name: keyVaultName
}

// Built-in role: Key Vault Secrets User
var keyVaultSecretsUserRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, principalId, keyVaultSecretsUserRoleDefinitionId)
  scope: kv
  properties: {
    principalId: principalId
    roleDefinitionId: keyVaultSecretsUserRoleDefinitionId
    principalType: 'ServicePrincipal'
  }
}
