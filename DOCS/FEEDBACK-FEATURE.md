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
          (full record incl. verbatim comment text, optional consented contact, and context)
```

Two stores, on purpose:

- **Application Insights** — sentiment/engagement metrics for dashboards and alerting.
  Comment **text is intentionally omitted** to keep PII out of telemetry.
- **Cosmos DB** — durable record including the verbatim comment and optional
  consented follow-up address. This is the source of truth for reading what
  users actually wrote and whether they invited contact.

## Adoption and impact measurement

The separate **Adoption & Impact** modal adds three optional paths:

- **Your context** stores categorical organization type, role, scenario, and
  deployment mode in the browser and emits `Adoption_Profile_Saved`.
- **Share an outcome** emits a categorical `Impact_Story_Submitted` summary and
  stores the optional narrative, organization/customer name, and contact email
  in Cosmos only when the corresponding consent is enabled.
- **Register deployment** generates a random browser-local installation UUID,
  emits `Deployment_Registered`, and upserts a durable
  `deployment-registration` record. The UUID is not derived from a tenant,
  subscription, resource, or user identity.

Campaign links may use `source`/`campaign` or `utm_source`/`utm_campaign`.
Only normalized categorical values are retained for the session and emitted in
`Attribution_Observed`; referral source does not prove a person's role.

Privacy boundaries:

- Application Insights receives categorical summaries only.
- Cosmos stores consented narrative/name/contact fields.
- The browser cannot mark a story or deployment as verified; the server always
  initializes verification as `self-reported`.
- Do not submit tenant IDs, subscription IDs, resource IDs, prompts, diagrams,
  tokens, or secrets.
- The private analytics app reports measured, self-reported, registered, and
  operator-verified populations separately.

## Where the data lives

| Store | Resource | Scope |
|---|---|---|
| Telemetry | App Insights `aq-app-insights-001` (`AQ-FOUNDRY-RG`) | event `User_Feedback` |
| Durable | Cosmos `aqcosmosdb007` / db `diagrams-db` / container `feedback` (`azure-diagrams-rg`) | one document per submission, partition key `/id` |

Auth is keyless end-to-end (Entra ID). The container app's system-assigned managed
identity and the developer account both hold **Cosmos DB Built-in Data Contributor**
on the account.

## Reading comments (admin endpoint — the read path)

> ⚠️ The Cosmos account has **public network access disabled** (policy-locked). It is
> reachable **only** from inside the VNet via a private endpoint. Reading directly from a
> laptop (including the `read-feedback.js` CLI below) therefore **fails** — the app itself
> is now the read path.

The web app exposes a token-protected admin endpoint that reads verbatim comments from
Cosmos server-side, over the private endpoint:

```
GET /api/feedback/list            # newest first
GET /api/feedback/list?limit=50   # cap results (default 200, max 1000)
```

Protected by the `FEEDBACK_ADMIN_TOKEN` env var (a secret on the container app; generated
into `.env` by `scripts/production/deploy-webapp.sh`). Pass it as a bearer token or
the `X-Admin-Token` header. The endpoint returns `503` when the token is unset and `401`
on mismatch.

```bash
# From the repo root (.env holds FEEDBACK_ADMIN_TOKEN)
APP="https://azure-diagram-builder-vnet.thankfulbeach-7e8f01bc.eastus2.azurecontainerapps.io"
TOKEN=$(grep '^FEEDBACK_ADMIN_TOKEN=' .env | cut -d= -f2-)
curl -s -H "Authorization: Bearer $TOKEN" "$APP/api/feedback/list?limit=20" | python3 -m json.tool
```

Implemented in [../server/token-server.js](../server/token-server.js) (`GET /api/feedback/list`),
using the same `getFeedbackContainer()` and env vars as the write path.

### Optional follow-up contact

The full feedback form includes an unchecked **You may contact me about this
feedback** option. The email field is not rendered until the user explicitly
opts in, and feedback submission never requires contact consent.

When consent is enabled, the server validates and stores this object with the
Cosmos feedback record:

```json
{
  "contact": {
    "consent": true,
    "email": "name@example.com",
    "consentAt": "2026-08-05T20:00:00.000Z",
    "expiresAt": "2027-02-01T20:00:00.000Z",
    "followUpStatus": "new"
  }
}
```

Privacy and operations:

- The email address is sent only to `POST /api/feedback` and stored only in
  Cosmos. `User_Feedback` and `Feedback_Persist_Failed` telemetry never include it.
- `GET /api/feedback/list` is the only application endpoint that returns the
  contact object, and it requires `FEEDBACK_ADMIN_TOKEN`.
- `expiresAt` marks the intended 180-day contact-retention boundary. It is
  metadata, not an automatic Cosmos TTL; an operator or cleanup job must redact
  or delete expired contact details according to the approved privacy policy.
- `followUpStatus` starts as `new`; operators can track review/contact/closure
  outside telemetry without changing the user's feedback text.
- The product analytics app deliberately projects only rating, category,
  comment, date, and model from Cosmos, so contact details are not exposed there.

### Legacy CLI (only works when Cosmos is publicly reachable)

The CLI utility [../server/read-feedback.js](../server/read-feedback.js) uses keyless auth
(`az login`) and reads the same container, but it only works from a network that can reach
Cosmos — i.e. **not** from a laptop while public access is disabled. Kept for use from
inside the VNet or if public access is ever temporarily enabled.

```bash
cd server
node read-feedback.js          # formatted, newest first
node read-feedback.js --json   # raw JSON
```

Prerequisites: `az login` to `ARTURO-MngEnvMCAP094150` (`7a28b21e-…`) with **Cosmos DB
Built-in Data Contributor** (or Data Reader) on `aqcosmosdb007`.

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

- **Deploy** is via `./scripts/production/deploy-webapp.sh` (ACR build + container app update), which
  injects `COSMOS_FEEDBACK_CONTAINER_ID` (and the other Cosmos vars) from `.env`.
  This is the production path — not `azd`/Bicep.

- If `AZURE_COSMOS_ENDPOINT` is unset, `POST /api/feedback` returns `503` and the modal
  soft-confirms; the telemetry event still fires. Telemetry can therefore show more
  events than Cosmos has documents if a write ever fails.

## Resilience: comment recovery when the Cosmos write fails

The durable comment **text** is written only to Cosmos (`/api/feedback`); the
standard `User_Feedback` telemetry event intentionally carries only rating,
category, and comment **length** — never the text.

Optional follow-up email is even more restricted: it is never copied into the
telemetry fallback. If Cosmos persistence fails, the UI tells the user that the
address could not be saved rather than sending it to Application Insights.

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

> The persisted comments themselves live in Cosmos — read them via the
> `GET /api/feedback/list` admin endpoint (see **Reading comments** above).

### Durable fix (implemented ✅)

Option 2 below was implemented on 2026-07-14: the web app runs in a
**VNet-integrated Container Apps environment** and reaches Cosmos via a
**private endpoint**, so writes succeed with public access disabled. Scripts live in
[../scripts/production/](../scripts/production/) (`01-network.sh`,
`02-aca-env.sh`, `deploy-webapp.sh`).

1. **Policy exemption** — exempt `aqcosmosdb007` from the policy that disables
   public access (not used; the MCAPS policy reverts it), or
2. **Private connectivity** ✅ — a Cosmos **Private Endpoint** + a **VNet-integrated
   Container Apps environment**. VNet integration is set at creation, so a new
   environment (`aca-env-azure-diagrams-vnet`) and app (`azure-diagram-builder-vnet`)
   were stood up blue/green alongside the originals.

## Files

| File | Purpose |
|---|---|
| [../src/components/FeedbackModal.tsx](../src/components/FeedbackModal.tsx) | Modal UI + submit logic |
| [../src/services/feedbackService.ts](../src/services/feedbackService.ts) | `submitFeedback()` — Cosmos write + telemetry fallback on failure |
| [../src/services/telemetryService.ts](../src/services/telemetryService.ts) | `trackFeedback()` + `trackFeedbackPersistFailed()` → App Insights |
| [../server/token-server.js](../server/token-server.js) | `POST /api/feedback` → Cosmos; `GET /api/feedback/list` admin read (token-protected) |
| [../server/read-feedback.js](../server/read-feedback.js) | Legacy CLI read utility (only works when Cosmos is publicly reachable) |
| [../scripts/production/](../scripts/production/) | Production deploy plus the one-time VNet + private-endpoint provisioning |
| [../infra/feedback-workbook.json](../infra/feedback-workbook.json) | Trends workbook (ARM) |
