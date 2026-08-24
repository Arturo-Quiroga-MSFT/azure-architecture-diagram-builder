# Authoritative Server Telemetry

The production Node proxy emits privacy-safe, server-authoritative model request telemetry to two connected Azure Monitor surfaces:

- **Application Insights:** `aadb-usage-analytics-insights` (custom model spans and outbound dependencies)
- **Log Analytics:** `workspace-azurediagramsrgbuvF`

Browser usage analytics remain in `aq-app-insights-001`. Keeping the server resource separate prevents unrelated browser/application telemetry from contaminating public-endpoint traffic measurements.

## Data Contract

Each completed upstream model request emits `openai_request_completed` to container stdout and a correlated OpenTelemetry span. Transport failures emit `openai_request_failed`.

Recorded fields:

- timestamp, severity, service, application version, and Container Apps revision
- correlation ID
- HMAC-derived rotating client key
- logical model, deployment, operation, and API format
- upstream status, success, and normalized error type
- input, output, cached, and total tokens
- duration, concurrency at request start, and process peak concurrency

Never recorded:

- prompts or request bodies
- model response content
- feedback comments
- API keys, connection strings, credentials, or access tokens
- raw IP addresses or user-agent strings; automatic incoming HTTP spans are disabled, nginx excludes IP, user-agent, referer, and query-string fields from retained access logs, and nginx error retention is limited to critical process failures

The client key is HMAC-derived from the request IP and user agent with a secret stored in Container Apps. It rotates daily and is intended for aggregate burst analysis, not user identity. Direct clients can still distribute traffic across source identities; this field is a guardrail signal rather than authenticated identity.

## Log Analytics Queries

The Container Apps environment writes console logs to `ContainerAppConsoleLogs_CL`. The structured JSON remains in `Log_s`.

### Model volume, tokens, failures, and latency

```kql
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "azure-diagram-builder-vnet"
| extend event = parse_json(Log_s)
| where tostring(event.event) in ("openai_request_completed", "openai_request_failed")
| extend
    Model = tostring(event.model),
    Operation = tostring(event.operation),
    Status = toint(event.status),
    Success = tobool(event.success),
    PromptTokens = tolong(event.promptTokens),
    CompletionTokens = tolong(event.completionTokens),
    CachedTokens = tolong(event.cachedTokens),
    TotalTokens = tolong(event.totalTokens),
    DurationMs = todouble(event.durationMs)
| summarize
    Calls = count(),
    Failures = countif(not(Success)),
    Status429 = countif(Status == 429),
    PromptTokens = sum(PromptTokens),
    CompletionTokens = sum(CompletionTokens),
    CachedTokens = sum(CachedTokens),
    TotalTokens = sum(TotalTokens),
    AvgDurationMs = round(avg(DurationMs), 0),
    P95DurationMs = round(percentile(DurationMs, 95), 0)
  by Model, Operation
| order by Calls desc
```

### Authoritative concurrency

```kql
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "azure-diagram-builder-vnet"
| extend event = parse_json(Log_s)
| where tostring(event.event) in ("openai_request_completed", "openai_request_failed")
| summarize
    PeakConcurrent = max(toint(event.peakConcurrent)),
    P95ConcurrentAtStart = percentile(toint(event.concurrentAtStart), 95)
  by bin(TimeGenerated, 5m), RevisionName_s
| order by TimeGenerated desc
```

### Privacy-safe client bursts

```kql
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "azure-diagram-builder-vnet"
| extend event = parse_json(Log_s)
| where tostring(event.event) in ("openai_request_completed", "openai_request_failed")
| extend ClientKey = tostring(event.clientKey)
| where ClientKey != "unavailable"
| summarize Calls = count(), Tokens = sum(tolong(event.totalTokens))
  by ClientKey, bin(TimeGenerated, 1m)
| summarize
    PeakCallsPerMinute = max(Calls),
    ClientMinutesOver5 = countif(Calls > 5),
    ClientMinutesOver10 = countif(Calls > 10),
    PeakTokensPerMinute = max(Tokens)
```

### Failure classification

```kql
ContainerAppConsoleLogs_CL
| where ContainerAppName_s == "azure-diagram-builder-vnet"
| extend event = parse_json(Log_s)
| where tostring(event.event) in ("openai_request_completed", "openai_request_failed")
| where tobool(event.success) == false
| summarize Failures = count(), Clients = dcount(tostring(event.clientKey))
  by ErrorType = tostring(event.errorType), Status = toint(event.status), Model = tostring(event.model)
| order by Failures desc
```

## Cost Reports

`scripts/llm-cost-report.py` joins `AI_Model_Usage` with Azure Cost Management and now includes all current model deployment variables. It reports cost per call, anonymous browser, browser session, workflow, and one million tokens.

Cost attribution remains an allocation estimate when a Foundry deployment is shared with other applications. Azure Cost Management is the billing source of truth; telemetry is the usage-allocation source.

## Production State

Production `v1.7.1` sends custom model spans to `aadb-usage-analytics-insights` and retained structured/proxy logs to `workspace-azurediagramsrgbuvF`. Incoming HTTP auto-spans are disabled. The previous `v1.7.0` revision was deactivated because its older instrumentation emitted readiness spans; `v1.6.0` remains the active-at-zero rollback target.
