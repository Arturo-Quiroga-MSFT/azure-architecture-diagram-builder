/*
  modules/monitor-diagnostics.bicep
  Streams diagnostics to Log Analytics.
  Note: Diagnostic category availability varies by resource type and SKU.
*/

targetScope = 'resourceGroup'

param location string
param tags object
param workspaceId string
param appServiceIds array
param keyVaultId string
param frontDoorProfileId string

resource diagKv 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-kv-to-law'
  scope: resource(keyVaultId)
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'AuditEvent'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

resource diagA0 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (length(appServiceIds) > 0) {
  name: 'diag-app-0-to-law'
  scope: resource(appServiceIds[0])
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

resource diagA1 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (length(appServiceIds) > 1) {
  name: 'diag-app-1-to-law'
  scope: resource(appServiceIds[1])
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

resource diagAfd 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-afd-to-law'
  scope: resource(frontDoorProfileId)
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'FrontDoorAccessLog'
        enabled: true
      }
      {
        category: 'FrontDoorHealthProbeLog'
        enabled: true
      }
      {
        category: 'FrontDoorWebApplicationFirewallLog'
        enabled: false
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}
