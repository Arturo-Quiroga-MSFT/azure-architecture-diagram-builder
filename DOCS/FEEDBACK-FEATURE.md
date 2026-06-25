# User Feedback Feature

In-app feedback capture for the Azure Architecture Diagram Builder. Users rate their
experience (1–5), pick a category, and optionally leave a comment via the floating
**💬 Feedback** button. Sentiment flows to Application Insights for trend analysis;
verbatim comments are stored durably in Cosmos DB.

## Architecture

```
FeedbackModal (src/components/FeedbackModal.tsx)
   │  on submit
   ├─► trackFeedback()  ──► Application Insights  event: User_Feedback
   │      (rating, category, hasComment, commentLength — NO comment text)
   │
   └─► POST /api/feedback ──► token server ──► Cosmos DB (feedback container)
          (full record incl. verbatim comment text + context)
```

Two stores, on purpose:

- **Application Insights** — sentiment/engagement metrics for dashboards and alerting.
  Comment **text is intentionally omitted** to keep PII out of telemetry.
- **Cosmos DB** — durable record including the verbatim comment. This is the
  source of truth for reading what users actually wrote.

## Where the data lives

| Store | Resource | Scope |
|---|---|---|
| Telemetry | App Insights `aq-app-insights-001` (`AQ-FOUNDRY-RG`) | event `User_Feedback` |
| Durable | Cosmos `aqcosmosdb007` / db `diagrams-db` / container `feedback` (`azure-diagrams-rg`) | one document per submission, partition key `/id` |

Auth is keyless end-to-end (Entra ID). The container app's system-assigned managed
identity and the developer account both hold **Cosmos DB Built-in Data Contributor**
on the account.

## Reading comments (CLI — the read path)

Comments are read with the CLI utility [../server/read-feedback.js](../server/read-feedback.js).
It uses keyless auth (`az login` locally), so no keys or connection strings are needed.

```bash
cd server
node read-feedback.js          # formatted, newest first
node read-feedback.js --json   # raw JSON
```

Prerequisites:

- `az login` to the subscription `ARTURO-MngEnvMCAP094150` (`7a28b21e-…`).
- The signed-in identity needs **Cosmos DB Built-in Data Contributor** (or Data
  Reader) on `aqcosmosdb007` — already granted for the admin account.

The script reads endpoint/database/container from the same environment variables the
server uses (`AZURE_COSMOS_ENDPOINT`, `COSMOS_DATABASE_ID`, `COSMOS_FEEDBACK_CONTAINER_ID`),
falling back to the production values if unset.

## Trends (workbook)

For at-a-glance trends (no comment text), open the Application Insights workbook:

**App Insights `aq-app-insights-001` → Monitoring → Workbooks → "User Feedback Trends"**

It is defined as code in [../infra/feedback-workbook.json](../infra/feedback-workbook.json)
(idempotent ARM template — re-deploying updates the same workbook). Tiles: KPIs,
average rating over time, rating distribution, feedback by category, comment
engagement, a recent-feedback grid, and a **Geography** section (feedback by
location, external users by country, and a world map of sessions).

> Geo note: App Insights auto-captures `client_CountryOrRegion` / `client_City`.
> The "overall reach" tiles exclude the `Boydton` (Azure East US) cluster and
> masked `0.0.0.0` IPs to filter out internal/test traffic — including the author's
> own sessions, which route through Microsoft's network (Global Secure Access) and
> therefore appear as Azure IPs rather than their real location. Raw IPs are treated
> as PII and not surfaced; only country/city aggregates are shown.

Re-deploy:

```bash
AI_ID="/subscriptions/7a28b21e-0d3e-4435-a686-d92889d4ee96/resourceGroups/AQ-FOUNDRY-RG/providers/microsoft.insights/components/aq-app-insights-001"
az deployment group create \
  --resource-group AQ-FOUNDRY-RG \
  --template-file infra/feedback-workbook.json \
  --parameters appInsightsResourceId="$AI_ID"
```

## Operational notes

- **Cosmos public network access** must be `Enabled` for the container app to reach
  Cosmos (the app egresses over public internet from the Consumption ACA env). It was
  enabled with:

  ```bash
  az cosmosdb update -n aqcosmosdb007 -g azure-diagrams-rg --public-network-access ENABLED
  ```

  This is async (~3 min, holds an exclusive lock; a benign `enable_pbe` SDK warning is
  expected). Auth stays enforced — keys are disabled (`disableLocalAuth=true`), so only
  Entra-authenticated callers can read/write. The only governance policy on the account
  (`CosmosDB_LocalAuth_Modify`) enforces keyless auth and does **not** revert network
  access, so no policy exemption is required.

  > Security note: public network access is the dev/test-grade path. The hardened
  > option is a private endpoint + VNet-integrated Container Apps environment.

