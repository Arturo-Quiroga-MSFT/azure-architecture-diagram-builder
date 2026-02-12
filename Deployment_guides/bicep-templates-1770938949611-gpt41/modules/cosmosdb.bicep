// Cosmos DB
param environment string
param location string
param resourcePrefix string
param keyVaultUri string

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: '${resourcePrefix}-cosmos-${environment}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
  }
  tags: {
    environment: environment
    service: 'cosmosdb'
  }
}

output connectionString string = cosmosDb.properties.documentEndpoint
