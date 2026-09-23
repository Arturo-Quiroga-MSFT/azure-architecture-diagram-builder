# ML Pipeline — Model Comparison

## Prompt Used

> A machine learning pipeline with data ingestion, training, and inference endpoints

---

## Summary Table

| Metric | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|---|
| **Generation Time** | 22 seconds | 7 seconds | 51 seconds | 45 seconds |
| **Azure Services** | 9 | 9 | 11 | 11 |
| **Groups** | 5 | 4 | 4 | 4 |
| **Connections** | 15 | 10 | 18 | 12 |
| **Workflow Steps** | 10 | 10 | 10 | 8 |
| **Async Connections** | 3 | 2 | 3 | 1 |
| **Optional Connections** | 0 | 0 | 1 | 0 |
| **Reverse/Bidirectional Connections** | 0 | 1 | 1 | 3 |
| **Estimated Monthly Cost** | $297.60 | $297.60 | $323.70 | $353.96 |

---

## Saved Diagram Files

| Model Config | File |
|---|---|
| GPT-4.1 Mini (22s) | `azure-diagram-1770927192217-gpt41mini-22-seconds-ML.json` |
| GPT-4.1 (7s) | `azure-diagram-1770927338517-gpt41-7-seconds-ML.json` |
| GPT-5.2 Low (51s) | `azure-diagram-1770927672349-gpt52-low-51-seconds-ML.json` |
| GPT-5.2 Medium (45s) | `azure-diagram-1770927828278-gpt52-medium-45-seconds-ML.json` |

---

## Services Comparison Matrix

| Azure Service | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| **Azure Data Factory** | ✅ | ✅ | ✅ | ✅ |
| **Storage Account** | ✅ | ✅ | — | — |
| **Azure Data Lake Storage** | — | — | ✅ | ✅ |
| **Azure Machine Learning** | ✅ | ✅ | ✅ | ✅ |
| **AML Managed Compute** | ✅ | ✅ | ✅ | ✅ |
| **AML Online Endpoint** | ✅ | ✅ | ✅ | ✅ |
| **AML Batch Endpoint** | ✅ | ✅ | ✅ | — |
| **AML Deployment** | — | — | — | ✅ |
| **Container Registry** | — | — | ✅ | — |
| **API Management** | — | — | — | ✅ |
| **Key Vault** | ✅ | ✅ | ✅ | ✅ |
| **Application Insights** | ✅ | ✅ | ✅ | ✅ |
| **Log Analytics** | — | — | ✅ | ✅ |
| **Microsoft Entra ID** | ✅ | ✅ | ✅ | ✅ |

---

## Prompt Requirements Coverage

The prompt requested 3 explicit capabilities: data ingestion, training, and inference endpoints. The table below shows how each model delivered against explicit and implicit production requirements:

| Requirement | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| Data ingestion | ✅ Data Factory | ✅ Data Factory | ✅ Data Factory | ✅ Data Factory |
| Data storage | ✅ Storage Account | ✅ Storage Account | ✅ Data Lake Storage | ✅ Data Lake Storage |
| Model training | ✅ AML + Compute | ✅ AML + Compute | ✅ AML + Compute | ✅ AML + Compute |
| Real-time inference | ✅ Online Endpoint | ✅ Online Endpoint | ✅ Online Endpoint | ✅ Online Endpoint |
| Batch inference | ✅ Batch Endpoint | ✅ Batch Endpoint | ✅ Batch Endpoint | ❌ (replaced by APIM) |
| **Authentication** | ✅ Entra ID | ✅ Entra ID | ✅ Entra ID | ✅ Entra ID |
| **Secrets management** | ✅ Key Vault | ✅ Key Vault | ✅ Key Vault | ✅ Key Vault |
| **Monitoring** | ✅ App Insights | ✅ App Insights | ✅ App Insights | ✅ App Insights |
| **Container images** | ❌ | ❌ | ✅ Container Registry | ❌ |
| **API gateway** | ❌ | ❌ | ❌ | ✅ API Management |
| **Centralized logging** | ❌ | ❌ | ✅ Log Analytics | ✅ Log Analytics |
| **Deployment step** | ❌ (implicit) | ❌ (implicit) | ❌ (implicit) | ✅ AML Deployment |

---

## Group Organization

| Group | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|---|
| **Ingestion / Storage** | "Data Ingestion" (1 svc) + "Storage" (1 svc) | "Data Ingestion & Preparation" (2 svcs) | "Data Ingestion & Storage" (2 svcs) | "Data Ingestion & Storage" (2 svcs) |
| **Training** | "Model Training" (2 svcs) | "Model Training" (2 svcs) | "Model Training Pipeline" (3 svcs) | "ML Training & Deployment" (3 svcs) |
| **Inference** | "Inference Endpoints" (2 svcs) | "Inference Endpoints & Serving" (2 svcs) | "Model Inference" (2 svcs) | "Inference & API Access" (2 svcs) |
| **Security / Ops** | "Monitoring & Security" (3 svcs) | "Security & Monitoring" (3 svcs) | "Security & Observability" (4 svcs) | "Security & Observability" (4 svcs) |

