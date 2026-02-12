// Log Analytics Workspace
param environment string
param location string
param resourcePrefix string

resource logws 'Microsoft.OperationalInsights/workspaces@2023-04-01' = {
  name: '${resourcePrefix}-logws-${environment}'
  location: location
  tags: {
    environment: environment
    service: 'loganalytics'
  }
}

output workspaceId string = logws.name
