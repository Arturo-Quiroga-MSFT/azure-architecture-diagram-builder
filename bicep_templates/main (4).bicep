/*
  main.bicep
  Deploys:
  - VNet + subnets (App Service integration + private endpoints)
  - Log Analytics + Application Insights (workspace-based)
  - Storage (Blob)
  - PostgreSQL Flexible Server
  - Key Vault (RBAC) + Private Endpoint + Private DNS zone/link
  - App Service plan + 2 Web Apps (frontend, api) with managed identity + VNet integration
  - Front Door Standard (routes / -> frontend, /api/* -> api)
  - Diagnostic settings streaming to Log Analytics
*/

targetScope = 'resourceGroup'

@description('Short prefix used for resource naming (e.g., contoso).')
param prefix string

@allowed([
  'dev'
  'test'
  'prod'
])
@description('Deployment environment.')
param environment string = 'dev'

@description('Azure region for regional resources.')
param location string = resourceGroup().location

@description('Tags applied to all supported resources.')
param tags object = {
  project: prefix
  env: environment
  managedBy: 'bicep'
}

var suffix = toLower(uniqueString(subscription().id, resourceGroup().id, prefix, environment))
var nameBase = toLower('${prefix}-${environment}')

// Global-ish unique names
var storageName = toLower(replace('st${prefix}${environment}${suffix}', '-', ''))
var kvName = toLower(replace('kv-${nameBase}-${suffix}', '-', ''))
var lawName = 'law-${nameBase}'
var aiName = 'appi-${nameBase}'
var vnetName = 'vnet-${nameBase}'

// App naming
var planName = 'asp-${nameBase}'
var feAppName = 'app-${nameBase}-fe'
var apiAppName = 'app-${nameBase}-api'

// Postgres naming
var pgName = toLower(replace('pg-${nameBase}-${suffix}', '-', ''))

module vnet './modules/vnet.bicep' = {
  name: 'vnet'
  params: {
    name: vnetName
    location: location
    tags: tags
  }
}

module logAnalytics './modules/loganalytics.bicep' = {
  name: 'loganalytics'
  params: {
    name: lawName
    location: location
    tags: tags
  }
}

module appInsights './modules/appinsights.bicep' = {
  name: 'appinsights'
  params: {
    name: aiName
    location: location
    workspaceResourceId: logAnalytics.outputs.workspaceId
    tags: tags
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: storageName
    location: location
    tags: tags
    containerName: 'images'
  }
}

module postgres './modules/postgresql.bicep' = {
  name: 'postgres'
  params: {
    name: pgName
    location: location
    tags: tags
    administratorLogin: 'pgadmin'
  }
}

module keyVault './modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: kvName
    location: location
    tags: tags
    enablePurgeProtection: environment == 'prod'
    enableSoftDelete: true
    publicNetworkAccess: 'Disabled'
  }
}

module privateDns './modules/privatedns.bicep' = {
  name: 'privatedns'
  params: {
    location: location
    tags: tags
    vnetId: vnet.outputs.vnetId
    zoneName: 'privatelink.vaultcore.azure.net'
  }
}

module privateEndpointKv './modules/privateendpoint-keyvault.bicep' = {
  name: 'privateendpoint-kv'
  params: {
    location: location
    tags: tags
    privateEndpointName: 'pe-kv-${nameBase}'
    subnetId: vnet.outputs.privateEndpointsSubnetId
    keyVaultId: keyVault.outputs.keyVaultId
    privateDnsZoneId: privateDns.outputs.zoneId
  }
}

module appService './modules/appservice.bicep' = {
  name: 'appservice'
  params: {
    location: location
    tags: tags
    planName: planName
    skuName: 'P1v3'
    frontendAppName: feAppName
    apiAppName: apiAppName
    subnetIdForVnetIntegration: vnet.outputs.appIntegrationSubnetId
    appInsightsConnectionString: appInsights.outputs.connectionString
    keyVaultUri: keyVault.outputs.keyVaultUri
    storageAccountName: storage.outputs.storageAccountName
    postgresHost: postgres.outputs.fqdn
  }
}

module frontDoor './modules/frontdoor.bicep' = {
  name: 'frontdoor'
  params: {
    tags: tags
    profileName: 'afd-${nameBase}'
    endpointName: 'ep-${nameBase}'
    frontendOriginHost: appService.outputs.frontendDefaultHostName
    apiOriginHost: appService.outputs.apiDefaultHostName
  }
}

module diagnostics './modules/monitor-diagnostics.bicep' = {
  name: 'diagnostics'
  params: {
    location: location
    tags: tags
    workspaceId: logAnalytics.outputs.workspaceId
    appServiceIds: [
      appService.outputs.frontendAppId
      appService.outputs.apiAppId
    ]
    keyVaultId: keyVault.outputs.keyVaultId
    frontDoorProfileId: frontDoor.outputs.profileId
  }
}

output frontDoorHost string = frontDoor.outputs.frontDoorHost
output frontendAppName string = feAppName
output apiAppName string = apiAppName
output keyVaultName string = kvName
output keyVaultUri string = keyVault.outputs.keyVaultUri
output storageAccountName string = storage.outputs.storageAccountName
output postgresFqdn string = postgres.outputs.fqdn
output appInsightsConnectionString string = appInsights.outputs.connectionString
