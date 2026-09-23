param baseName string
param location string
param iotHubHostName string
param iotHubResourceId string
param tags object

resource dps 'Microsoft.Devices/provisioningServices@2022-04-30' = {
  name: '${baseName}-dps'
  location: location
  tags: tags
  properties: {
    iotHubs: [
      {
        connectionString: '' // to be configured post-deployment if needed
        location: location
        name: iotHubHostName
      }
    ]
    allocationPolicy: 'Hashed'
    enableDataResidency: false
  }
}

// Note: keys typically retrieved via CLI; placeholder outputs
output dpsName string = dps.name
output dpsIdScope string = 'ID_SCOPE_PLACEHOLDER'
output dpsPrimaryKey string = 'PRIMARY_KEY_PLACEHOLDER'
