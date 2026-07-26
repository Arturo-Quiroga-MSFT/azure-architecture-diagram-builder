# Studio test prompts

Prompts to paste into **AADB** to generate diagrams that exercise every current
Physical Architecture Studio feature. After generating each diagram, export the
JSON from AADB and load it in the Studio via **Import file…**.

---

## Core coverage

### 1. Max private-endpoint breadth (RAG assistant)

> Design a private, regulated enterprise RAG chat assistant on Azure using Azure
> Container Apps, Azure OpenAI, Azure AI Search, a Storage Account for documents,
> Azure Cosmos DB for chat history, Key Vault for secrets, Application Insights
> and Log Analytics. All data services must be private-only.

Verify:
- 5 private endpoints with distinct IPs (`10.21.2.4`–`10.21.2.8`)
- Workload subnet delegated `Microsoft.App/environments`
- App Insights + Log Analytics land in the **management** platform landing zone
- `ALZ 9/9 · hub & spoke`

### 2. Ingress + AKS + messaging

> Design an event-driven microservices platform on Azure Kubernetes Service with
> Application Gateway ingress, Azure Service Bus for messaging, Azure Container
> Registry, Azure Cache for Redis, Azure SQL Database, and Azure Monitor.

Verify:
- An extra **`app-gateway` subnet** appears (ingress class)
- Private endpoints for Service Bus, Container Registry, Redis, SQL
- AKS placed in the workload subnet with **no delegation**

### 3. Functions delegation

> Design a serverless document-processing pipeline using Azure Functions, Blob
> Storage, Azure Event Grid, Document Intelligence, Cosmos DB and Key Vault.

Verify:
- Workload subnet delegated **`Microsoft.Web/serverFarms`** (differs from #1)
- Event Grid PE on `privatelink.eventgrid.azure.net`
- Document Intelligence PE on `privatelink.cognitiveservices.azure.com`

### 4. Data & analytics

> Design an enterprise analytics platform with Azure Data Factory, Azure Synapse
> Analytics, Event Hubs, Stream Analytics, Data Lake storage, Azure Databricks
> and Power BI Embedded.

Verify:
- Data Factory / Synapse / Event Hubs receive private endpoints
- Stream Analytics classified as compute, Power BI as observability
- Databricks may report as **unmapped** (expected — see #8)

### 5. IoT

> Design an industrial IoT telemetry solution using Azure IoT Hub, IoT Central,
> Azure Digital Twins, Event Grid, Azure Functions, Cosmos DB and Azure Managed
> Grafana.

Verify:
- IoT Hub / Digital Twins / Event Grid private endpoints
- IoT Central as compute, Grafana as observability

### 6. Cognitive variants + APIM / Logic Apps

> Design a multilingual customer support automation platform using API
> Management, Logic Apps, Azure Functions, Speech Services, Translator, Language
> service, Computer Vision, Service Bus and Cosmos DB.

Verify:
- **APIM triggers the `app-gateway` subnet** (ingress class)
- Logic Apps PE on `privatelink.azurewebsites.net`
- All four cognitive services resolve

---

## Edge cases

### 7. Infrastructure recognition — expect **0 unmapped**

> Design a secure hub-and-spoke Azure network for a banking workload including
> Virtual Network, Azure Firewall, Azure Front Door, Azure Private Link, Azure
> Bastion, DDoS Protection, Microsoft Entra ID, plus App Service, Azure SQL
> Database and Key Vault.

Verify:
- Banner reports *"platform/global construct(s) recognized and handled by the
  landing zone"* listing VNet, Firewall, Front Door, Private Link, Bastion,
  DDoS, Entra ID
- **Unmapped is empty** — infrastructure nodes must not be treated as errors

### 8. Deliberate unmapped (negative test)

> Design a hybrid workload using Azure VMware Solution, Azure HPC Cache, Azure
> Quantum and Microsoft Purview, alongside Azure Storage and Key Vault.

Verify:
- The yellow **Unmapped** chip lists the exotic services
- Promotion still succeeds and Storage / Key Vault still receive private
  endpoints — nothing is silently dropped

---

## Checks that apply to every import

- Source banner reads `AADB file: … (scene)` — confirms scene-format auto-detection
- Validation rail: `CIDR validation Passed` and `ALZ n/n`
- **BICEP / TERRAFORM / MGMT GROUPS / TRACE** tabs regenerate live
- Clicking a private endpoint shows target service, subnet, allocated IP and DNS zone
- **Return to AADB** downloads a manifest with VNets, firewall, gateway and PEs as nodes

---

## Features not reachable from an AADB diagram

| Feature | How to exercise it |
|---|---|
| CIDR overlap failure | **Inject overlap** button (works with any diagram) |
| Virtual WAN topology + IaC | **Topology toggle** in the toolbar (`hub & spoke` ⇄ `Virtual WAN`) |
| Management group hierarchy | **MGMT GROUPS** tab, or `POST /api/management-groups/{bicep\|terraform}` |
| DR region | Only the built-in golden scenario declares one; promotion sets the primary region only |
