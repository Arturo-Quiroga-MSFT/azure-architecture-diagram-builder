// storageaccount.bicep

param location string
param environment string
param tags object
param keyVaultId string

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-08-01' = {
  name: 'imagingstorage${environment}'
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}

output storageAccountName string = storageAccount.name