/* modules/networkVpnGateway.bicep */

targetScope = 'resourceGroup'

param vnetName string
param vpnGatewayName string
param location string
param tags object
param onPremAddressPrefix string
param onPremVpnPublicIp string
@secure()
param vpnSharedKey string

var gatewaySubnetName = 'GatewaySubnet'
var vmSubnetName = 'vm-subnet'

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: vnetName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.20.0.0/16'
      ]
    }
    subnets: [
      {
        name: gatewaySubnetName
        properties: {
          addressPrefix: '10.20.0.0/27'
        }
      }
      {
        name: vmSubnetName
        properties: {
          addressPrefix: '10.20.1.0/24'
        }
      }
    ]
  }
}

resource pip 'Microsoft.Network/publicIPAddresses@2024-01-01' = {
  name: '${vpnGatewayName}-pip'
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
  }
}

resource vpngw 'Microsoft.Network/virtualNetworkGateways@2024-01-01' = {
  name: vpnGatewayName
  location: location
  tags: tags
  properties: {
    gatewayType: 'Vpn'
    vpnType: 'RouteBased'
    enableBgp: false
    sku: {
      name: 'VpnGw1'
      tier: 'VpnGw1'
    }
    ipConfigurations: [
      {
        name: 'vpngw-ipcfg'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: pip.id
          }
          subnet: {
            id: resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, gatewaySubnetName)
          }
        }
      }
    ]
  }
  dependsOn: [
    vnet
    pip
  ]
}

resource lng 'Microsoft.Network/localNetworkGateways@2024-01-01' = {
  name: '${vpnGatewayName}-lng'
  location: location
  tags: tags
  properties: {
    gatewayIpAddress: onPremVpnPublicIp
    localNetworkAddressSpace: {
      addressPrefixes: [
        onPremAddressPrefix
      ]
    }
  }
}

resource conn 'Microsoft.Network/connections@2024-01-01' = {
  name: '${vpnGatewayName}-conn'
  location: location
  tags: tags
  properties: {
    connectionType: 'IPsec'
    virtualNetworkGateway1: {
      id: vpngw.id
    }
    localNetworkGateway2: {
      id: lng.id
    }
    sharedKey: vpnSharedKey
  }
}

output vnetId string = vnet.id
output vpnGatewayName string = vpngw.name
output vpnGatewayPublicIp string = pip.properties.ipAddress
output vmSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, vmSubnetName)
