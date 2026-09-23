/*
  main.bicep
  Deploys: VNet + subnets, VPN Gateway + Local Network Gateway + Connection,
  Event Hubs, Service Bus, Function App (with managed identity), Cosmos DB,
  Storage, Log Analytics, Key Vault, Virtual Machines.
  Adds Key Vault security: RBAC-based access, managed identity permissions.
*/

targetScope = 'resourceGroup'

@description('Environment name (dev/test/prod).')
param environment string

@description('Azure region for deployment.')
param location string = resourceGroup().location

@description('Resource name prefix.')
param namePrefix string

@description('Tags applied to resources.')
param tags object = {
  environment: environment
  workload: 'imaging'
  owner: 'healthcare'
}

@secure()
@description('Pre-shared key for VPN connection.')
param vpnSharedKey string

@description('On-premises VPN device public IP.')
param onPremGatewayPublicIp string

@description('On-premises address prefixes reachable through the VPN (JSON array string).')
param onPremAddressPrefixes array

@description('Azure BGP ASN (optional; used if enableBgp is true).')
param azureBgpAsn int = 65515

@description('On-prem BGP ASN (optional; used if enableBgp is true).')
param onPremBgpAsn int = 65010

@description('Enable BGP for the VPN connection.')
param enableBgp bool = false

@description('VM admin username.')
param vmAdminUsername string = 'azureadmin'

@secure()
@description('VM admin password. If empty, password auth is disabled and SSH key is required (not implemented in this sample).')
param vmAdminPassword string = ''

// Naming helpers
var baseName = '${namePrefix}-${environment}'

// Modules
module network './modules/network.bicep' = {
  name: 'network'
  params: {
    location: location
    baseName: baseName
    tags: tags
  }
}

module logAnalytics './modules/logAnalytics.bicep' = {
  name: 'logAnalytics'
  params: {
    location: location
    baseName: baseName
    tags: tags
  }
}

module keyVault './modules/keyVault.bicep' = {
  name: 'keyVault'
  params: {
    location: location
    baseName: baseName
    tags: tags
    // RBAC authorization enabled by default in module
  }
}

module vpn './modules/vpnGateway.bicep' = {
  name: 'vpn'
  params: {
    location: location
    baseName: baseName
    tags: tags
    vnetId: network.outputs.vnetId
    gatewaySubnetId: network.outputs.gatewaySubnetId
    onPremGatewayPublicIp: onPremGatewayPublicIp
    onPremAddressPrefixes: onPremAddressPrefixes
    vpnSharedKey: vpnSharedKey
    enableBgp: enableBgp
    azureBgpAsn: azureBgpAsn
    onPremBgpAsn: onPremBgpAsn
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage'
  params: {
    location: location
    baseName: baseName
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module cosmos './modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    location: location
    baseName: baseName
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module eventHubs './modules/eventHubs.bicep' = {
  name: 'eventHubs'
  params: {
    location: location
    baseName: baseName
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module serviceBus './modules/serviceBus.bicep' = {
  name: 'serviceBus'
  params: {
    location: location
    baseName: baseName
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

module functionApp './modules/functionApp.bicep' = {
  name: 'functionApp'
  params: {
    location: location
    baseName: baseName
    tags: tags
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    storageAccountName: storage.outputs.storageAccountName
    keyVaultUri: keyVault.outputs.keyVaultUri
    eventHubNamespaceName: eventHubs.outputs.eventHubNamespaceName
    serviceBusNamespaceName: serviceBus.outputs.serviceBusNamespaceName
    cosmosAccountName: cosmos.outputs.cosmosAccountName
  }
}

module vm './modules/virtualMachines.bicep' = {
  name: 'virtualMachines'
  params: {
    location: location
    baseName: baseName
    tags: tags
    subnetId: network.outputs.vmSubnetId
    adminUsername: vmAdminUsername
    adminPassword: vmAdminPassword
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
  }
}

// Key Vault security integrations via RBAC: grant Function App MI access to Key Vault secrets
module kvRbac './modules/roleAssignments.bicep' = {
  name: 'kvRbac'
  params: {
    principalId: functionApp.outputs.functionPrincipalId
    roleDefinitionId: '4633458b-17de-408a-b874-0445c86b69e6' // Key Vault Secrets User
    scope: keyVault.outputs.keyVaultId
  }
}

// Data-plane RBAC for Storage, Event Hubs, Service Bus, Cosmos for the Function App identity
module storageRbac './modules/roleAssignments.bicep' = {
  name: 'storageRbac'
  params: {
    principalId: functionApp.outputs.functionPrincipalId
    roleDefinitionId: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe' // Storage Blob Data Contributor
    scope: storage.outputs.storageAccountId
  }
}

module sbRbacSender './modules/roleAssignments.bicep' = {
  name: 'sbRbacSender'
  params: {
    principalId: functionApp.outputs.functionPrincipalId
    roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39' // Azure Service Bus Data Sender
    scope: serviceBus.outputs.serviceBusNamespaceId
  }
}

module sbRbacReceiver './modules/roleAssignments.bicep' = {
  name: 'sbRbacReceiver'
  params: {
    principalId: functionApp.outputs.functionPrincipalId
    roleDefinitionId: '090c5cfd-751d-490a-894a-3ce6f1109419' // Azure Service Bus Data Receiver
    scope: serviceBus.outputs.serviceBusNamespaceId
  }
}

module ehRbacSender './modules/roleAssignments.bicep' = {
  name: 'ehRbacSender'
  params: {
    principalId: functionApp.outputs.functionPrincipalId
    roleDefinitionId: '2b629674-e913-4c01-ae53-ef4638d8f975' // Azure Event Hubs Data Sender
    scope: eventHubs.outputs.eventHubNamespaceId
  }
}

module ehRbacReceiver './modules/roleAssignments.bicep' = {
  name: 'ehRbacReceiver'
  params: {
    principalId: functionApp.outputs.functionPrincipalId
    roleDefinitionId: 'e450f3ef-11b0-4e4b-ae27-6a4f3b3d54b3' // Azure Event Hubs Data Receiver
    scope: eventHubs.outputs.eventHubNamespaceId
  }
}

// Cosmos DB RBAC: assign Data Contributor at account scope (works when using Entra ID-based auth in supported SDKs)
module cosmosRbac './modules/roleAssignments.bicep' = {
  name: 'cosmosRbac'
  params: {
    principalId: functionApp.outputs.functionPrincipalId
    roleDefinitionId: '00000000-0000-0000-0000-000000000002' // Placeholder: Cosmos DB built-in data contributor varies by cloud/role type
    scope: cosmos.outputs.cosmosAccountId
  }
}

output vnetName string = network.outputs.vnetName
output vpnGatewayPublicIp string = vpn.outputs.vpnGatewayPublicIp
output eventHubNamespaceFqdn string = eventHubs.outputs.eventHubNamespaceFqdn
output serviceBusNamespaceFqdn string = serviceBus.outputs.serviceBusNamespaceFqdn
output functionAppName string = functionApp.outputs.functionAppName
output functionDefaultHostname string = functionApp.outputs.functionDefaultHostname
output cosmosEndpoint string = cosmos.outputs.cosmosEndpoint
output storageAccountName string = storage.outputs.storageAccountName
output logAnalyticsWorkspaceId string = logAnalytics.outputs.workspaceId
output keyVaultUri string = keyVault.outputs.keyVaultUri
