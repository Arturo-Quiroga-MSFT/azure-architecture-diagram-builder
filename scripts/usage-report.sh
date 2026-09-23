#!/usr/bin/env bash
# usage-report.sh — Pull diagram builder usage stats from Application Insights
# Usage: ./scripts/usage-report.sh [days]
set -euo pipefail

DAYS="${1:-120}"
APP="aq-app-insights-001"
RG="AQ-FOUNDRY-RG"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/Azure_cost_breakdowns/usage-reports"
mkdir -p "$OUT_DIR"
TS=$(date +%Y%m%d-%H%M%S)
REPORT="$OUT_DIR/usage-report-${DAYS}d-${TS}.md"

json_to_md_table () {
  jq -r '
    .tables[0] as $t
    | ($t.columns | map(.name)) as $cols
    | ([$cols | join(" | ")],
       [($cols | map("---") | join(" | "))],
       ($t.rows | map([.[] | tostring] | join(" | "))))
    | flatten
    | map("| " + . + " |")
    | .[]
  '
}

run_kql () {
  local title="$1"; local query="$2"
  echo "▶ $title"
  echo -e "\n## $title\n" >> "$REPORT"
  local result
  if ! result=$(az monitor app-insights query --app "$APP" -g "$RG" \
        --analytics-query "$query" --offset "${DAYS}d" 2>&1); then
    echo "_query failed_" >> "$REPORT"
    echo '```' >> "$REPORT"; echo "$result" >> "$REPORT"; echo '```' >> "$REPORT"
    return
  fi
  local rows
  rows=$(echo "$result" | jq '.tables[0].rows | length' 2>/dev/null || echo 0)
  if [ "$rows" = "0" ] || [ -z "$rows" ]; then
    echo "_no data_" >> "$REPORT"
    return
  fi
  echo "$result" | json_to_md_table >> "$REPORT"
}

echo "# Azure Diagram Builder — Usage Report (last ${DAYS} days)" > "$REPORT"
echo "" >> "$REPORT"
echo "_Generated $(date)_ · App Insights: \`$APP\` · RG: \`$RG\`" >> "$REPORT"

# Diagram-builder events only (filter out Foundry agent traces that share this App Insights)
DB_EVENTS='customEvents | where name in ("Architecture_Generated","Architecture_Validated","DeploymentGuide_Generated","Diagram_Exported","Template_Imported","ARM_Template_Imported","Image_Imported","Models_Compared","Recommendations_Applied","Version_Operation","Region_Changed","Start_Fresh","AI_Model_Usage","Guided_Journey")'

run_kql "Headline KPIs (diagram builder events only)" "
$DB_EVENTS
| where timestamp > ago(${DAYS}d)
| summarize
    UniqueUsers     = dcount(user_Id),
    UniqueSessions  = dcount(session_Id),
    TotalEvents     = count(),
    UniqueCountries = dcount(client_CountryOrRegion),
    UniqueCities    = dcount(strcat(client_CountryOrRegion, '/', client_City)),
    FirstEvent      = min(timestamp),
    LastEvent       = max(timestamp)
"

run_kql "Users by country (top 40)" "
$DB_EVENTS
| where timestamp > ago(${DAYS}d) and isnotempty(client_CountryOrRegion)
| summarize Users = dcount(user_Id), Sessions = dcount(session_Id), Events = count()
    by Country = client_CountryOrRegion
| order by Users desc
| take 40
"

run_kql "Feature usage (event counts)" "
$DB_EVENTS
| where timestamp > ago(${DAYS}d)
| summarize Events = count(), Users = dcount(user_Id), Sessions = dcount(session_Id)
    by Feature = name
| order by Events desc
"

run_kql "AI model usage (calls / tokens / latency)" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'AI_Model_Usage'
| extend model      = tostring(customDimensions.model),
         promptTok  = toint(customMeasurements.promptTokens),
         compTok    = toint(customMeasurements.completionTokens),
         totalTok   = toint(customMeasurements.totalTokens),
         elapsedMs  = toint(customMeasurements.elapsedTimeMs)
| summarize Calls        = count(),
            Users        = dcount(user_Id),
            AvgPromptTok = toint(avg(promptTok)),
            AvgComplTok  = toint(avg(compTok)),
            TotalTokens  = sum(totalTok),
            AvgLatencyMs = toint(avg(elapsedMs)),
            P95LatencyMs = toint(percentile(elapsedMs, 95))
    by model
