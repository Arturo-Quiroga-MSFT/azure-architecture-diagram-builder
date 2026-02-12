// main.bicep - Orchestrate all modules and resource dependencies

param environment string = 'prod'
param location string = 'eastus'

// Tags for resource group
var commonTags = {
  Environment: environment
  Project: 'ImagingEventProcessing'
  Owner: 'DevOpsTeam'
}

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' existing = {
  name: 'imaging-rg'
}

// Deploy modules
module keyVaultModule 'modules/keyvault.bicep' = {
  name: 'keyVaultDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
  }
}

module vpnGatewayModule 'modules/vpngateway.bicep' = {
  name: 'vpnGatewayDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
  }
}

module eventHubsModule 'modules/eventhubs.bicep' = {
  name: 'eventHubsDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
    keyVaultId: keyVaultModule.outputs.keyVaultResourceId
  }
}

module serviceBusModule 'modules/servicebus.bicep' = {
  name: 'serviceBusDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
  }
}

module azureFunctionsModule 'modules/azurefunctions.bicep' = {
  name: 'azureFunctionsDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
    keyVaultId: keyVaultModule.outputs.keyVaultResourceId
    eventHubsNamespace: eventHubsModule.outputs.eventHubsNamespace
    serviceBusNamespace: serviceBusModule.outputs.serviceBusNamespace
  }
}

module cosmosDbModule 'modules/cosmosdb.bicep' = {
  name: 'cosmosDbDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
    keyVaultId: keyVaultModule.outputs.keyVaultResourceId
  }
}

module storageAccountModule 'modules/storageaccount.bicep' = {
  name: 'storageAccountDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
    keyVaultId: keyVaultModule.outputs.keyVaultResourceId
  }
}

module logAnalyticsModule 'modules/loganalytics.bicep' = {
  name: 'logAnalyticsDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
  }
}

module vmModule 'modules/virtualmachines.bicep' = {
  name: 'virtualMachinesDeploy'
  scope: rg
  params: {
    location: location
    environment: environment
    tags: commonTags
    vpnGatewayId: vpnGatewayModule.outputs.vpnGatewayResourceId
  }
}

// Outputs
output keyVaultUri string = keyVaultModule.outputs.keyVaultUri
output eventHubsNamespace string = eventHubsModule.outputs.eventHubsNamespace
output serviceBusNamespace string = serviceBusModule.outputs.serviceBusNamespace
output functionAppName string = azureFunctionsModule.outputs.functionAppName
output cosmosDbAccountName string = cosmosDbModule.outputs.cosmosDbAccountName
output storageAccountName string = storageAccountModule.outputs.storageAccountName
output logAnalyticsWorkspaceId string = logAnalyticsModule.outputs.workspaceId
output vpnGatewayIp string = vpnGatewayModule.outputs.vpnPublicIp

// End of main.bicep