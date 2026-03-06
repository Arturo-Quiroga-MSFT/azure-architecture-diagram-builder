---
title: Usage Analytics Workbook
description: Deploy and use the Azure Diagram Builder usage analytics workbook in your own subscription
author: Arturo Quiroga
ms.date: 2026-03-06
ms.topic: how-to
keywords:
  - workbook
  - telemetry
  - application insights
  - KQL
  - analytics
estimated_reading_time: 8
---

## Overview

The **Azure Diagram Builder — Usage Analytics** workbook provides a
comprehensive dashboard for monitoring how the diagram builder application is
used. It surfaces telemetry captured by the Application Insights JavaScript SDK
and presents it through interactive tiles, charts, maps, and tables.

The workbook is defined as a portable JSON file and can be deployed to any
subscription that hosts an Application Insights resource connected to the app.

## Prerequisites

* An Azure subscription with **Contributor** or **Workbook Contributor** role
* An Application Insights resource receiving telemetry from the diagram builder
* Azure CLI (`az`) installed and authenticated
* `jq` installed (for JSON processing during deployment)

## What the Workbook Tracks

The diagram builder emits 12 custom events that the workbook queries:

| Event                    | Description                                 | Key Properties                                  |
|--------------------------|---------------------------------------------|------------------------------------------------|
| `Architecture_Generated` | AI-generated architecture diagram           | model, reasoningEffort, serviceCount, tokens   |
| `Architecture_Validated` | WAF validation run                          | model, overallScore, findingCount              |
| `DeploymentGuide_Generated` | Bicep deployment guide created           | model, serviceCount, bicepFileCount            |
| `Diagram_Exported`       | Diagram exported (PNG, SVG, JSON, draw.io)  | format, serviceCount                           |
| `Template_Imported`      | IaC template imported (ARM, Bicep, Terraform) | format, fileName, resourceCount              |
| `Image_Imported`         | Architecture sketch/image uploaded          | —                                              |
| `Models_Compared`        | Multi-model comparison used                 | modelsCompared, selectedModel                  |
| `Recommendations_Applied`| WAF recommendations applied to diagram      | recommendationCount                            |
| `Version_Operation`      | Version history save/restore/auto-snapshot  | operation                                      |
| `Region_Changed`         | Azure pricing region changed                | region                                         |
| `Start_Fresh`            | Canvas reset                                | —                                              |
| `AI_Model_Usage`         | Every Azure OpenAI API call                 | model, operation, promptTokens, totalTokens    |

## Workbook Sections

### 1 — Overview

Four KPI tiles showing **Active Users**, **Unique Sessions**, **Total Events**,
and **Unique Countries** for the selected time range. Below the tiles, a line
chart shows event volume binned by hour.

### 2 — Geographic Insights

A world **map** visualization plots users by country, sized by user count and
colored by event volume. A companion table lists every country/city combination
with event counts, unique users, unique IPs, and a sample of IP addresses.

