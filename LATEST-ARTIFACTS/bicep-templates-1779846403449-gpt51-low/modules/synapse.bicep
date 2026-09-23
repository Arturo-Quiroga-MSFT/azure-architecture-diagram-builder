param baseName string
param location string
param storageAccountName string
param tags object

resource synWorkspace 'Microsoft.Synapse/workspaces@2021-06-01' = {
  name: '${baseName}-syn'
  location: location
  tags: tags
  properties: {
    defaultDataLakeStorage: {
      accountName: storageAccountName
      // filesystemName can be configured post-deployment
      filesystem: 'synfs'
    }
    sqlAdministratorLogin: 'sqladmin'
    sqlAdministratorLoginPassword: 'ChangeMe123!'
    managedResourceGroupName: '${baseName}-syn-mrg'
  }
}

output synapseWorkspaceName string = synWorkspace.name
