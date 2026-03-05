/*
  modules/appinsights.bicep
*/

targetScope = 'resourceGroup'

param name string
param location string
param tags object
param workspaceResourceId string

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: name
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspaceResourceId
  }
}

output instrumentationKey string = appi.properties.InstrumentationKey
output connectionString string = appi.properties.ConnectionString
output appInsightsId string = appi.id
