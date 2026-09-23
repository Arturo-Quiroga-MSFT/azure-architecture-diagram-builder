/*
  modules/vpnGateway.bicep
  Site-to-site VPN: VPN Gateway + Local Network Gateway + Connection.
*/

targetScope = 'resourceGroup'

param location string
param baseName string
param tags object

param vnetId string
param gatewaySubnetId string

param onPremGatewayPublicIp string
param onPremAddressPrefixes array

@secure()
param vpnSharedKey string

param enableBgp bool = false
param azureBgpAsn int = 65515
param onPremBgpAsn int = 65010

@description('VPN gateway SKU (e.g., VpnGw1, VpnGw2).')
param vpnGatewaySku string = 'VpnGw1'

resource pip 'Microsoft.Network/publicIPAddresses@2024-01-01' = {
  name: '${baseName}-vpngw-pip'
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
  name: '${baseName}-vpngw'
  location: location
  tags: tags
  properties: {
    gatewayType: 'Vpn'
    vpnType: 'RouteBased'
    enableBgp: enableBgp
    sku: {
      name: vpnGatewaySku
      tier: vpnGatewaySku
    }
    ipConfigurations: [
      {
        name: 'vpngw-ipconfig'
        properties: {
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: {
            id: pip.id
          }
          subnet: {
            id: gatewaySubnetId
          }
        }
      }
    ]
    bgpSettings: enableBgp ? {
      asn: azureBgpAsn
    } : null
  }
}

resource lng 'Microsoft.Network/localNetworkGateways@2024-01-01' = {
  name: '${baseName}-lng'
  location: location
  tags: tags
  properties: {
    gatewayIpAddress: onPremGatewayPublicIp
    localNetworkAddressSpace: {
      addressPrefixes: onPremAddressPrefixes
    }
    bgpSettings: enableBgp ? {
      asn: onPremBgpAsn
    } : null
  }
}

resource conn 'Microsoft.Network/connections@2024-01-01' = {
  name: '${baseName}-vpnconn'
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
    enableBgp: enableBgp
  }
}

output vpnGatewayPublicIp string = pip.properties.ipAddress
output vpnGatewayId string = vpngw.id
output vpnConnectionName string = conn.name
