// cosmosdb.bicep

param location string
param environment string
param tags object
param keyVaultId string

resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2021-07-01-preview' = {
  name: 'imaging-cosmosdb-${environment}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    capabilities: [
      {
        name: 'EnableMultipleWriteLocations'
      }
    ]
    ipRules: []
  }
}

output cosmosDbAccountName string = cosmosDbAccount.name
output cosmosDbAccountId string = cosmosDbAccount.id