param baseName string
param location string
param storageAccountId string
param tags object

resource tsiEnv 'Microsoft.TimeSeriesInsights/environments@2020-05-15' = {
  name: '${baseName}-tsi'
  location: location
  tags: tags
  sku: {
    name: 'L1'
    capacity: 1
  }
  properties: {
    dataAccessId: guid(resourceGroup().id, baseName)
    dataAccessFqdn: ''
    storageConfiguration: {
      storageAccountResourceId: storageAccountId
      managementKey: ''
    }
    timeSeriesIdProperties: [
      {
        name: 'deviceId'
        type: 'String'
      }
    ]
  }
}

output tsiEnvironmentName string = tsiEnv.name
