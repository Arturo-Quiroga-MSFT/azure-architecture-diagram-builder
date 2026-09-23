# Bicep Templates for Deploy Industrial IoT Predictive Maintenance Platform to Azure
Generated: 2026-05-26, 9:37:38 p.m.

## Deployment Instructions

1. Review and customize parameters in main.bicep
2. Deploy with Azure CLI:
   ```bash
   az login
   az group create --name <rg-name> --location <location>
   az deployment group create --resource-group <rg-name> --template-file main.bicep
   ```

## Files Included
- main.bicep: Orchestration template deploying networking, IoT Hub, DPS, Stream Analytics, AML, Digital Twins, Data Lake, Synapse, Time Series Insights, and monitoring.
- modules/network.bicep: Creates VNet, subnets, and private endpoint subnet for OT/IT segregation and Private Link.
- modules/storage.bicep: Creates ADLS Gen2 storage account with lifecycle policies for hot and cold retention and Private Link support.
- modules/iothub.bicep: Creates IoT Hub with Private Link-ready configuration and appropriate SKU for high-throughput telemetry.
- modules/dps.bicep: Creates IoT Hub Device Provisioning Service and links it to the IoT Hub.
- modules/streamAnalytics.bicep: Creates a Stream Analytics job wired to IoT Hub (input), Data Lake, Digital Twins, Azure ML, and Azure Monitor (outputs).
- modules/aml.bicep: Creates an Azure Machine Learning workspace integrated with the Data Lake storage account.
- modules/digitalTwins.bicep: Creates an Azure Digital Twins instance for facility modeling.
- modules/synapse.bicep: Creates a basic Synapse workspace linked to the Data Lake storage account for analytics.
- modules/tsi.bicep: Creates a Time Series Insights environment for time-series telemetry dashboards.
- modules/monitoring.bicep: Creates a Log Analytics workspace and diagnostic settings for IoT Hub and Storage.
