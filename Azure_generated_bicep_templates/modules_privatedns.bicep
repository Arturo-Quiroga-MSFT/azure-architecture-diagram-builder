/*
  modules/privatedns.bicep
  Private DNS zone for Key Vault:
  - privatelink.vaultcore.azure.net
  - linked to the VNet for name resolution from within the VNet
*/

targetScope = 'resourceGroup'

param location string
param tags object
param vnetId string
param zoneName string

resource zone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: zoneName
  location: 'global'
  tags: tags
}

resource link 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  name: '${zone.name}/link-to-vnet'
  location: 'global'
  tags: tags
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

output zoneId string = zone.id
output zoneName string = zone.name
