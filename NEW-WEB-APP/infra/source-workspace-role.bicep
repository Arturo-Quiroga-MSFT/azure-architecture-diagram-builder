targetScope = 'resourceGroup'

@description('Existing source Log Analytics workspace containing AADB telemetry.')
param workspaceName string

@description('Managed identity principal ID that reads AADB telemetry.')
param principalId string

resource sourceLogAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: workspaceName
}

resource logAnalyticsReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sourceLogAnalyticsWorkspace.id, principalId, 'log-analytics-reader')
  scope: sourceLogAnalyticsWorkspace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '73c42c96-874c-492b-b04d-ab87d138a893')
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
