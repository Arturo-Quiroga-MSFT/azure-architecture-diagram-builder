param baseName string
param location string
param storageAccountId string
param tags object

resource amlWorkspace 'Microsoft.MachineLearningServices/workspaces@2024-01-01' = {
  name: '${baseName}-mlw'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    storageAccount: {
      resourceId: storageAccountId
    }
    publicNetworkAccess: 'Enabled'
    sku: {
      name: 'Basic'
      tier: 'Basic'
    }
  }
}

// Placeholder outputs; actual endpoint and keys depend on deployed models
output amlWorkspaceName string = amlWorkspace.name
output amlWorkspaceUrl string = amlWorkspace.properties.discoveryUrl
output amlPrimaryKey string = 'AML_PRIMARY_KEY_PLACEHOLDER'
