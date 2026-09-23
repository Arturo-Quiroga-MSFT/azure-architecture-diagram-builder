/* modules/cosmosDb.bicep */

targetScope = 'resourceGroup'

param name string
param location string
param tags object

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: name
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
    capabilities: []
    publicNetworkAccess: 'Enabled'
    minimalTlsVersion: 'Tls12'
    enableFreeTier: false
  }
}

resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'imagingdb'
  properties: {
    resource: {
      id: 'imagingdb'
    }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: db
  name: 'studies'
  properties: {
    resource: {
      id: 'studies'
      partitionKey: {
        paths: [
          '/patientId'
        ]
        kind: 'Hash'
      }
    }
    options: {
      throughput: 400
    }
  }
}

var keys = listKeys(cosmos.id, '2024-05-15')

output name string = cosmos.name
output endpoint string = cosmos.properties.documentEndpoint
@secure()
output primaryKey string = keys.primaryMasterKey
