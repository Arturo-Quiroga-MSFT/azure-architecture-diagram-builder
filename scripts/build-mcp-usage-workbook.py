#!/usr/bin/env python3
"""Generate infra/mcp-usage-workbook.json (ARM template) for the MCP Usage Monitor workbook.

Queries read the MCP server's per-request usage log (event "mcp_request", see
mcp-server/src/usageLog.ts) from the ACA environment's Log Analytics workspace.
Keep this in sync with infra/mcp-usage-queries.kql.
"""
import json
from pathlib import Path

WS = "[parameters('logAnalyticsWorkspaceId')]"
BASE = (
    'let McpRequests = ContainerAppConsoleLogs_CL\n'
    '| where TimeGenerated {TimeRange}\n'
    '| where ContainerAppName_s == "azure-diagram-mcp"\n'
    '| where Log_s startswith "{" and Log_s has "\\"mcp_request\\""\n'
    '| extend r = parse_json(Log_s)\n'
    '| project TimeGenerated, Status = toint(r.status), DurationMs = toint(r.durationMs),\n'
    '    Auth = tostring(r.auth), AuthError = tostring(r.authError),\n'
    '    TenantId = tostring(r.tenantId), ObjectId = tostring(r.objectId),\n'
    '    ClientName = tostring(r.clientName), ClientVersion = tostring(r.clientVersion),\n'
    '    UserAgent = tostring(r.userAgent), RpcMethods = r.rpcMethods, Tools = r.tools,\n'
    '    ToolResults = r.toolResults, Revision = tostring(r.revision);\n'
)


def query(name, title, kql, viz="table", size=0, extra=None):
    content = {
        "version": "KqlItem/1.0",
        "query": BASE + kql,
        "size": size,
        "title": title,
        "queryType": 0,
        "resourceType": "microsoft.operationalinsights/workspaces",
        "crossComponentResources": [WS],
        "visualization": viz,
    }
    content.update(extra or {})
    return {"type": 3, "content": content, "name": name}


def md(name, text):
    return {"type": 1, "content": {"json": text}, "name": name}


tile = lambda col, label: {"columnMatch": col, "formatter": 12, "formatOptions": {"palette": "auto"}, "numberFormat": {"unit": 17, "options": {"maximumSignificantDigits": 3}}}

