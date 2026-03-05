/*
  modules/loganalytics.bicep
*/

targetScope = 'resourceGroup'

param name string
param location string
param tags object

@description('Log retention in days.')
param retentionInDays int = 30

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    retentionInDays: retentionInDays
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
  sku: {
    name: 'PerGB2018'
  }
}

output workspaceId string = law.id
output workspaceName string = law.name
