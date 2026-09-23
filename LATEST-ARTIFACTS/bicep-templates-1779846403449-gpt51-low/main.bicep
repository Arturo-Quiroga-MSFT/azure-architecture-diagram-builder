param env string
param location string = resourceGroup().location

@description('Base name prefix for all resources.')
param baseName string = 'iot-${env}'

@description('Tags to apply to all resources.')
param commonTags object = {
  environment: env
  project: 'industrial-iot-predictive-maintenance'
}

// ==========================
// Modules
// ==========================

module network 'modules/network.bicep' = {
  name: 'network-${env}'
  params: {
    baseName: baseName
    location: location
    tags: commonTags
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage-${env}'
  params: {
    baseName: baseName
    location: location
    vnetId: network.outputs.vnetId
    subnetId: network.outputs.privateEndpointSubnetId
    tags: commonTags
  }
}

module iothub 'modules/iothub.bicep' = {
  name: 'iothub-${env}'
  params: {
    baseName: baseName
    location: location
    vnetId: network.outputs.vnetId
    subnetId: network.outputs.privateEndpointSubnetId
    tags: commonTags
  }
}

module dps 'modules/dps.bicep' = {
  name: 'dps-${env}'
  params: {
    baseName: baseName
    location: location
    iotHubHostName: iothub.outputs.iotHubHostName
    iotHubResourceId: iothub.outputs.iotHubResourceId
    tags: commonTags
  }
}

module aml 'modules/aml.bicep' = {
  name: 'aml-${env}'
  params: {
    baseName: baseName
    location: location
    storageAccountId: storage.outputs.dataLakeStorageId
    tags: commonTags
  }
}

module digitalTwins 'modules/digitalTwins.bicep' = {
  name: 'adt-${env}'
  params: {
    baseName: baseName
    location: location
    tags: commonTags
  }
}

module synapse 'modules/synapse.bicep' = {
  name: 'synapse-${env}'
  params: {
    baseName: baseName
    location: location
    storageAccountName: storage.outputs.dataLakeStorageName
    tags: commonTags
  }
}

module tsi 'modules/tsi.bicep' = {
  name: 'tsi-${env}'
  params: {
    baseName: baseName
    location: location
    storageAccountId: storage.outputs.dataLakeStorageId
    tags: commonTags
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-${env}'
  params: {
    baseName: baseName
    location: location
    tags: commonTags
    iotHubId: iothub.outputs.iotHubResourceId
    storageAccountId: storage.outputs.dataLakeStorageId
  }
}

module streamAnalytics 'modules/streamAnalytics.bicep' = {
  name: 'stream-analytics-${env}'
  params: {
    baseName: baseName
    location: location
    iotHubName: iothub.outputs.iotHubName
    iotHubConnectionString: iothub.outputs.iotHubConnectionString
    dataLakeStorageAccountName: storage.outputs.dataLakeStorageName
    amlWorkspaceUrl: aml.outputs.amlWorkspaceUrl
    amlPrimaryKey: aml.outputs.amlPrimaryKey
    digitalTwinsHostName: digitalTwins.outputs.digitalTwinsHostName
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    tags: commonTags
  }
}

// ==========================
// Outputs
// ==========================

output vnetId string = network.outputs.vnetId
output privateEndpointSubnetId string = network.outputs.privateEndpointSubnetId

output iotHubName string = iothub.outputs.iotHubName
output iotHubHostName string = iothub.outputs.iotHubHostName
output iotHubConnectionString string = iothub.outputs.iotHubConnectionString
output iotHubResourceId string = iothub.outputs.iotHubResourceId

output dpsIdScope string = dps.outputs.dpsIdScope
output dpsPrimaryKey string = dps.outputs.dpsPrimaryKey

output dataLakeStorageName string = storage.outputs.dataLakeStorageName
output dataLakeStorageId string = storage.outputs.dataLakeStorageId

output amlWorkspaceName string = aml.outputs.amlWorkspaceName
output amlWorkspaceUrl string = aml.outputs.amlWorkspaceUrl

output digitalTwinsName string = digitalTwins.outputs.digitalTwinsName
output digitalTwinsHostName string = digitalTwins.outputs.digitalTwinsHostName

output synapseWorkspaceName string = synapse.outputs.synapseWorkspaceName
output tsiEnvironmentName string = tsi.outputs.tsiEnvironmentName

output logAnalyticsWorkspaceName string = monitoring.outputs.logAnalyticsWorkspaceName
output logAnalyticsWorkspaceId string = monitoring.outputs.logAnalyticsWorkspaceId

output streamAnalyticsJobName string = streamAnalytics.outputs.streamAnalyticsJobName
