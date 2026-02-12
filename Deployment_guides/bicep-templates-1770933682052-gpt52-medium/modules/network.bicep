/*
  modules/network.bicep
  Network baseline for VPN Gateway + VM subnet.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object

@description('VNet address space.')
param vnetAddressPrefix string = '10.0.0.0/16'

@description('GatewaySubnet prefix. Must be named GatewaySubnet.')
param gatewaySubnetPrefix string = '10.0.0.0/27'

@description('VM subnet prefix.')
param vmSubnetPrefix string = '10.0.1.0/24'

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: '${baseName}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [ vnetAddressPrefix ]
    }
    subnets: [
      {
        name: 'GatewaySubnet'
        properties: {
          addressPrefix: gatewaySubnetPrefix
        }
      }
      {
        name: 'snet-vm'
        properties: {
          addressPrefix: vmSubnetPrefix
        }
      }
    ]
  }
}

output vnetName string = vnet.name
output vnetId string = vnet.id
output gatewaySubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'GatewaySubnet')
output vmSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-vm')