> **Note:** Client IP addresses are only captured when IP masking is disabled on
> the Application Insights resource. See [Enable IP Collection](#enable-ip-collection)
> below.

### 3 — Feature Usage

A **bar chart** of event counts by feature name, a **pie chart** showing
proportional distribution, and a detail **table** with total instances, active
users, and unique sessions per feature.

### 4 — AI Model Analytics

* **Model usage by operation** — stacked bar chart showing which models are
  called for generation, validation, deployment guides, etc.
* **Token consumption & latency** — table with total calls, avg prompt/completion
  tokens, total tokens consumed, avg response time, and P95 response time per
  model
* **Response time trends** — line chart tracking average response time per model
  over time
* **Reasoning effort distribution** — bar chart of low/medium/high reasoning
  effort selection per model

### 5 — Architecture Generation

* Complexity breakdown per model (avg services, connections, groups, workflow
  steps, tokens, and generation time)
* **New vs. Modification** pie chart
* Architecture generation area chart over time

### 6 — Validation & Well-Architected Framework

* Validation results table per model (avg/min/max score, avg findings, avg time)
* Recommendations applied summary tile

### 7 — Exports & Imports

* Export format bar chart (PNG, SVG, JSON, draw.io)
* Template import format bar chart (ARM, Bicep, Terraform)
* Azure region preferences pie chart
* Deployment guide generation table

### 8 — User Session Activity

* **Recent sessions** table showing user, session ID, event count, duration in
  minutes, features used, location, IP, and timestamps
* **Feature usage timeline** — stacked area chart of all events over time
* **Workflow events log** — last 100 events for Start_Fresh, Version_Operation,
  Image_Imported, and Models_Compared

## Deployment

### Quick Deploy

From the repository root, run:

```bash
./scripts/deploy-workbook.sh
```

The script:

1. Resolves your active subscription and the App Insights resource ID
2. Packages the workbook JSON from `scripts/workbook-content.json`
3. Deploys it via `az rest` PUT to the Azure Workbooks API
4. Prints a portal link to open the workbook

### Configuration

Edit the variables at the top of `scripts/deploy-workbook.sh` to match your
environment:

```bash
RG="AQ-FOUNDRY-RG"                                    # Resource group
APP_INSIGHTS="aq-app-insights-001"                     # App Insights resource name
WORKBOOK_DISPLAY_NAME="Azure Diagram Builder — Usage Analytics"  # Display name
```

### Manual Deploy

If you prefer the portal:

1. Open your Application Insights resource in the Azure portal
2. Navigate to **Monitoring** → **Workbooks**
3. Select **+ New**
4. Select the **Advanced Editor** (`</>` icon)
5. Paste the contents of `scripts/workbook-content.json`
6. Select **Apply** then **Done Editing**
7. Select **Save** and choose a name

### Deploy to a Different Subscription

1. Ensure the target subscription has an Application Insights resource
   receiving telemetry from the diagram builder
2. Update the `RG` and `APP_INSIGHTS` variables in the deploy script
3. Authenticate to the target subscription:

   ```bash
   az account set --subscription "<target-subscription-id>"
   ```

4. Run `./scripts/deploy-workbook.sh`

## Enable IP Collection

By default, Application Insights masks client IP addresses to `0.0.0.0`. The
Geographic Insights section works best with real IPs enabled. Disable masking
via CLI:

```bash
az resource update \
  --name <your-app-insights-name> \
  --resource-group <your-resource-group> \
  --resource-type "Microsoft.Insights/components" \
  --set properties.DisableIpMasking=true
```

Geographic fields (`client_CountryOrRegion`, `client_City`) are resolved
server-side and populate even with masking on — only the raw `client_IP` column
is affected.

## Customization

### Add a New Tile

1. Open `scripts/workbook-content.json`
2. Add an item to the `items` array following the existing pattern
3. Redeploy with `./scripts/deploy-workbook.sh` (a new workbook ID is generated
   each time; delete the old one from the portal if you want to avoid duplicates)

### Edit KQL Queries

Each tile's `query` field contains standard KQL. You can edit queries directly in
the workbook JSON or in the portal's workbook editor for quick iteration.

### Time Range

All tiles reference the `{TimeRange}` parameter at the top of the workbook. The
default is 24 hours. Available presets: 1h, 4h, 12h, 24h, 48h, 7d, 30d, 90d,
plus custom ranges.

## File Reference

| File                            | Purpose                                  |
|---------------------------------|------------------------------------------|
| `scripts/workbook-content.json` | Workbook definition (Azure Workbook JSON) |
| `scripts/deploy-workbook.sh`    | CLI deployment script                    |
| `src/services/telemetryService.ts` | Telemetry event definitions           |

## Troubleshooting

| Symptom                        | Cause                              | Fix                                                     |
|--------------------------------|------------------------------------|----------------------------------------------------------|
| All tiles show 0               | No telemetry flowing               | Verify `VITE_APPINSIGHTS_CONNECTION_STRING` is set       |
| `client_IP` shows `0.0.0.0`   | IP masking enabled                 | Run the `az resource update` command above               |
| Map shows no data              | No geo data yet                    | Wait for new events after enabling IP collection         |
| Token/latency columns empty    | `AI_Model_Usage` events not firing | Ensure `azureOpenAI.ts` calls `trackAIModelUsage()`      |
| Script fails with 403          | Insufficient permissions           | Need Contributor or Workbook Contributor on the RG       |
