/*
  modules/cosmos.bicep
  Cosmos DB SQL API for imaging study metadata.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object
param logAnalyticsWorkspaceId string

@description('Cosmos DB account offer type.')
param offerType string = 'Standard'

var cosmosName = toLower('${baseName}-cosmos')

resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosName
  location: location
  tags: union(tags, {
    dataClassification: 'PHI'
    datastore: 'cosmos'
  })
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: offerType
    locations: [
      {
        locationName: location
        failoverPriority: 0
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
  name: '${account.name}/imagingdb'
  properties: {
    resource: {
      id: 'imagingdb'
    }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  name: '${account.name}/imagingdb/studies'
  properties: {
    resource: {
      id: 'studies'
      partitionKey: {
        paths: [ '/patientId' ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [ { path: '/*' } ]
        excludedPaths: [ { path: '/"_etag"/?' } ]
      }
    }
  }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${baseName}-cosmos-diag'
  scope: account
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        category: 'DataPlaneRequests'
        enabled: true
      }
      {
        category: 'QueryRuntimeStatistics'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'Requests'
        enabled: true
      }
    ]
  }
}

output cosmosAccountName string = account.name
output cosmosAccountId string = account.id
output cosmosEndpoint string = account.properties.documentEndpoint
