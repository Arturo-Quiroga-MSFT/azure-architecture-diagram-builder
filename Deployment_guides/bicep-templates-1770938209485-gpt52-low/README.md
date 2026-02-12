# Bicep Templates for Deploy Secure Imaging Event Pipeline (VPN → Event Hubs → Service Bus → Functions → Cosmos DB/Storage) with Key Vault to Azure
Generated: 2026-02-12, 6:16:24 p.m.

## Deployment Instructions

1. Review and customize parameters in main.bicep
2. Deploy with Azure CLI:
   ```bash
   az login
   az group create --name <rg-name> --location <location>
   az deployment group create --resource-group <rg-name> --template-file main.bicep
   ```

## Files Included
- main.bicep: Orchestrates deployment of networking/VPN, messaging, compute, data, security, and monitoring modules. Adds tags and wires Key Vault to Functions for secret retrieval.
- modules/logAnalytics.bicep: Creates a Log Analytics Workspace for central monitoring/diagnostics.
- modules/networkVpnGateway.bicep: Creates VNet, subnets (GatewaySubnet + VM subnet), Public IP, VPN Gateway, Local Network Gateway, and VPN Connection.
- modules/eventHubs.bicep: Creates Event Hubs namespace and an Event Hub, plus diagnostic settings to Log Analytics.
- modules/serviceBus.bicep: Creates Service Bus namespace and a queue, plus diagnostic settings to Log Analytics.
- modules/storageAccount.bicep: Creates a Storage Account for large imaging payloads. Outputs a connection string for Key Vault secret population.
- modules/cosmosDb.bicep: Creates a Cosmos DB account (SQL API) for imaging study metadata. Outputs primary key for Key Vault secret population.
- modules/keyVault.bicep: Creates a Key Vault with RBAC authorization enabled for secure secret management.
- modules/keyVaultSecrets.bicep: Creates/updates secrets in Key Vault for Storage, Cosmos, and Service Bus so Functions can retrieve them securely.
- modules/keyVaultRbac.bicep: Assigns Key Vault Secrets User to the Function App managed identity so it can read secrets (Key Vault RBAC model).
- modules/functionApp.bicep: Creates a Consumption Function App (Linux) with system-assigned identity, diagnostic settings to Log Analytics, and Key Vault references for secrets.
- modules/virtualMachine.bicep: Creates a Linux VM on the VM subnet to represent on-prem imaging systems or secure jump host testing. (VPN-side connectivity is configured separately.)