**Notable**: GPT-4.1 Mini used 5 groups — splitting ingestion and storage into separate groups. All others consolidated them. GPT-4.1 Mini also gave the Storage group a custom blue color, the only model to use custom group styling.

---

## Connection Quality Analysis

### GPT-4.1 Mini (15 connections)
The most connections of any model, but many are repetitive — each inference endpoint has its own connection to Key Vault, App Insights, and Entra ID:
- Data Factory → Storage Account: *"Load ingested raw and processed data into Storage Account"*
- Storage Account → AML: *"Provide training data for experiments"*
- AML → AML Compute: *"Submit training jobs to managed compute"* (async/dashed)
- AML Compute → Storage: *"Store trained model artifacts in storage"*
- AML → Online Endpoint + AML → Batch Endpoint (deployment)
- Online Endpoint → Storage + Batch Endpoint → Storage (data retrieval)
- Online Endpoint → App Insights + Batch Endpoint → App Insights (async telemetry)
- AML → Key Vault + Online Endpoint → Key Vault + Batch Endpoint → Key Vault (3 secret connections)
- Online Endpoint → Entra ID + AML → Entra ID (2 auth connections)

### GPT-4.1 (10 connections)
Clean and concise — collapses redundant security connections. First model to show a **reverse** connection (Compute → AML returning trained artifact):
- Data Factory → Storage: *"Stage raw and transformed data"*
- Storage → Azure ML: *"Provide training data as dataset input"*
- Azure ML → AML Compute: *"Submit ML training jobs"*
- AML Compute → Azure ML: **reverse** — *"Return trained model artifact"*
- Azure ML → Online Endpoint: *"Deploy model for real-time inference"*
- Azure ML → Batch Endpoint: *"Deploy model for batch inference"*
- Online Endpoint → App Insights (async) + Batch Endpoint → App Insights (async)
- Key Vault → Azure ML: *"Provide secrets and credentials for workspace and endpoints"*
- Entra ID → Azure ML: *"Authenticate users and service principals"*

### GPT-5.2 Low (18 connections)
Richest connection model with the deepest technical labels. Adds Data Factory → AML pipeline trigger, Container Registry image flows, and dual logging paths (App Insights + Log Analytics):
- ADF → ADLS: *"Land raw and curated datasets into lake zones (raw/curated/features)"*
- ADF → AML: *"Trigger AML pipeline run after data refresh completes"*
- AML → ADLS: *"Read training/validation datasets and write prepared artifacts/features"*
- AML → AML Compute: *"Submit distributed training job to managed compute target"*
- AML → ACR: *"Build and push training/inference images with pinned dependencies"*
- ACR → Online Endpoint: *"Pull versioned inference image for online deployment"*
- ACR → Batch Endpoint: *"Pull versioned inference image for batch deployment"*
- AML → Online Endpoint: *"Deploy registered model version to online endpoint with traffic allocation"*
- AML → Batch Endpoint: *"Publish registered model version to batch endpoint for scheduled scoring"*
- Online Endpoint → ADLS: **optional** — *"Optionally load reference data/features for real-time scoring"*
- Batch Endpoint → ADLS: *"Read input files and write batch prediction outputs to curated zone"*
- Entra → Online Endpoint: *"Issue access tokens to callers for authenticated real-time scoring"*
- Entra → AML: *"Authorize users/service principals to run pipelines and manage models"*
- KV → ADF: *"Provide secrets for source connectors and lake write credentials"*
- KV → AML: *"Provide secrets for data access, registries, and endpoint configurations"*
- Online Endpoint → App Insights (async/reverse): *"Emit request/response metrics, traces, and dependency telemetry"*
- AML → Log Analytics (async): *"Stream training logs, metrics, and run statuses to central workspace"*
- Batch Endpoint → Log Analytics (async): *"Stream batch scoring job logs and resource utilization metrics"*

