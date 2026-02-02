/*
  modules/vnet.bicep
  - subnet-appsvc: delegated to Microsoft.Web/serverFarms for App Service VNet integration
  - subnet-private-endpoints: used for private endpoints; disables private endpoint network policies
*/

targetScope = 'resourceGroup'

param name string
param location string
param tags object

@description('Address space for the VNet.')
param addressSpace string = '10.10.0.0/16'

@description('Subnet used for App Service VNet integration.')
param appIntegrationSubnetPrefix string = '10.10.1.0/24'

@description('Subnet used for Private Endpoints.')
param privateEndpointsSubnetPrefix string = '10.10.2.0/24'

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        addressSpace
      ]
    }
    subnets: [
      {
        name: 'subnet-appsvc'
        properties: {
          addressPrefix: appIntegrationSubnetPrefix
          delegations: [
            {
              name: 'delegation-web'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'subnet-private-endpoints'
        properties: {
          addressPrefix: privateEndpointsSubnetPrefix
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output appIntegrationSubnetId string = '${vnet.id}/subnets/subnet-appsvc'
output privateEndpointsSubnetId string = '${vnet.id}/subnets/subnet-private-endpoints'
