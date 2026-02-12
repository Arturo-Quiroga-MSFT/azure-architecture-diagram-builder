# Bicep Templates for Deploy Healthcare Imaging Event Pipeline with Key Vault Security to Azure
Generated: 2026-02-12, 5:00:01 p.m.

## Deployment Instructions

1. Review and customize parameters in main.bicep
2. Deploy with Azure CLI:
   ```bash
   az login
   az group create --name <rg-name> --location <location>
   az deployment group create --resource-group <rg-name> --template-file main.bicep
   ```

## Files Included
- main.bicep: Orchestrates deployment of network, VPN gateway, messaging, compute, data, monitoring, and Key Vault security with managed identity + RBAC assignments.
- modules/network.bicep: Creates VNet, GatewaySubnet, and VM subnet. Provides subnet IDs for VPN and VM resources.
- modules/vpnGateway.bicep: Creates Public IP for VPN Gateway, the VPN Gateway, Local Network Gateway, and VPN connection to on-prem.
- modules/logAnalytics.bicep: Creates a Log Analytics workspace used for diagnostics and monitoring.
- modules/keyVault.bicep: Creates Key Vault with RBAC authorization enabled. Intended to hold storage/cosmos keys if required and to centralize secrets. (Key Vault references/runtimes are app-specific.)
- modules/storage.bicep: Creates a Storage Account for imaging payloads with secure transfer and diagnostic settings to Log Analytics.
- modules/cosmos.bicep: Creates a Cosmos DB account (SQL API), database, and container. Enables diagnostics to Log Analytics.
- modules/eventHubs.bicep: Creates Event Hubs namespace and hub for ingestion. Enables diagnostic settings to Log Analytics.
- modules/serviceBus.bicep: Creates Service Bus namespace and a queue for routing/notification. Enables diagnostics to Log Analytics.
- modules/functionApp.bicep: Creates a consumption-based Function App with system-assigned managed identity, App Insights via workspace-based configuration, and basic app settings including Key Vault URI.
- modules/virtualMachines.bicep: Creates a Windows or Linux VM (Linux sample) in VM subnet and enables basic monitoring via Log Analytics agent extension (AMA not fully configured here).
- modules/roleAssignments.bicep: Reusable role assignment module for RBAC (used for Key Vault, Storage, Event Hubs, Service Bus, Cosmos).
