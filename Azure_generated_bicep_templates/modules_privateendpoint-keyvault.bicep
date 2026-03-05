/*
  modules/privateendpoint-keyvault.bicep
  Creates:
  - Private Endpoint in subnet-private-endpoints
  - Private DNS Zone Group to privatelink.vaultcore.azure.net
*/

targetScope = 'resourceGroup'

param location string
param tags object
param privateEndpointName string
param subnetId string
param keyVaultId string
param privateDnsZoneId string

resource pe 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: privateEndpointName
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'kv-connection'
        properties: {
          privateLinkServiceId: keyVaultId
          groupIds: [
            'vault'
          ]
        }
      }
    ]
  }
}

resource zoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  name: '${pe.name}/kv-dns'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'kv-zone'
        properties: {
          privateDnsZoneId: privateDnsZoneId
        }
      }
    ]
  }
}

output privateEndpointId string = pe.id
