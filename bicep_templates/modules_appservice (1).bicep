/*
  modules/appservice.bicep
  Creates:
  - App Service Plan (Premium v3 recommended for VNet integration)
  - Frontend web app
  - API web app
  - VNet integration via virtualNetworkSubnetId
*/

targetScope = 'resourceGroup'

param location string
param tags object

param planName string
param skuName string = 'P1v3'

param frontendAppName string
param apiAppName string

@description('Subnet ID delegated to Microsoft.Web/serverFarms for VNet integration.')
param subnetIdForVnetIntegration string

param appInsightsConnectionString string
param keyVaultUri string
param storageAccountName string
param postgresHost string

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: 'PremiumV3'
    size: skuName
    capacity: 1
  }
  properties: {
    reserved: false
  }
}

resource frontend 'Microsoft.Web/sites@2023-12-01' = {
  name: frontendAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'KEYVAULT_URI'
          value: keyVaultUri
        }
        {
          name: 'WEBSITE_VNET_ROUTE_ALL'
          value: '1'
        }
      ]
      // Regional VNet Integration
      virtualNetworkSubnetId: subnetIdForVnetIntegration
    }
  }
}

resource api 'Microsoft.Web/sites@2023-12-01' = {
  name: apiAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'KEYVAULT_URI'
          value: keyVaultUri
        }
        {
          name: 'STORAGE_ACCOUNT_NAME'
          value: storageAccountName
        }
        {
          name: 'POSTGRES_HOST'
          value: postgresHost
        }
        {
          name: 'WEBSITE_VNET_ROUTE_ALL'
          value: '1'
        }
      ]
      // Regional VNet Integration
      virtualNetworkSubnetId: subnetIdForVnetIntegration
    }
  }
}

output frontendAppId string = frontend.id
output apiAppId string = api.id
output frontendDefaultHostName string = frontend.properties.defaultHostName
output apiDefaultHostName string = api.properties.defaultHostName
output frontendPrincipalId string = frontend.identity.principalId
output apiPrincipalId string = api.identity.principalId