- **Deploy** is via `./scripts/update_aca.sh` (ACR build + container app update), which
  injects `COSMOS_FEEDBACK_CONTAINER_ID` (and the other Cosmos vars) from `.env`.
  This is the production path — not `azd`/Bicep.

- If `AZURE_COSMOS_ENDPOINT` is unset, `POST /api/feedback` returns `503` and the modal
  soft-confirms; the telemetry event still fires. Telemetry can therefore show more
  events than Cosmos has documents if a write ever fails.

## Resilience: comment recovery when the Cosmos write fails

The durable comment **text** is written only to Cosmos (`/api/feedback`); the
standard `User_Feedback` telemetry event intentionally carries only rating,
category, and comment **length** — never the text.

This created a silent data-loss risk: if Cosmos is unreachable (most commonly
when a **nightly network policy disables the account's public access**), the
write fails, the client swallows the error, and the workbook still lights up from
telemetry — so the comment text is lost without any signal. This happened June
18–24, 2026 (incl. a 278-char comment that could not be recovered).

**Fix (shipped):** when the `/api/feedback` write does not succeed (any non-2xx,
or a network error), the client fires a **distinct** `Feedback_Persist_Failed`
event that **includes the full comment text** (capped at 2000 chars) plus a
`reason` tag (`http_500`, `http_503`, `network_error`). The comment is therefore
recoverable from App Insights even when Cosmos never received it. See
[../src/services/feedbackService.ts](../src/services/feedbackService.ts) and
`trackFeedbackPersistFailed()` in
[../src/services/telemetryService.ts](../src/services/telemetryService.ts).

### KQL — recover comments that failed to persist

Run in App Insights → **Logs** (adjust the time range as needed):

```kql
customEvents
| where name == 'Feedback_Persist_Failed'
| where timestamp > ago(30d)
| project timestamp,
          rating       = toint(customDimensions.rating),
          category     = tostring(customDimensions.category),
          comment      = tostring(customDimensions.comment),
          reason       = tostring(customDimensions.reason),
          diagramName  = tostring(customDimensions.diagramName),
          model        = tostring(customDimensions.model)
| order by timestamp desc
```

### KQL — all comment activity (persisted + failed), unified

`User_Feedback` (length only, persisted to Cosmos) and `Feedback_Persist_Failed`
(full text, not in Cosmos) combined:

```kql
union
  (customEvents | where name == 'User_Feedback'
     | extend persisted = true, comment = ''),
  (customEvents | where name == 'Feedback_Persist_Failed'
     | extend persisted = false, comment = tostring(customDimensions.comment))
| where timestamp > ago(30d)
| where tobool(customDimensions.hasComment) == true or persisted == false
| project timestamp, persisted,
          rating   = toint(customDimensions.rating),
          category = tostring(customDimensions.category),
          comment, reason = tostring(customDimensions.reason)
| order by timestamp desc
```

> The persisted comments themselves live in Cosmos — read them with
> `cd server && node read-feedback.js` (newest first) or `--json`.

### Durable fixes (still open)

The telemetry fallback prevents data loss but does not keep Cosmos reachable. To
make writes always succeed during the nightly lockout, either:

1. **Policy exemption** — exempt `aqcosmosdb007` from the policy that disables
   public access (fastest; acceptable for a single-owner dev/demo account), or
2. **Private connectivity** — a Cosmos **Private Endpoint** + a **VNet-integrated
   Container Apps environment** (enterprise-correct; requires recreating the
   environment, since VNet integration is set at creation time).

## Files

| File | Purpose |
|---|---|
| [../src/components/FeedbackModal.tsx](../src/components/FeedbackModal.tsx) | Modal UI + submit logic |
| [../src/services/feedbackService.ts](../src/services/feedbackService.ts) | `submitFeedback()` — Cosmos write + telemetry fallback on failure |
| [../src/services/telemetryService.ts](../src/services/telemetryService.ts) | `trackFeedback()` + `trackFeedbackPersistFailed()` → App Insights |
| [../server/token-server.js](../server/token-server.js) | `POST /api/feedback` → Cosmos |
| [../server/read-feedback.js](../server/read-feedback.js) | CLI read utility (comments) |
| [../infra/feedback-workbook.json](../infra/feedback-workbook.json) | Trends workbook (ARM) |
