# Deploy Industrial IoT Predictive Maintenance Platform to Azure

## Overview

This guide deploys an industrial IoT predictive maintenance platform for a manufacturing facility with 5,000+ sensors sending telemetry every 5 seconds. The architecture uses Azure IoT Hub for ingestion, Stream Analytics for real-time anomaly detection with sub-second latency, Azure Machine Learning for predictive models, Data Lake (ADLS Gen2) for hot storage (6 months) and long-term cold retention (7 years), Synapse Analytics for reporting, Time Series Insights for dashboards, Azure Digital Twins for facility modeling, Azure Private Link for OT/IT segregation, and Azure Monitor + Log Analytics for observability.

**Estimated Time:** 60-90 minutes

**Estimated Cost:** $234.30/month (approximate, depends on scale, region, and SKUs)

## Prerequisites

- Azure subscription with Owner or Contributor role on target resource group
- Azure CLI 2.50+ (with bicep CLI integrated: `az bicep version`)
- Permissions: Ability to create resource groups, networking (VNets, private endpoints), storage, IoT Hub, Stream Analytics, Azure ML, Synapse, Digital Twins, Time Series Insights, Log Analytics, and Monitoring resources
- Microsoft Entra ID permissions to create app registrations/service principals (or an existing SPN) for Azure Machine Learning and Synapse
- Git and a local folder for storing Bicep templates
- Deployment workstation with access to the OT/IT jump host (if required by your security policy) and outbound HTTPS access to Azure
- Optional but recommended: Azure PowerShell Az module for advanced validation

## Deployment Steps

### Step 1: Login and set subscription

Authenticate to Azure and set the target subscription.

**Commands:**
```bash
az login
az account set --subscription "<SUBSCRIPTION_ID_OR_NAME>"
az account show --output table
```

**Notes:**
- 💡 Ensure you are using an account with Contributor or higher permissions on the target subscription.
- 💡 If using a service principal, use `az login --service-principal -u <appId> -p <password> --tenant <tenantId>`.

### Step 2: Create resource group

Create a dedicated resource group for all IoT platform resources.

**Commands:**
```bash
az group create \
  --name iot-predictive-rg \
  --location eastus
```

**Notes:**
- 💡 Choose a region that supports IoT Hub, Digital Twins, Time Series Insights, Synapse, and Azure Machine Learning (for example, `eastus`, `westeurope`).
- 💡 All region-specific parameters in the Bicep template can be updated to another region if needed.

### Step 3: Prepare environment variables

Set environment variables for consistent naming and deployment.

**Commands:**
```bash
export IOT_ENV="prod"
export IOT_LOCATION="eastus"
export IOT_RG="iot-predictive-rg"
export IOT_DEPLOY_NAME="iot-predictive-deployment"
```

**Notes:**
- 💡 On Windows PowerShell, use `$env:IOT_ENV="prod"` syntax instead.
- 💡 These variables are referenced in subsequent CLI commands and Bicep parameters.

### Step 4: Download or create Bicep templates

Create a working directory and save the `main.bicep` and module files.

**Commands:**
```bash
mkdir iot-predictive-platform
cd iot-predictive-platform
# Create the following files in this folder:
# - main.bicep
# - modules/network.bicep
# - modules/storage.bicep
# - modules/iothub.bicep
# - modules/dps.bicep
# - modules/streamAnalytics.bicep
# - modules/aml.bicep
# - modules/digitalTwins.bicep
# - modules/synapse.bicep
# - modules/tsi.bicep
# - modules/monitoring.bicep
```

**Notes:**
- 💡 Copy the Bicep content from the `bicepTemplates` section of this guide into the corresponding files.
- 💡 Maintain the folder structure: `./main.bicep` and `./modules/*.bicep`.

### Step 5: Validate Bicep templates

Validate the Bicep deployment to catch issues before creating resources.

**Commands:**
```bash
az deployment group what-if \
  --name $IOT_DEPLOY_NAME \
  --resource-group $IOT_RG \
  --template-file main.bicep \
  --parameters env=$IOT_ENV location=$IOT_LOCATION
```

**Notes:**
- 💡 Review the what-if output to ensure resources and naming meet expectations.
- 💡 Fix any validation errors before proceeding.

### Step 6: Deploy core infrastructure and services

Deploy networking (VNet, subnets, private endpoints), storage, IoT Hub, DPS, Stream Analytics, Azure ML, Digital Twins, Synapse, Time Series Insights, and monitoring resources.

**Commands:**
```bash
az deployment group create \
  --name $IOT_DEPLOY_NAME \
  --resource-group $IOT_RG \
  --template-file main.bicep \
  --parameters env=$IOT_ENV location=$IOT_LOCATION
```

**Notes:**
- 💡 Initial deployment may take 15–30 minutes depending on region and service provisioning times.
- 💡 If certain services (like Synapse or AML) require additional manual steps (e.g., workspace initialization), follow the post-deployment notes.

