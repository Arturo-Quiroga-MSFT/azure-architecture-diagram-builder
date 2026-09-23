param baseName string
param location string
param vnetId string
param subnetId string
param tags object

@description('IoT Hub SKU')
param iotHubSku string = 'S2'

@description('IoT Hub capacity (units)')
param iotHubCapacity int = 1

resource iotHub 'Microsoft.Devices/IotHubs@2023-03-15' = {
  name: '${baseName}-hub'
  location: location
  tags: tags
  sku: {
    name: iotHubSku
    capacity: iotHubCapacity
    tier: 'Standard'
  }
  properties: {
    publicNetworkAccess: 'Disabled' // Use Private Link
    minimumTlsVersion: '1.2'
    features: 'None'
  }
}

// IoT Hub shared access policy (iothubowner) connection string
resource iotHubKeys 'Microsoft.Devices/IotHubs/IotHubKeys@2023-03-15' existing = {
  name: 'iothubowner'
  parent: iotHub
}

var iotHubCs = 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey='

// Private endpoint for IoT Hub
resource peIotHub 'Microsoft.Network/privateEndpoints@2023-04-01' = {
  name: '${iotHub.name}-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'iothub'
        properties: {
          privateLinkServiceId: iotHub.id
          groupIds: ['iotHub']
        }
      }
    ]
  }
}

output iotHubName string = iotHub.name
output iotHubHostName string = iotHub.properties.hostName
// Note: actual key retrieval typically requires a separate step; placeholder here
output iotHubConnectionString string = iotHubCs
output iotHubResourceId string = iotHub.id