### GPT-5.2 Medium (12 connections)
Most opinionated architecture — replaces batch endpoint with API Management, adds explicit deployment step, and models the App Insights → Log Analytics export chain:
- ADF → ADLS: *"Ingest source data and land raw/curated files into the lake on a schedule"*
- AML ↔ ADLS (reverse): *"Read curated training datasets and write engineered features back to the lake"*
- AML → AML Compute: *"Provision compute and submit training runs for pipeline steps"*
- AML → AML Deployment: *"Promote the registered best model to a deployable serving artifact"*
- AML Deployment → Online Endpoint: *"Roll out a new real-time endpoint version with updated model/environment"*
- APIM ↔ Online Endpoint (reverse): *"Forward authenticated scoring requests to the online endpoint and return predictions"*
- Entra → APIM: *"Issue and validate OAuth/JWT tokens for callers accessing inference APIs"*
- KV → ADF: *"Provide secure credentials for ingestion connectors and linked services"*
- KV → AML: *"Provide secrets for data access, training configuration, and deployment settings"*
- KV ↔ APIM (reverse): *"Provide backend endpoint keys/certificates used to call the inference service"*
- Online Endpoint → App Insights (async): *"Emit request telemetry, model latency, and prediction logging signals"*
- App Insights → Log Analytics: *"Export application traces and metrics to a centralized queryable workspace"*

---

## Storage Choice: Storage Account vs Data Lake Storage

This comparison reveals a key architectural decision difference:

| Aspect | GPT-4.1 Mini / GPT-4.1 | GPT-5.2 Low / GPT-5.2 Medium |
|---|---|---|
| **Service** | Storage Account (Hot LRS) | Azure Data Lake Storage |
| **Monthly Cost** | $14.60 | $18.40 |
| **ML Suitability** | General purpose, works for simple pipelines | Purpose-built for analytics/ML with hierarchical namespace |
| **Assessment** | Functional but not optimal for ML | Correct choice for production ML workloads |

GPT-5.2 models correctly chose Data Lake Storage, which provides hierarchical file system semantics, better for organizing training data into raw/curated/features zones referenced in their connection labels.

---

## Architectural Approach Differences

### GPT-4.1 Mini — "Complete but verbose"
Models every service-to-service connection individually (each endpoint → KV, each endpoint → monitoring), resulting in 15 connections. Uses 5 groups (most of any model) by splitting ingestion from storage. Shows comprehensive coverage but creates visual complexity.

### GPT-4.1 — "Lean and clean"
The most concise at 10 connections. Consolidates Key Vault and Entra ID to single connections back to AML workspace. Uniquely models the training artifact return as a reverse connection. The only model generated in under 10 seconds.

### GPT-5.2 Low — "Production-grade ML pipeline"
The most thorough architecture with 18 connections and 11 services. Uniquely includes:
- **Container Registry** for versioned inference images
- **Data Factory → AML pipeline trigger** (orchestration integration)
- **Optional connections** (Online Endpoint → ADLS for reference data)
- **Dual logging paths** (App Insights for real-time, Log Analytics for training/batch)
- **Data lake zone references** in labels (raw/curated/features)

### GPT-5.2 Medium — "Opinionated production deployment"
Makes the strongest architectural decisions:
- **Drops Batch Endpoint** in favor of an API gateway (API Management) fronting the Online Endpoint
- **Adds AML Deployment** as an explicit intermediate step between training and serving
- **Models the observability chain** (App Insights → Log Analytics export) rather than direct connections
- Uses the most **reverse/bidirectional connections** (3), showing request-response patterns

---

## Workflow Quality Comparison

### GPT-4.1 Mini — 10 steps (granular)
Each step focuses on a single action. Steps 7-8 cover inference data retrieval, step 9 handles telemetry, step 10 covers secrets. Clear but somewhat mechanical.

### GPT-4.1 — 10 steps (balanced)
Same count as Mini but better composed — each step involves 2 services showing the relationship. Step 4 explicitly covers the bi-directional compute→artifact flow.

### GPT-5.2 Low — 10 steps (production lifecycle)
Full ML lifecycle from ingestion triggers through deployment, scoring, and monitoring. Step 5 uniquely covers container image building. Step 7 mentions traffic allocation. Step 8 explicitly separates batch from real-time paths.

### GPT-5.2 Medium — 8 steps (most concise)
Fewest steps of any model. Covers the same lifecycle in fewer steps by combining related actions. Step 5 focuses on model registration and promotion. Step 7 uniquely models the full API chain: Entra ID → APIM → Online Endpoint.

---

## Cost Comparison (East US 2)

