// Azure Functions
param environment string
param location string
param resourcePrefix string
param keyVaultUri string
param eventHubsNamespace string
param serviceBusNamespace string

resource funcApp 'Microsoft.Web/sites@2022-03-01' = {
  name: '${resourcePrefix}-func-${environment}'
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    environment: environment
    service: 'functions'
  }
}

// Output identity
output identity string = funcApp.identity.principalId
