param baseName string
param location string
param tags object

resource adt 'Microsoft.DigitalTwins/digitalTwinsInstances@2023-01-31' = {
  name: '${baseName}-adt'
  location: location
  tags: tags
  properties: {}
}

output digitalTwinsName string = adt.name
output digitalTwinsHostName string = adt.properties.hostName
