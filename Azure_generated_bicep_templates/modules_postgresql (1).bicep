/*
  modules/postgresql.bicep
  Note: This deploys PostgreSQL Flexible Server with public network access enabled.
  If you require private-only access, add Private Endpoint for PostgreSQL (not included in the provided service list).
*/

targetScope = 'resourceGroup'

param name string
param location string
param tags object
param administratorLogin string

@secure()
@description('Administrator password for PostgreSQL.')
param administratorPassword string = 'ChangeM3Now!${uniqueString(resourceGroup().id)}'

param version string = '16'
param skuName string = 'Standard_D2s_v3'
param storageSizeGB int = 128

resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-03-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: 'GeneralPurpose'
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// Allows Azure services (including App Service outbound) to connect if needed.
resource firewallAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-03-01' = {
  name: '${pg.name}/AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output fqdn string = pg.properties.fullyQualifiedDomainName
output serverName string = pg.name
