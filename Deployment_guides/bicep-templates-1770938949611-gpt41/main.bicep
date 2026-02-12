// Main orchestration file
param environment string
param location string
param resourcePrefix string = 'imgproc'

// Import service modules
module keyvault './modules/keyvault.bicep' = {
  name: '${resourcePrefix}-keyvault'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
  }
}

module vnet './modules/vnet.bicep' = {
  name: '${resourcePrefix}-vnet'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
  }
}

module vpn './modules/vpn.bicep' = {
  name: '${resourcePrefix}-vpn'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
    vnetId: vnet.outputs.vnetId
  }
}

module vm './modules/vm.bicep' = {
  name: '${resourcePrefix}-vm'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
    vnetId: vnet.outputs.vnetId
  }
}

module eventhubs './modules/eventhubs.bicep' = {
  name: '${resourcePrefix}-eh'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
    keyVaultUri: keyvault.outputs.keyVaultUri
  }
}

module servicebus './modules/servicebus.bicep' = {
  name: '${resourcePrefix}-sb'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
    keyVaultUri: keyvault.outputs.keyVaultUri
  }
}

module functions './modules/functions.bicep' = {
  name: '${resourcePrefix}-func'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
    keyVaultUri: keyvault.outputs.keyVaultUri
    eventHubsNamespace: eventhubs.outputs.namespace
    serviceBusNamespace: servicebus.outputs.namespace
  }
}

module cosmosdb './modules/cosmosdb.bicep' = {
  name: '${resourcePrefix}-cosmos'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
    keyVaultUri: keyvault.outputs.keyVaultUri
  }
}

module storage './modules/storage.bicep' = {
  name: '${resourcePrefix}-storage'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
    keyVaultUri: keyvault.outputs.keyVaultUri
  }
}

module loganalytics './modules/loganalytics.bicep' = {
  name: '${resourcePrefix}-loganalytics'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
  }
}

module entraid './modules/entraid.bicep' = {
  name: '${resourcePrefix}-entra'
  params: {
    environment: environment
    location: location
    resourcePrefix: resourcePrefix
  }
}

// Outputs for endpoints
output keyVaultUri string = keyvault.outputs.keyVaultUri
output eventHubsEndpoint string = eventhubs.outputs.endpoint
output serviceBusEndpoint string = servicebus.outputs.endpoint
output cosmosDbConn string = cosmosdb.outputs.connectionString
output storageConn string = storage.outputs.connectionString
output logAnalyticsWorkspace string = loganalytics.outputs.workspaceId