items = [
    md("header",
       "## 🔌 MCP Usage Monitor\n"
       "Who is using the **Azure Architecture Diagram Builder MCP server**, from which clients, which tools they call, and whether sign-in and tool calls succeed.\n\n"
       "Source: one JSON log line per request to the remote MCP endpoint (`event: mcp_request`) in the Container Apps Log Analytics workspace. "
       "Records carry the caller's **tenant ID and Entra object ID only** — no names, emails, tokens or tool arguments. "
       "To see who an object ID is, run `az ad user show --id <objectId>` in the server's tenant. Rejected requests (401/403) carry no identity; use the user agent to group them."),
    {"type": 9, "content": {"version": "KqlParameterItem/1.0", "parameters": [{
        "id": "d2b00000-0000-0000-0000-000000000001", "version": "KqlParameterItem/1.0", "name": "TimeRange",
        "label": "Time range", "type": 4, "isRequired": True, "value": {"durationMs": 604800000},
        "typeSettings": {"selectableValues": [{"durationMs": 3600000}, {"durationMs": 86400000}, {"durationMs": 604800000},
                                              {"durationMs": 2592000000}, {"durationMs": 7776000000}], "allowCustom": True}}],
        "style": "pills", "queryType": 0, "resourceType": "microsoft.operationalinsights/workspaces"}, "name": "params"},
    query("kpis", "At a glance",
          "McpRequests\n| summarize ['Requests'] = count(), ['Successful (2xx)'] = countif(Status between (200 .. 299)),\n"
          "    ['Auth rejected'] = countif(Auth == 'rejected'), ['Entra users'] = dcountif(ObjectId, Auth == 'entra' and isnotempty(ObjectId)),\n"
          "    ['Tool calls'] = countif(array_length(Tools) > 0)\n"
          "| evaluate narrow()\n| project Metric = Column, Value = toint(Value)",
          viz="tiles", size=3,
          extra={"tileSettings": {"titleContent": {"columnMatch": "Metric"},
                                  "leftContent": {"columnMatch": "Value", "formatter": 12, "formatOptions": {"palette": "auto"}},
                                  "showBorder": True, "size": "auto"}}),
    query("trend", "Requests per day by outcome",
          "McpRequests\n| extend Outcome = case(Auth == 'rejected', 'Auth rejected', Status between (200 .. 299), 'Successful', 'Other error')\n"
          "| summarize Requests = count() by bin(TimeGenerated, {TimeRange:grain}), Outcome",
          viz="barchart", extra={"chartSettings": {"seriesLabelSettings": [
              {"seriesName": "Successful", "color": "green"}, {"seriesName": "Auth rejected", "color": "redBright"},
              {"seriesName": "Other error", "color": "orange"}]}}),
    query("users", "Users (Entra sign-ins)",
          "McpRequests\n| where Auth == 'entra'\n"
          "| summarize FirstSeen = min(TimeGenerated), LastSeen = max(TimeGenerated), Requests = count(),\n"
          "    ToolCalls = countif(array_length(Tools) > 0), Clients = make_set_if(strcat(ClientName, ' ', ClientVersion), isnotempty(ClientName)),\n"
          "    UserAgents = make_set(UserAgent, 5) by TenantId, ObjectId\n| order by LastSeen desc",
          extra={"gridSettings": {"formatters": [{"columnMatch": "ToolCalls", "formatter": 4, "formatOptions": {"palette": "green"}}]}}),
    query("tools", "Tool usage and failure rate",
          "McpRequests\n| mv-expand T = ToolResults\n| where isnotempty(T)\n"
          "| summarize Calls = count(), Failures = countif(tobool(T.ok) == false), Users = dcount(ObjectId),\n"
          "    P50Ms = percentile(toint(T.durationMs), 50), P95Ms = percentile(toint(T.durationMs), 95),\n"
          "    LastError = take_anyif(tostring(T.error), tobool(T.ok) == false) by Tool = tostring(T.tool)\n"
          "| extend FailureRate = round(100.0 * Failures / Calls, 1)\n| order by Calls desc",
          extra={"gridSettings": {"formatters": [{"columnMatch": "Calls", "formatter": 4, "formatOptions": {"palette": "blue"}},
                                                 {"columnMatch": "FailureRate", "formatter": 18, "formatOptions": {"thresholdsOptions": "icons", "thresholdsGrid": [
                                                     {"operator": "==", "thresholdValue": "0", "representation": "success", "text": "{0}%"},
                                                     {"operator": "<", "thresholdValue": "10", "representation": "2", "text": "{0}%"},
                                                     {"operator": "Default", "representation": "4", "text": "{0}%"}]}}]}}),
    query("authfail", "Sign-in / auth failures by reason",
          "McpRequests\n| where Auth == 'rejected'\n"
          "| summarize Count = count(), FirstSeen = min(TimeGenerated), LastSeen = max(TimeGenerated) by AuthError, UserAgent, Status\n"
          "| order by Count desc"),
    query("clients", "MCP clients in use (from initialize)",
          "McpRequests\n| where RpcMethods has 'initialize'\n"
          "| summarize Sessions = count(), Users = dcount(ObjectId) by ClientName, ClientVersion, Auth\n| order by Sessions desc",
          viz="table"),
    query("errors", "Recent tool errors",
          "McpRequests\n| mv-expand T = ToolResults\n| where tobool(T.ok) == false\n"
          "| project TimeGenerated, Tool = tostring(T.tool), Error = tostring(T.error), DurationMs = toint(T.durationMs), Auth, TenantId, ObjectId, ClientName\n"
          "| order by TimeGenerated desc\n| take 50",
          extra={"noDataMessage": "No tool errors in this time range 🎉"}),
]

template = {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "metadata": {"description": "Azure Architecture Diagram Builder — MCP Usage Monitor workbook. Reads the MCP server's per-request usage log (event 'mcp_request') from the Container Apps Log Analytics workspace. Generated by scripts/build-mcp-usage-workbook.py."},
    "parameters": {
        "appInsightsResourceId": {"type": "string", "metadata": {"description": "Application Insights component whose workbook gallery hosts this workbook (same as the LLM Cost Monitor)."}},
        "logAnalyticsWorkspaceId": {"type": "string", "metadata": {"description": "Full resource ID of the Log Analytics workspace that receives the Container Apps console logs."}},
        "workbookDisplayName": {"type": "string", "defaultValue": "MCP Usage Monitor"},
        "location": {"type": "string", "defaultValue": "[resourceGroup().location]"},
        "workbookId": {"type": "string", "defaultValue": "[guid(resourceGroup().id, 'azure-diagram-mcp-usage-monitor')]",
                       "metadata": {"description": "Stable GUID so re-deploys update the same workbook."}},
    },
    "variables": {"workbookContent": {"version": "Notebook/1.0", "items": items, "isLocked": False,
                                      "fallbackResourceIds": ["[parameters('appInsightsResourceId')]"]}},
    "resources": [{
        "type": "microsoft.insights/workbooks", "apiVersion": "2023-06-01", "name": "[parameters('workbookId')]",
        "location": "[parameters('location')]", "kind": "shared",
        "properties": {"displayName": "[parameters('workbookDisplayName')]", "serializedData": "[string(variables('workbookContent'))]",
                       "version": "1.0", "sourceId": "[parameters('appInsightsResourceId')]", "category": "workbook"},
    }],
    "outputs": {"workbookId": {"type": "string", "value": "[resourceId('microsoft.insights/workbooks', parameters('workbookId'))]"}},
}

out = Path(__file__).resolve().parent.parent / "infra" / "mcp-usage-workbook.json"
out.write_text(json.dumps(template, indent=2, ensure_ascii=False) + "\n")
print(f"wrote {out}")
