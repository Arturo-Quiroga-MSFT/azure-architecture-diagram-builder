# Application Insights KQL Queries

KQL queries for analyzing telemetry from the Azure Architecture Diagram Builder app via `aq-app-insights-001`.

---

## 1. Custom Events Summary (by Event Name)

Returns all custom event types with active users, unique sessions, and total instances.

```kql
customEvents
| where timestamp > ago(24h)
| summarize
    ActiveUsers = dcount(user_Id),
    UniqueSessions = dcount(session_Id),
    TotalInstances = count()
  by name
| order by TotalInstances desc
```

> Adjust `ago(24h)` to match the desired time range (e.g., `ago(7d)`, `ago(30d)`).

---

## 2. Custom Events Summary (Grouped by App Name)

Same as above but grouped under the application name, matching the Active Users blade layout.

```kql
customEvents
| where timestamp > ago(24h)
| summarize
    ActiveUsers = dcount(user_Id),
    UniqueSessions = dcount(session_Id),
    TotalInstances = count()
  by appName, name
| order by appName, TotalInstances desc
```

---

## Event Reference

| Event Name | Description |
|---|---|
| `MetaAgent` | Meta-agent orchestration calls |
| `AgentResponse` | Individual AI agent responses |
| `Start_Fresh` | User clicked Start Fresh |
| `Architecture_Generated` | Architecture diagram generated |
| `Diagram_Exported` | Diagram exported (PNG/JSON) |
| `Version_Operation` | Version history save/restore |
| `Models_Compared` | Model comparison runs |
| `Region_Changed` | Azure region changed |
| `gen_ai.evaluation.result` | AI evaluation metrics |
| `Architecture_Validated` | WAF validation executed |
| `Recommendations_Applied` | WAF recommendations applied |
| `DeploymentGuide_Generated` | Deployment guide generated |
