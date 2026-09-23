/*
  modules/roleAssignments.bicep
  Creates a single RBAC role assignment.
*/

targetScope = 'resourceGroup'

@description('Principal (object) ID to assign the role to.')
param principalId string

@description('Role definition ID (GUID). Example: Key Vault Secrets User = 4633458b-17de-408a-b874-0445c86b69e6')
param roleDefinitionId string

@description('Scope for the role assignment (resource ID).')
param scope string

// Deterministic GUID for idempotency
var raName = guid(scope, principalId, roleDefinitionId)

resource ra 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: raName
  scope: scope
  properties: {
    principalId: principalId
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalType: 'ServicePrincipal'
  }
}
