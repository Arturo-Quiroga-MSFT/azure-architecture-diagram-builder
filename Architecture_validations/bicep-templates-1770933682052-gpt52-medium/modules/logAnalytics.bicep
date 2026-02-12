/*
  modules/logAnalytics.bicep
  Log Analytics Workspace.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object

@description('Workspace SKU.')
param skuName string = 'PerGB2018'

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${baseName}-law'
  location: location
  tags: tags
  properties: {
    sku: {
      name: skuName
    }
    retentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = law.id
output workspaceName string = law.name
