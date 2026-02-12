// vpngateway.bicep

param location string
param environment string
param tags object

resource vnet 'Microsoft.Network/virtualNetworks@2021-05-01' = {
  name: 'imaging-vnet-${environment}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [ '10.1.0.0/16' ]
    }
    subnets: [
      {
        name: 'GatewaySubnet'
        properties: {
          addressPrefix: '10.1.255.0/27'
        }
      }
    ]
  }
}

resource publicIp 'Microsoft.Network/publicIPAddresses@2021-05-01' = {
  name: 'imaging-vpn-pip-${environment}'
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
  }
}

resource vpnGateway 'Microsoft.Network/vpnGateways@2021-05-01' = {
  name: 'imaging-vpngateway-${environment}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'VpnGw1'
      tier: 'VpnGw1'
    }
    gatewayType: 'Vpn'
    vpnType: 'RouteBased'
    enableBgp: false
    activeActive: false
    ipConfigurations: [
      {
        name: 'vpngw-ipconfig'
        properties: {
          publicIPAddress: {
            id: publicIp.id
          }
          subnet: {
            id: '${vnet.id}/subnets/GatewaySubnet'
          }
        }
      }
    ]
  }
}

output vpnGatewayResourceId string = vpnGateway.id
output vpnPublicIp string = publicIp.properties.ipAddress