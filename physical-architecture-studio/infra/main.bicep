// Infrastructure for the AADB Physical Architecture Studio (Technical Preview).
//
// Deploys a single Entra-protected Azure Container App into an EXISTING
// Container Apps environment, using a dedicated user-assigned managed identity.
// Entra authentication (assignment-required) is configured out-of-band via the
// deploy script, not in this template.
//
// This template is intentionally minimal and grants the app NO infrastructure
// write permissions: the studio only performs LOCAL IaC validation.

@description('Azure region for the Container App.')
param location string = resourceGroup().location

@description('Name of the Container App.')
param appName string = 'physical-architecture-studio'

@description('Resource ID of the existing Container Apps managed environment.')
param managedEnvironmentId string

@description('Login server of the existing Azure Container Registry, e.g. myacr.azurecr.io')
param acrLoginServer string

@description('Full image reference including tag, e.g. myacr.azurecr.io/physical-architecture-studio:latest')
param image string

@description('Minimum replica count. Keep >=1 to avoid cold starts during demos.')
@minValue(1)
param minReplicas int = 1

@description('Maximum replica count.')
param maxReplicas int = 3

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-identity'
  location: location
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
      }
      registries: [
        {
          server: acrLoginServer
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: appName
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output appFqdn string = app.properties.configuration.ingress.fqdn
output identityPrincipalId string = identity.properties.principalId
output identityClientId string = identity.properties.clientId
