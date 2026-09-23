param baseName string
param location string
param iotHubName string
param iotHubConnectionString string
param dataLakeStorageAccountName string
param amlWorkspaceUrl string
param amlPrimaryKey string
param digitalTwinsHostName string
param logAnalyticsWorkspaceId string
param tags object

resource saJob 'Microsoft.StreamAnalytics/streamingjobs@2021-10-01-preview' = {
  name: '${baseName}-sa-job'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'Standard'
    }
    eventsOutOfOrderPolicy: 'Drop'
    eventsOutOfOrderMaxDelayInSeconds: 0
    eventsLateArrivalMaxDelayInSeconds: 5
    dataLocale: 'en-US'
    outputErrorPolicy: 'Drop'
    compatibilityLevel: '1.2'
  }
}

// NOTE: Inputs/outputs and query are typically configured post-deployment via CLI or portal.

output streamAnalyticsJobName string = saJob.name
