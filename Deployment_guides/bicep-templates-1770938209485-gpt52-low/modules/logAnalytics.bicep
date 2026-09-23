/* modules/logAnalytics.bicep */

targetScope = 'resourceGroup'

param name string
param location string
param tags object

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output workspaceId string = law.id
output workspaceName string = law.name
