# AI Model Comparison: IoT Predictive Maintenance Architecture

**Date:** February 12, 2026  
**Prompt Used:** *"An industrial IoT predictive maintenance platform for a manufacturing facility with 5,000+ sensors generating telemetry every 5 seconds, requiring real-time anomaly detection with sub-second latency, batch analytics for trend analysis, secure device provisioning and management, OT/IT network segregation with Private Link, 99.9% uptime SLA, 6-month hot storage and 7-year cold retention, using IoT Hub for ingestion, Stream Analytics for real-time processing, Azure ML for predictive models, Data Lake for raw storage, Synapse Analytics for reporting, Time Series Insights for dashboards, and Digital Twins for facility modeling"*

---

## Summary Results

| Metric | GPT-5.2 (medium) | GPT-5.2 (low) | GPT-4.1 | GPT-4.1 Mini |
|--------|-------------------|----------------|---------|--------------|
| **Generation Time** | 269 seconds | 98 seconds | 19 seconds | 23 seconds |
| **Services Generated** | 20 | 14 | 10 | 11 |
| **Connections** | 33 | 17 | 10 | 10 |
| **Groups** | 5 | 5 | 5 | 6 |
| **Workflow Steps** | 9 | 10 | 9 | 8 |
| **Max Tokens** | 16,000 | 16,000 | 10,000 | 8,000 |

---

## Saved Diagram Files

| Model | File |
|-------|------|
| GPT-5.2 (medium) | `azure-diagram-1770919456845-gpt52-medium-269-seconds_IoT.json` |
| GPT-5.2 (low) | `azure-diagram-1770920384885-gpt52-low-98-seconds_IoT.json` |
| GPT-4.1 | `azure-diagram-1770919848691-gpt41-19-seconds_IoT.json` |
| GPT-4.1 Mini | `azure-diagram-1770919578221-gpt41mini-23-seconds_IoT.json` |

---

## Detailed Analysis

### 1. GPT-5.2 (medium reasoning) — Most Comprehensive

**Time:** 269 seconds | **20 services, 33 connections**

The most architecturally complete output. Covers every layer of the solution:

**Services included:**
- **Ingestion:** IoT Hub, VNet (OT)
- **Real-time Processing:** Stream Analytics, AML Online Endpoint, Digital Twins
- **Data Platform:** Data Lake Storage, Storage Account (archive), Data Factory, Synapse Analytics
- **Application Layer:** Cosmos DB, Service Bus, Azure Functions, SignalR, Static Web Apps, API Management
- **Security & Operations:** Entra ID, Key Vault, Azure Firewall, VNet (IT), Azure Monitor, Log Analytics

**Unique strengths vs other models:**
- Only model to include a **real-time notification pipeline** (Service Bus → Functions → SignalR)
- Only model to include **Cosmos DB** for fast near-real-time dashboard queries
- Only model to include **Data Factory** for batch ETL orchestration
- Only model to include a full **application tier** (Static Web Apps + API Management)
- Uses **two separate Virtual Networks** (OT and IT) for true network segregation
- Connection labels are highly descriptive and architecturally precise

**Example connection label:**  
*"Tier aged partitions from hot lake to cold archive storage to meet 7-year retention policy"*

---

### 2. GPT-5.2 (low reasoning) — Best Value

**Time:** 98 seconds | **14 services, 17 connections**

Captures ~80% of the medium output in ~1/3 of the time. Excellent balance of depth and speed.

**Services included:**
- **Ingestion:** IoT Hub
- **Real-time Processing:** Stream Analytics, AML Online Endpoint, Digital Twins
- **Data Platform:** Data Lake Storage, Storage Account (archive), Synapse Analytics
- **ML:** Azure Machine Learning (workspace + online endpoint separated)
- **Security & Operations:** Entra ID, Key Vault, Azure Firewall, VNet, Azure Monitor, Log Analytics

**What it covers well:**
- Full security layer (Firewall, VNet, Entra ID, Key Vault)
- OT/IT network segregation with Azure Firewall
- 7-year cold retention (Storage Account archive)
- Observability (Azure Monitor + Log Analytics)
- ML training/serving separation (AML workspace vs Online Endpoint)

**What it drops vs medium:**
- No Service Bus → Functions → SignalR notification pipeline
- No Cosmos DB for dashboard queries
- No API Management or Static Web Apps (application tier)
- No Data Factory for batch ETL
- Single VNet instead of separate OT/IT VNets