### Step 7: Retrieve outputs (endpoints and connection strings)

Fetch key endpoints and connection strings for device enrollment, data integration, and monitoring.

**Commands:**
```bash
az deployment group show \
  --name $IOT_DEPLOY_NAME \
  --resource-group $IOT_RG \
  --query properties.outputs \
  --output json > deployment-outputs.json
cat deployment-outputs.json
```

**Notes:**
- 💡 Store sensitive outputs (keys, connection strings) in a secure location such as Azure Key Vault.
- 💡 Use these outputs to configure IoT Edge gateway, Stream Analytics, Digital Twins, Synapse pipelines, and Time Series Insights.

### Step 8: Configure IoT Edge gateway and DPS

Configure the Azure IoT Edge Gateway to connect via Device Provisioning Service (DPS) and route telemetry to IoT Hub over Private Link.

**Commands:**
```bash
# Example: set environment variables on the edge device (commands vary by OS):
IOT_HUB_DPS_ID_SCOPE="<from deployment-outputs.json>"
IOT_HUB_DPS_PRIMARY_KEY="<from deployment-outputs.json>"
IOT_EDGE_DEVICE_ID="edge-gateway-01"
# Configure IoT Edge runtime (see official IoT Edge docs for OS-specific commands)
```

**Notes:**
- 💡 Use DPS ID Scope and symmetric keys or X.509 certificates as per your security policy.
- 💡 Ensure the OT network only allows outbound connectivity via the Private Link-enabled path to Azure.

### Step 9: Configure Stream Analytics inputs and outputs

Bind IoT Hub as input, Data Lake, Digital Twins, Azure ML, and Azure Monitor as outputs. The Bicep template creates placeholders; you must publish the Stream Analytics job with a query.

**Commands:**
```bash
az stream-analytics job show \
  --name $(jq -r '.streamAnalyticsJobName.value' deployment-outputs.json) \
  --resource-group $IOT_RG
# Use Azure Portal or `az stream-analytics input/output` commands to finalize inputs/outputs and add your query.
```

**Notes:**
- 💡 Ensure the Stream Analytics job query is optimized for sub-second latency.
- 💡 Configure the Azure ML function output with the endpoint URL and key from the AML workspace.

### Step 10: Enable monitoring and alerts

Configure Azure Monitor and Log Analytics-based alerts for SLA and anomaly monitoring.

**Commands:**
```bash
az monitor metrics alert create \
  --name "iot-hub-throughput-alert" \
  --resource-group $IOT_RG \
  --scopes $(jq -r '.iotHubResourceId.value' deployment-outputs.json) \
  --condition "avg IncomingMessages > 10000" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --description "High incoming message rate on IoT Hub"
```

**Notes:**
- 💡 Adjust alert thresholds and metrics (e.g., device disconnections, Stream Analytics backpressure) to match your SLA requirements.
- 💡 Set up action groups to notify operations teams via email, SMS, or ITSM connectors.

## Configuration

### Core Environment Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `ENV` | prod | Logical environment (e.g., dev, test, prod) used for naming and tagging. |
| `LOCATION` | eastus | Azure region where resources are deployed; must support IoT, ML, Synapse, TSI, Digital Twins. |
| `IOT_RG` | iot-predictive-rg | Resource group name containing all platform resources. |

### IoT Hub and DPS

| Setting | Value | Description |
|---------|-------|-------------|
| `IOT_HUB_NAME` | iot-${ENV}-hub | IoT Hub name; must be globally unique. Used for ingestion of 5,000+ sensors on a 5-second interval. |
| `IOT_HUB_SKU` | S2 | IoT Hub SKU (e.g., S1, S2). Use S2 or higher to support throughput and 99.9% SLA requirements. |
| `DPS_NAME` | iot-${ENV}-dps | IoT Hub Device Provisioning Service name for zero-touch enrollment. |

### Storage and Retention

| Setting | Value | Description |
|---------|-------|-------------|
| `DATA_LAKE_ACCOUNT_NAME` | st${ENV}iotdatalake | ADLS Gen2 storage account for hot-path telemetry and model training data. |
| `HOT_STORAGE_RETENTION_DAYS` | 180 | Telemetry retention in hot storage (approx. 6 months). Implemented via lifecycle management rules. |
| `COLD_STORAGE_RETENTION_YEARS` | 7 | Cold storage retention for compliance. Data may be moved to archive tier or separate long-term containers. |

### Networking and Security

| Setting | Value | Description |
|---------|-------|-------------|
| `VNET_NAME` | vnet-iot-${ENV} | Virtual network used for private endpoints and OT/IT segregation. |
| `PRIVATE_DNS_ZONE_SUFFIX` | privatelink.azure-devices.net | Private DNS zone for IoT Hub Private Link integration. |
| `ENABLE_PRIVATE_LINK` | true | Toggle to enable Azure Private Link for IoT Hub and storage to ensure OT/IT network segregation. |

### Azure Machine Learning and Synapse

