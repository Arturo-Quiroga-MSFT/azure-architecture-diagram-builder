/*
  modules/frontdoor.bicep
  Azure Front Door Standard:
  - Profile
  - Endpoint
  - Origin group with origins
  - Routes: / -> frontend, /api/* -> api

  Note: Health probe paths should exist (consider adding /health to your apps).
*/

targetScope = 'resourceGroup'

param tags object
param profileName string
param endpointName string
param frontendOriginHost string
param apiOriginHost string

resource profile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: profileName
  tags: tags
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  name: '${profile.name}/${endpointName}'
  properties: {
    enabledState: 'Enabled'
  }
}

resource ogFrontend 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  name: '${profile.name}/og-frontend'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeProtocol: 'Https'
      probeRequestType: 'GET'
      probeIntervalInSeconds: 120
    }
  }
}

resource ogApi 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  name: '${profile.name}/og-api'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeProtocol: 'Https'
      probeRequestType: 'GET'
      probeIntervalInSeconds: 120
    }
  }
}

resource originFrontend 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  name: '${profile.name}/og-frontend/or-frontend'
  properties: {
    hostName: frontendOriginHost
    httpPort: 80
    httpsPort: 443
    originHostHeader: frontendOriginHost
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

resource originApi 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  name: '${profile.name}/og-api/or-api'
  properties: {
    hostName: apiOriginHost
    httpPort: 80
    httpsPort: 443
    originHostHeader: apiOriginHost
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

resource routeFrontend 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  name: '${profile.name}/${endpointName}/route-frontend'
  properties: {
    originGroup: {
      id: ogFrontend.id
    }
    supportedProtocols: [
      'Https'
    ]
    patternsToMatch: [
      '/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originFrontend
  ]
}

resource routeApi 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  name: '${profile.name}/${endpointName}/route-api'
  properties: {
    originGroup: {
      id: ogApi.id
    }
    supportedProtocols: [
      'Https'
    ]
    patternsToMatch: [
      '/api/*'
    ]
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [
    originApi
  ]
}

output profileId string = profile.id
output frontDoorHost string = endpoint.properties.hostName
