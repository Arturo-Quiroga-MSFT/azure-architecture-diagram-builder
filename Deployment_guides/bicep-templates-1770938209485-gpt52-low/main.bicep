/*
  main.bicep
  Secure Imaging Event Pipeline deployment
  - Modules per service
  - Key Vault (RBAC) + secret references for Functions
*/

targetScope = 'resourceGroup'

@description('Name prefix for resources (e.g., imaging).')
param prefix string

@allowed([
  'dev'
  'test'
  'prod'
])
@description('Deployment environment label.')
param environment string = 'dev'

@description('Azure region for deployment.')
param location string = resourceGroup().location

@description('On-premises address space for Local Network Gateway.')
param onPremAddressPrefix string

@description('On-premises VPN device public IP.')
param onPremVpnPublicIp string

@secure()
@description('Pre-shared key for VPN connection.')
param vpnSharedKey string

@description('VM admin username.')
param vmAdminUsername string

@description('VM admin SSH public key.')
param vmSshPublicKey string

var tags = {
  'app': prefix
  'env': environment
  'managedBy': 'bicep'
}

// Naming (keep deterministic)
var vnetName = '${prefix}-${environment}-vnet'
var vpnGwName = '${prefix}-${environment}-vpngw'
var ehNamespaceName = toLower('${prefix}${environment}ehns')
var ehName = '${prefix}-${environment}-eh'
var sbNamespaceName = toLower('${prefix}${environment}sbns')
var sbQueueName = '${prefix}-${environment}-queue'
var lawName = '${prefix}-${environment}-law'
var storageName = toLower(replace('${prefix}${environment}stg', '-', ''))
var cosmosName = toLower('${prefix}-${environment}-cosmos')
var kvName = toLower('${prefix}-${environment}-kv')
var funcName = toLower('${prefix}-${environment}-func')
var vmName = '${prefix}-${environment}-vm1'

module monitoring 'modules/logAnalytics.bicep' = {
  name: 'monitoring'
  params: {
    name: lawName
    location: location
    tags: tags
  }
}

module network 'modules/networkVpnGateway.bicep' = {
  name: 'network'
  params: {
    vnetName: vnetName
    vpnGatewayName: vpnGwName
    location: location
    tags: tags
    onPremAddressPrefix: onPremAddressPrefix
    onPremVpnPublicIp: onPremVpnPublicIp
    vpnSharedKey: vpnSharedKey
  }
}

module storage 'modules/storageAccount.bicep' = {
  name: 'storage'
  params: {
    name: storageName
    location: location
    tags: tags
  }
}

module cosmos 'modules/cosmosDb.bicep' = {
  name: 'cosmos'
  params: {
    name: cosmosName
    location: location
    tags: tags
  }
}

module keyvault 'modules/keyVault.bicep' = {
  name: 'keyvault'
  params: {
    name: kvName
    location: location
    tags: tags
  }
}

module eventHubs 'modules/eventHubs.bicep' = {
  name: 'eventHubs'
  params: {
    namespaceName: ehNamespaceName
    eventHubName: ehName
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
  }
}

module serviceBus 'modules/serviceBus.bicep' = {
  name: 'serviceBus'
  params: {
    namespaceName: sbNamespaceName
    queueName: sbQueueName
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
  }
}

module compute 'modules/functionApp.bicep' = {
  name: 'compute'
  params: {
    name: funcName
    location: location
    tags: tags
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
    storageAccountName: storage.outputs.name
    keyVaultName: keyvault.outputs.name
    cosmosAccountName: cosmos.outputs.name
    serviceBusNamespaceName: serviceBus.outputs.namespaceName
  }
}

// Populate Key Vault secrets after resources exist
module kvSecrets 'modules/keyVaultSecrets.bicep' = {
  name: 'kv-secrets'
  params: {
    keyVaultName: keyvault.outputs.name
    tags: tags
    storageConnectionString: storage.outputs.connectionString
    cosmosPrimaryKey: cosmos.outputs.primaryKey
    serviceBusConnectionString: serviceBus.outputs.connectionString
  }
  dependsOn: [
    keyvault
    storage
    cosmos
    serviceBus
  ]
}

// Grant Function access to read secrets
module kvRbac 'modules/keyVaultRbac.bicep' = {
  name: 'kv-rbac'
  params: {
    keyVaultName: keyvault.outputs.name
    principalId: compute.outputs.functionPrincipalId
  }
  dependsOn: [
    keyvault
    compute
  ]
}

module vm 'modules/virtualMachine.bicep' = {
  name: 'vm'
  params: {
    vmName: vmName
    location: location
    tags: tags
    vnetName: vnetName
    subnetName: 'vm-subnet'
    adminUsername: vmAdminUsername
    sshPublicKey: vmSshPublicKey
  }
  dependsOn: [
    network
  ]
}

output resourceGroupName string = resourceGroup().name
output logAnalyticsWorkspaceId string = monitoring.outputs.workspaceId
output eventHubsNamespace string = eventHubs.outputs.namespaceName
output eventHubName string = eventHubs.outputs.eventHubName
output serviceBusNamespace string = serviceBus.outputs.namespaceName
output functionAppName string = compute.outputs.functionName
output keyVaultName string = keyvault.outputs.name
output vpnGatewayName string = network.outputs.vpnGatewayName
