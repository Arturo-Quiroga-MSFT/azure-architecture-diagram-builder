# Bicep Templates for Deploy Secure Imaging Event Processing Architecture to Azure
Generated: 2026-02-12, 6:33:18 p.m.

## Deployment Instructions

1. Review and customize parameters in main.bicep
2. Deploy with Azure CLI:
   ```bash
   az login
   az group create --name <rg-name> --location <location>
   az deployment group create --resource-group <rg-name> --template-file main.bicep
   ```

## Files Included
- main.bicep: Orchestration template deploying all service modules and wiring secure key vault integrations.
- modules/keyvault.bicep: Module to deploy Azure Key Vault with access policies for managed identities.
- modules/vpngateway.bicep: Module to deploy a VPN Gateway configured for secure connectivity.
- modules/eventhubs.bicep: Module to deploy Event Hubs namespace and hubs with RBAC integration with Key Vault.
- modules/servicebus.bicep: Module to deploy Service Bus namespace and queues with integration.
- modules/azurefunctions.bicep: Module to deploy Azure Functions with managed identity and Key Vault access.
- modules/cosmosdb.bicep: Module to deploy Azure Cosmos DB configured with Key Vault reference for keys.
- modules/storageaccount.bicep: Module to deploy a secure Storage Account with Key Vault integration for secrets.
- modules/loganalytics.bicep: Module to deploy Log Analytics workspace for monitoring.
- modules/virtualmachines.bicep: Module to deploy Virtual Machines connected to VPN Gateway.
