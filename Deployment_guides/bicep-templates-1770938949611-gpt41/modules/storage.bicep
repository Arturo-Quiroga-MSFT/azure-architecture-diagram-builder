// Storage Account
param environment string
param location string
param resourcePrefix string
param keyVaultUri string

resource sa 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${resourcePrefix}st${environment}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  tags: {
    environment: environment
    service: 'storage'
  }
}

output connectionString string = sa.properties.primaryEndpoints.blob