| Setting | Value | Description |
|---------|-------|-------------|
| `AML_WORKSPACE_NAME` | mlw-iot-${ENV} | Azure Machine Learning workspace for training and deploying predictive maintenance models. |
| `SYNAPSE_WORKSPACE_NAME` | syn-iot-${ENV} | Synapse workspace name for batch analytics and reporting. |
| `AML_COMPUTE_SKU` | STANDARD_DS3_V2 | Default compute SKU for training; adjust based on model complexity and cost constraints. |

### Monitoring and Observability

| Setting | Value | Description |
|---------|-------|-------------|
| `LOG_ANALYTICS_WORKSPACE_NAME` | law-iot-${ENV} | Log Analytics workspace for centralized logs and metrics. |
| `ENABLE_DIAGNOSTICS` | true | Enables diagnostic settings for IoT Hub, Stream Analytics, and other services to send data to Log Analytics. |

## Post-Deployment Validation

- [ ] Verify IoT Hub connectivity by registering a test device (or edge gateway) and sending sample telemetry; confirm events arrive in IoT Hub metrics.
- [ ] Confirm Private Link isolation: from OT network, ensure IoT Hub resolves via the private endpoint and not via public IP; from the internet, verify IoT Hub is not accessible if public network access is disabled.
- [ ] Validate Stream Analytics job: ensure input from IoT Hub is active, outputs to Data Lake, Digital Twins, Azure ML, and Azure Monitor are healthy, and end-to-end processing latency meets sub-second requirements.
- [ ] Check Azure Machine Learning workspace: ensure training data in Data Lake is accessible, and a sample predictive model endpoint can be deployed and invoked.
- [ ] Validate Digital Twins instance: load or import your facility model (building, production lines, equipment) and confirm updates from telemetry flow into twin properties.
- [ ] Check Time Series Insights environment: confirm telemetry is visible in dashboards and supports both near-real-time and historical analysis.
- [ ] Validate Synapse Analytics: confirm connectivity to Data Lake, run a sample query/Notebook or pipeline, and generate a basic trend report.
- [ ] Verify monitoring: check that logs and metrics from IoT Hub, Stream Analytics, and other services are appearing in Log Analytics; validate configured alerts fire when conditions are simulated (e.g., elevated error rates).

## Troubleshooting

**Issue:** IoT Edge gateway cannot connect to IoT Hub/DPS (connection refused or timed out)

**Solution:** Verify that the DPS ID Scope, registration ID, and credentials (symmetric keys or certificates) match those configured in the Azure DPS instance. Ensure the IoT Hub and DPS are configured with private endpoints and that the OT network DNS resolves the IoT Hub and DPS FQDNs to the private IPs. Check firewall rules and confirm public network access is disabled only if Private Link is configured correctly.

**Issue:** Stream Analytics job remains in a degraded state or shows high backlog

**Solution:** Check Stream Analytics job metrics in Azure Monitor for input events, output events, and backpressure. Increase Streaming Units (SUs) if throughput is insufficient. Validate that the query uses windowing and aggregations optimized for real-time. Ensure output sinks (Data Lake, Digital Twins, Azure ML, Azure Monitor) are reachable and not throttling. Adjust partitioning and input/ output concurrency as needed.

**Issue:** Azure Machine Learning can’t access training data in Data Lake

**Solution:** Confirm the AML workspace managed identity (or configured service principal) has `Storage Blob Data Reader` and `Storage Blob Data Contributor` roles on the Data Lake storage account or specific containers. Ensure networking restrictions (VNet, private endpoints) allow access from AML to storage. Validate that the storage account firewall includes the AML workspace, VNet, or trusted services as appropriate.

**Issue:** Time Series Insights or Digital Twins show no data

**Solution:** Verify that Stream Analytics outputs targeting Time Series Insights and Digital Twins are configured and enabled. Check the output diagnostic logs for errors. For Digital Twins, confirm the twin IDs used in updates match existing twins in the model. For TSI, ensure the event source points to the correct storage account and event schema mapping matches the actual telemetry format.

**Issue:** Private Link DNS resolution issues from on-premises/OT network

**Solution:** Confirm a Private DNS zone (e.g., `privatelink.azure-devices.net`) is linked to the VNet hosting the private endpoints. Propagate DNS from Azure to the OT DNS infrastructure (conditional forwarders) so IoT Hub and other service FQDNs resolve to private IPs. Clear DNS cache on clients (`ipconfig /flushdns` or equivalent) and verify resolution with `nslookup` or `dig`.

**Issue:** Deployment fails with policy or quota errors

**Solution:** Review the deployment error details using `az deployment group show` and check for policy or quota messages. If quotas are exceeded (e.g., IoT Hub units, public IPs, vCPU limits), open a support ticket or reduce resource sizes. If a policy blocks certain SKUs or open network access, adjust the Bicep parameters (e.g., enable private endpoints, change SKUs) to comply with your organization's policies.

---

*Generated: 2026-05-26, 9:37:38 p.m.*
