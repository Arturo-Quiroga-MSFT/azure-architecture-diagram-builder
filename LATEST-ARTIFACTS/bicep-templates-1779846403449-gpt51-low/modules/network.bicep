param baseName string
param location string
param tags object

@description('Address prefix for the VNet')
param vnetAddressPrefix string = '10.10.0.0/16'

@description('Address prefix for private endpoint subnet')
param privateEndpointSubnetPrefix string = '10.10.1.0/24'

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  name: '${baseName}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [vnetAddressPrefix]
    }
    subnets: [
      {
        name: 'pe-subnet'
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

var peSubnet = vnet.properties.subnets[0]

output vnetId string = vnet.id
output privateEndpointSubnetId string = peSubnet.id