---

### 3. GPT-4.1 — Best Speed/Quality Ratio

**Time:** 19 seconds | **10 services, 10 connections**

Clean, correct, and concise. Includes every service explicitly mentioned in the prompt.

**Services included:**
- IoT Hub, Stream Analytics, AML Online Endpoint, Data Lake Storage, Synapse Analytics, Time Series Insights, Digital Twins, Virtual Network, Microsoft Entra ID

**Strengths:**
- Fastest generation (19 seconds)
- Properly distinguished AML from AML Online Endpoint
- Included Time Series Insights correctly
- Clean, well-structured workflow narrative
- Good for quick iterations and simpler architectures

**Limitations:**
- No security depth (missing Key Vault, Firewall)
- No observability layer (missing Monitor, Log Analytics)
- No application tier
- No 7-year cold retention handling
- Single VNet only

---

### 4. GPT-4.1 Mini — Fastest but Least Accurate

**Time:** 23 seconds | **11 services, 10 connections**

Fast but made notable errors in service selection.

**Services included:**
- IoT Hub, Stream Analytics, AML Online Endpoint, Azure ML, Data Lake Storage, Synapse Analytics, Azure Cognitive Search (incorrectly), Digital Twins, Virtual Network, Microsoft Entra ID

**Issues:**
- **Incorrectly substituted Azure Cognitive Search for Time Series Insights** — the node ID is `svc-time-series-insights` but the label says "Azure Cognitive Search"
- ML training loop between AML workspace and endpoint is unclear/reversed
- Missing security services (no Key Vault, no Firewall)
- No observability layer

---

## Prompt Requirements Coverage

| Requirement from Prompt | GPT-5.2 (med) | GPT-5.2 (low) | GPT-4.1 | GPT-4.1 Mini |
|--------------------------|:-:|:-:|:-:|:-:|
| IoT Hub for ingestion | ✅ | ✅ | ✅ | ✅ |
| Stream Analytics for real-time processing | ✅ | ✅ | ✅ | ✅ |
| Azure ML for predictive models | ✅ | ✅ | ✅ | ✅ |
| Data Lake for raw storage | ✅ | ✅ | ✅ | ✅ |
| Synapse Analytics for reporting | ✅ | ✅ | ✅ | ✅ |
| Time Series Insights for dashboards | ❌ | ❌ | ✅ | ⚠️ Wrong service |
| Digital Twins for facility modeling | ✅ | ✅ | ✅ | ✅ |
| OT/IT network segregation with Private Link | ✅ (2 VNets + Firewall) | ✅ (Firewall + VNet) | ⚠️ VNet only | ⚠️ VNet only |
| Secure device provisioning | ✅ (Entra + Key Vault) | ✅ (Entra + Key Vault) | ✅ (Entra only) | ✅ (Entra only) |
| 6-month hot storage | ✅ | ✅ | ✅ | ✅ |
| 7-year cold retention | ✅ (Archive Storage) | ✅ (Archive Storage) | ❌ | ❌ |
| 99.9% uptime SLA monitoring | ✅ (Monitor + Log Analytics) | ✅ (Monitor + Log Analytics) | ❌ | ❌ |

---

## Key Takeaways

1. **GPT-5.2 is the clear winner for complex architectures** — it's the only model that addressed all non-functional requirements (cold retention, network segregation, observability).

2. **Reasoning effort matters significantly for GPT-5.2:**
   - **Medium** (269s): 20 services, full application layer included
   - **Low** (98s): 14 services, covers infrastructure well but skips application tier
   - Low reasoning is ~2.7× faster while retaining ~80% of the architectural depth

3. **GPT-4.1 is ideal for quick iterations** — 19 seconds for a clean, correct diagram. Best for simpler architectures or when speed matters more than depth.

4. **GPT-4.1 Mini should be used cautiously** — it can produce incorrect service substitutions (Cognitive Search instead of Time Series Insights).

5. **Recommended settings by use case:**
   - **Complex enterprise architectures:** GPT-5.2 (medium)
   - **Quick infrastructure overviews:** GPT-5.2 (low)
   - **Simple architectures / rapid prototyping:** GPT-4.1
   - **Cost-sensitive quick drafts:** GPT-4.1 Mini (with manual review)

---

*Generated with the Azure Architecture Diagram Generator — all four outputs available in the `Azure_generated_diagrams/` folder.*