| order by Calls desc
"

run_kql "Model × operation matrix" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'AI_Model_Usage'
| extend model = tostring(customDimensions.model),
         operation = tostring(customDimensions.operation)
| summarize Calls = count() by model, operation
| order by Calls desc
"

run_kql "Architecture generation — complexity by model" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'Architecture_Generated'
| extend model        = tolower(tostring(customDimensions.model)),
         services     = toint(customMeasurements.serviceCount),
         connections  = toint(customMeasurements.connectionCount),
         tokens       = toint(customMeasurements.totalTokens),
         elapsedMs    = toint(customMeasurements.elapsedTimeMs)
| summarize Diagrams       = count(),
            Users          = dcount(user_Id),
            AvgServices    = toint(avg(services)),
            AvgConnections = toint(avg(connections)),
            MaxServices    = max(services),
            AvgTokens      = toint(avg(tokens)),
            AvgGenMs       = toint(avg(elapsedMs))
    by model
| order by Diagrams desc
"

run_kql "WAF validation scores by model" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'Architecture_Validated'
| extend model    = tolower(tostring(customDimensions.model)),
         score    = todouble(customMeasurements.overallScore),
         findings = toint(customMeasurements.findingCount),
         elapsed  = toint(customMeasurements.elapsedTimeMs)
| summarize Validations = count(),
            AvgScore    = round(avg(score), 2),
            MinScore    = min(score),
            MaxScore    = max(score),
            AvgFindings = toint(avg(findings)),
            AvgMs       = toint(avg(elapsed))
    by model
| order by Validations desc
"

run_kql "Export formats" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'Diagram_Exported'
| extend fmt = tostring(customDimensions.format)
| summarize Exports = count(), Users = dcount(user_Id) by fmt
| order by Exports desc
"

run_kql "Template import formats" "
customEvents
| where timestamp > ago(${DAYS}d) and name in ('Template_Imported','ARM_Template_Imported')
| extend fmt = tostring(customDimensions.format)
| summarize Imports = count(), Users = dcount(user_Id) by fmt
| order by Imports desc
"

run_kql "Monthly active users + events" "
$DB_EVENTS
| where timestamp > ago(${DAYS}d)
| summarize Users = dcount(user_Id), Sessions = dcount(session_Id), Events = count()
    by Month = format_datetime(startofmonth(timestamp), 'yyyy-MM')
| order by Month asc
"

run_kql "Power users (top 25 by event count)" "
$DB_EVENTS
| where timestamp > ago(${DAYS}d) and isnotempty(user_Id)
| summarize Events    = count(),
            Sessions  = dcount(session_Id),
            Features  = dcount(name),
            Country   = any(client_CountryOrRegion),
            City      = any(client_City),
            FirstSeen = min(timestamp),
            LastSeen  = max(timestamp)
    by user_Id
| order by Events desc
| take 25
"

run_kql "Reasoning effort distribution by model" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'AI_Model_Usage'
| extend model     = tolower(tostring(customDimensions.model)),
         reasoning = tostring(customDimensions.reasoningEffort)
| where isnotempty(reasoning) and reasoning != 'none'
| summarize Calls = count() by model, reasoning
| order by model asc, Calls desc
"

run_kql "Daily activity (last 30 days)" "
$DB_EVENTS
| where timestamp > ago(30d)
| summarize Users = dcount(user_Id), Events = count() by Day = format_datetime(startofday(timestamp), 'yyyy-MM-dd')
| order by Day asc
"

run_kql "Region (Azure pricing) preferences" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'Region_Changed'
| extend region = tostring(customDimensions.region)
| summarize Changes = count(), Users = dcount(user_Id) by region
| order by Changes desc
| take 20
"

run_kql "Deployment guide generation" "
customEvents
| where timestamp > ago(${DAYS}d) and name == 'DeploymentGuide_Generated'
| extend model     = tolower(tostring(customDimensions.model)),
         services  = toint(customMeasurements.serviceCount),
         bicep     = toint(customMeasurements.bicepFileCount),
         elapsed   = toint(customMeasurements.elapsedTimeMs)
| summarize Guides = count(),
            Users  = dcount(user_Id),
            AvgServices = toint(avg(services)),
            AvgBicepFiles = toint(avg(bicep)),
            AvgElapsedMs  = toint(avg(elapsed))
    by model
| order by Guides desc
"

echo ""
echo "✅ Report written to: $REPORT"
