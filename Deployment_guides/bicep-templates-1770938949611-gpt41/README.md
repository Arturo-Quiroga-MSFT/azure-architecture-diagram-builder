# Bicep Templates for Deploy Secure Healthcare Imaging Pipeline with Azure Key Vault Integration
Generated: 2026-02-12, 6:28:53 p.m.

## Deployment Instructions

1. Review and customize parameters in main.bicep
2. Deploy with Azure CLI:
   ```bash
   az login
   az group create --name <rg-name> --location <location>
   az deployment group create --resource-group <rg-name> --template-file main.bicep
   ```

## Files Included
- main.bicep: Orchestration of all modules, parameterization, secure connections.
- modules/keyvault.bicep: Creates Key Vault and configures access policies for Functions, Cosmos DB, Storage Account.
- modules/eventhubs.bicep: Creates Event Hubs namespace, event hub, and configures diagnostics to Log Analytics.
- modules/servicebus.bicep: Creates Service Bus namespace, queue, and configures access.
- modules/functions.bicep: Creates Function App with managed identity, configures access to Key Vault, Service Bus, Event Hubs, Storage, Cosmos DB.
- modules/cosmosdb.bicep: Creates Cosmos DB account and secures keys in Key Vault.
- modules/storage.bicep: Creates Storage Account and secures keys in Key Vault.
- modules/loganalytics.bicep: Creates Log Analytics Workspace for monitoring.
- modules/vpn.bicep: Creates VPN Gateway for secure connectivity.
- modules/vm.bicep: Creates VM in the virtual network, connects to VPN.
- modules/vnet.bicep: Creates VNet and subnets for VPN Gateway and VM.
- modules/entraid.bicep: Prepares client app registrations and managed identity assignments.
