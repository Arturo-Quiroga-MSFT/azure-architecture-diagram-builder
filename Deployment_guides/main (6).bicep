// main.bicep
param environment string
param location string

var tags = {
  environment: environment
  deployment: 'secureweb'
  owner: 'platform-team'
}

// Resource group reference
resource group 'Microsoft.Resources/resourceGroups@2021-04-01' existing = {
  name: deployment().resourceGroupName
}

module vnet 'modules/vnet.bicep' = {
  name: 'vnet'
  params: {
    location: location
    tags: tags
  }
}

module appService 'modules/appservice.bicep' = {
  name: 'appService'
  params: {
    location: location
    environment: environment
    tags: tags
    vnetId: vnet.outputs.vnetId
  }
}

module redis 'modules/redis.bicep' = {
  name: 'redis'
  params: {
    location: location
    tags: tags
    vnetId: vnet.outputs.vnetId
  }
}

module sql 'modules/sqldb.bicep' = {
  name: 'sql'
  params: {
    location: location
    tags: tags
    vnetId: vnet.outputs.vnetId
  }
}

module privateLink 'modules/privateLink.bicep' = {
  name: 'privatelink'
  params: {
    location: location
    tags: tags
    redisId: redis.outputs.redisId
    sqlId: sql.outputs.sqlId
    vnetId: vnet.outputs.vnetId
  }
}

module dns 'modules/dns.bicep' = {
  name: 'dns'
  params: {
    location: location
    tags: tags
    vnetId: vnet.outputs.vnetId
    privateEndpoints: [redis.outputs.peId, sql.outputs.peId]
  }
}

module insights 'modules/appinsights.bicep' = {
  name: 'appinsights'
  params: {
    location: location
    tags: tags
  }
}

module logAnalytics 'modules/loganalytics.bicep' = {
  name: 'loganalytics'
  params: {
    location: location
    tags: tags
  }
}

module sentinel 'modules/sentinel.bicep' = {
  name: 'sentinel'
  params: {
    location: location
    tags: tags
    workspaceId: logAnalytics.outputs.workspaceId
  }
}

module monitor 'modules/monitor.bicep' = {
  name: 'azmonitor'
  params: {
    location: location
    tags: tags
    logAnalyticsId: logAnalytics.outputs.workspaceId
    appInsightsId: insights.outputs.appInsightsId
  }
}

module frontdoor 'modules/frontdoor.bicep' = {
  name: 'frontdoor'
  params: {
    location: location
    tags: tags
    backendHost: appService.outputs.defaultHostname
    wafPolicyId: frontdoorWaf.outputs.wafPolicyId
  }
}

module frontdoorWaf 'modules/frontdoorWaf.bicep' = {
  name: 'frontdoorWaf'
  params: {
    location: location
    tags: tags
  }
}

output appServiceUrl string = appService.outputs.defaultHostname
output redisHost string = redis.outputs.redisHost
output redisKey string = redis.outputs.primaryKey
output sqlConnString string = sql.outputs.connectionString
output appInsightsKey string = insights.outputs.instrumentationKey
output logAnalyticsWorkspaceId string = logAnalytics.outputs.workspaceId
output sentinelWorkspaceId string = sentinel.outputs.sentinelWorkspaceId
output wafEndpoint string = frontdoor.outputs.endpointUrl
