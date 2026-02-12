// VNet
param environment string
param location string
param resourcePrefix string

resource vnet 'Microsoft.Network/virtualNetworks@2023-07-01' = {
  name: '${resourcePrefix}-vnet-${environment}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [ '10.0.0.0/16' ]
    }
    subnets: [
      {
        name: 'GatewaySubnet'
        properties: {
          addressPrefix: '10.0.1.0/24'
        }
      },
      {
        name: 'VMSubnet'
        properties: {
          addressPrefix: '10.0.2.0/24'
        }
      }
    ]
  }
  tags: {
    environment: environment
    service: 'network'
  }
}

output vnetId string = vnet.id
