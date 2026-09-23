// Demo: AI RAG Architecture with Azure OpenAI
// Retrieval-Augmented Generation pattern: OpenAI + AI Search + Cosmos DB + Storage.
// Source: Adapted from Azure AI reference architecture

@description('Base name for all resources')
param appName string = 'rag-${uniqueString(resourceGroup().id)}'

@description('Location for all resources')
param location string = resourceGroup().location

@description('OpenAI model deployment name')
param openaiModelName string = 'gpt-4o'

// --- Azure OpenAI ---

resource openai 'Microsoft.CognitiveServices/accounts@2024-04-01-preview' = {
  name: '${appName}-openai'
  location: location
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: '${appName}-openai'
    publicNetworkAccess: 'Enabled'
  }
}

resource openaiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openai
  name: openaiModelName
  sku: {
    name: 'Standard'
    capacity: 30
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: openaiModelName
      version: '2024-08-06'
    }
  }
}

resource embeddingDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-04-01-preview' = {
  parent: openai
  name: 'text-embedding-3-large'
  sku: {
    name: 'Standard'
    capacity: 30
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'text-embedding-3-large'
      version: '1'
    }
  }
  dependsOn: [openaiDeployment]
}

// --- Azure AI Search ---

resource searchService 'Microsoft.Search/searchServices@2024-03-01-preview' = {
  name: '${appName}-search'
  location: location
  sku: {
    name: 'standard'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    semanticSearch: 'standard'
  }
}

// --- Cosmos DB (chat history + metadata) ---

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' = {
  name: '${appName}-cosmos'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-02-15-preview' = {
  parent: cosmosAccount
  name: 'ragdb'
  properties: {
    resource: {
      id: 'ragdb'
    }
  }
}

resource chatHistoryContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-02-15-preview' = {
  parent: cosmosDatabase
  name: 'chat-history'
  properties: {
    resource: {
      id: 'chat-history'
      partitionKey: {
        paths: ['/userId']
        kind: 'Hash'
      }
      defaultTtl: 2592000 // 30 days
    }
    options: {
      throughput: 400
    }
  }
}

// --- Storage (document upload) ---

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: replace('${appName}docs', '-', '')
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource documentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'documents'
  properties: {
    publicAccess: 'None'
  }
}

// --- App Service (RAG API) ---

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: 'P1v3'
    tier: 'PremiumV3'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${appName}-api'
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      appSettings: [
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: openai.properties.endpoint
        }
        {
          name: 'AZURE_SEARCH_ENDPOINT'
          value: 'https://${searchService.name}.search.windows.net'
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosAccount.properties.documentEndpoint
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

// --- Static Web App (Frontend) ---

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${appName}-frontend'
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
  }
}

// --- Key Vault ---

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${appName}-kv'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
  }
}

// --- Monitoring ---

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// --- Outputs ---

output openaiEndpoint string = openai.properties.endpoint
output searchEndpoint string = 'https://${searchService.name}.search.windows.net'
output apiUrl string = 'https://${webApp.properties.defaultHostName}'
output frontendUrl string = staticWebApp.properties.defaultHostname