| Service | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---:|---:|---:|---:|
| Azure Data Factory | $5.00 | $5.00 | $5.00 | $5.00 |
| Storage Account (Hot LRS) | $14.60 | $14.60 | — | — |
| Azure Data Lake Storage | — | — | $18.40 | $18.40 |
| Azure Machine Learning | $50.00 | $50.00 | $50.00 | $50.00 |
| AML Managed Compute | $200.00 | $200.00 | $200.00 | $200.00 |
| AML Online Endpoint | $0.00 | $0.00 | $0.00 | $0.00 |
| AML Batch Endpoint | $0.00 | $0.00 | $0.00 | — |
| AML Deployment | — | — | — | $0.00 |
| Container Registry (Standard) | — | — | $20.00 | — |
| API Management (Developer) | — | — | — | $50.26 |
| Key Vault (Standard) | $21.90 | $21.90 | $21.90 | $21.90 |
| Application Insights (Basic) | $0.10 | $0.10 | $0.10 | $0.10 |
| Log Analytics | — | — | $2.30 | $2.30 |
| Microsoft Entra ID | $6.00 | $6.00 | $6.00 | $6.00 |
| **Total Estimate** | **$297.60** | **$297.60** | **$323.70** | **$353.96** |

---

## Key Takeaways

### 1. All Models Delivered Strong ML Architectures
Unlike simpler prompts (Basic Web App) where mini models produced bare-minimum output, all 4 models produced robust ML pipeline architectures with 9-11 services. The ML domain prompt naturally guides even smaller models to include security, monitoring, and proper AML components.

### 2. GPT-5.2 Models Correctly Choose Data Lake Storage
Both GPT-5.2 variants chose Azure Data Lake Storage instead of generic Storage Account — the correct choice for ML workloads needing hierarchical namespace, zone-based data organization, and analytics-optimized access patterns. The $3.80/mo premium is negligible.

### 3. GPT-5.2 Low Is the Most Complete Architecture
With 11 services and 18 connections, GPT-5.2 Low delivers the most thorough ML pipeline. Its inclusion of Container Registry for versioned images and Data Factory → AML pipeline triggering demonstrates deep understanding of ML operational workflows. The optional connection for reference data shows nuanced architectural thinking.

### 4. GPT-5.2 Medium Makes Bold Architectural Decisions
Rather than simply adding more services, Medium makes opinionated choices: dropping Batch Endpoint in favor of API Management, modeling an explicit Deployment step, and showing the observability export chain. This reflects a "real-time API-first" architecture rather than the "research pipeline" approach of other models.

### 5. GPT-4.1 Delivers the Best Speed-to-Quality Ratio
At 7 seconds, GPT-4.1 produces a clean 9-service architecture with concise labels and a unique reverse connection for the training artifact return. It's the fastest model by far and covers all prompt requirements.

### 6. GPT-4.1 Mini — Verbose but Complete
Mini's 15 connections (the second-highest count across all 4 comparisons) shows it tries to model every possible service-to-service relationship individually. While comprehensive, the repetitive Key Vault and monitoring connections add visual clutter without adding architectural insight.

### 7. Connection Label Quality Scales with Reasoning

| Model | Label Style | Example |
|---|---|---|
| GPT-4.1 Mini | Descriptive | *"Load ingested raw and processed data into Storage Account"* |
| GPT-4.1 | Concise | *"Submit ML training jobs"* |
| GPT-5.2 Low | Expert-level | *"Submit distributed training job to managed compute target"* |
| GPT-5.2 Medium | Architecture-level | *"Roll out a new real-time endpoint version with updated model/environment"* |

### 8. Well-Architected Framework Coverage

| WAF Pillar | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| **Security** | ✅ (Entra + KV) | ✅ (Entra + KV) | ✅ (Entra + KV) | ✅ (Entra + KV + APIM) |
| **Reliability** | ⚠️ (basic) | ⚠️ (basic) | ✅ (dual endpoints) | ✅ (APIM gateway) |
| **Performance** | ⚠️ (basic) | ⚠️ (basic) | ✅ (optional caching) | ✅ (APIM throttling) |
| **Cost Optimization** | ✅ ($297.60) | ✅ ($297.60) | ✅ ($323.70) | ⚠️ ($353.96) |
| **Operational Excellence** | ⚠️ (App Insights only) | ⚠️ (App Insights only) | ✅ (App Insights + Log Analytics) | ✅ (full observability chain) |

### 9. Recommendation by Use Case

| Scenario | Best Model | Why |
|---|---|---|
| Quick ML pipeline sketch | GPT-4.1 (7s) | Fastest, clean, all essentials covered |
| Production ML deployment | GPT-5.2 Low (51s) | Most complete — ACR, dual endpoints, pipeline triggers |
| API-first ML service | GPT-5.2 Medium (45s) | APIM gateway, deployment pipeline, observability chain |
| Learning / documentation | GPT-4.1 Mini (22s) | Every connection explicit, easy to follow |

---

**Generated**: February 12, 2026
**Prompt Complexity**: Medium (1 sentence, 3 explicit capabilities)
**Models Tested**: GPT-4.1 Mini, GPT-4.1, GPT-5.2 Low, GPT-5.2 Medium
