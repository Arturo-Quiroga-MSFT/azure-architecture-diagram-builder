#!/usr/bin/env bash
# usage-report-range.sh — Pull diagram builder usage stats from Application
# Insights for an EXPLICIT date range (inclusive start, exclusive end).
#
# Usage:  ./scripts/usage-report-range.sh <START_YYYY-MM-DD> <END_YYYY-MM-DD>
# Example: ./scripts/usage-report-range.sh 2026-01-01 2026-07-15
#
# Notes:
#  * END is exclusive — pass the day AFTER the last day you want included.
#  * `az monitor app-insights query` defaults to a 1-hour API timespan, which
#    silently clips KQL time filters. We pass --offset large enough to cover the
#    whole window; the KQL `between(...)` bounds then do the real filtering.
set -euo pipefail

START="${1:-2026-01-01}"
END="${2:-$(date -u +%Y-%m-%d)}"
APP="aq-app-insights-001"
RG="AQ-FOUNDRY-RG"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/usage-reports"
mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/usage-report-${START}_to_${END}.md"

# Compute an --offset duration (days) that safely covers [START .. now].
if date -j >/dev/null 2>&1; then
  # BSD/macOS date
  START_EPOCH=$(date -j -f "%Y-%m-%d" "$START" +%s)
else
  # GNU date
  START_EPOCH=$(date -d "$START" +%s)
fi
NOW_EPOCH=$(date -u +%s)
SPAN_DAYS=$(( (NOW_EPOCH - START_EPOCH) / 86400 + 2 ))
OFFSET="${SPAN_DAYS}d"

# Diagram-builder events only (filter out Foundry agent traces that share this App Insights)
DB_EVENTS='customEvents | where name in ("Architecture_Generated","Architecture_Validated","DeploymentGuide_Generated","Diagram_Exported","Template_Imported","ARM_Template_Imported","Image_Imported","Models_Compared","Recommendations_Applied","Version_Operation","Region_Changed","Start_Fresh","AI_Model_Usage","Guided_Journey","User_Feedback")'
# KQL fragment for the window (inclusive start, exclusive end)
WIN="between (datetime(${START}) .. datetime(${END}))"

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

# Duplicate-row guard. A diagnostic setting named "ALL" on the App Insights
# component (created 2026-07-14, deleted 2026-07-27) exported allLogs to a
# second Log Analytics workspace. The component query API returns the union of
# the native workspace data AND that exported copy, so every row from
# 2026-07-14 onward comes back exactly twice. The app only ever sent one event.
# Deleting the setting stops future duplication, but the already-exported copy
# still lives in the second workspace, so historical queries stay 2x.
# Dedup on (session_Id, name, timestamp, user_Id) reproduces the workspace
# ground-truth count exactly (validated 2,032 == 2,032 over a 2-day window).
DEDUP_PREAMBLE=$'let _ce = customEvents | summarize take_any(*) by session_Id, name, timestamp, user_Id;\nlet _pv = pageViews | summarize take_any(*) by session_Id, name, timestamp, user_Id;\n'

run_kql () {
  local title="$1"; local query="$2"
  echo "▶ $title"
  echo -e "\n## $title\n" >> "$REPORT"
  local dq
  dq="${DEDUP_PREAMBLE}$(printf '%s' "$query" | sed -e 's/customEvents/_ce/g' -e 's/pageViews/_pv/g')"
  local result
  if ! result=$(az monitor app-insights query --app "$APP" -g "$RG" \
        --analytics-query "$dq" --offset "$OFFSET" 2>&1); then
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

echo "# Azure Diagram Builder — Usage Report (${START} → ${END} exclusive)" > "$REPORT"
echo "" >> "$REPORT"
echo "_Generated $(date)_ · App Insights: \`$APP\` · RG: \`$RG\` · API offset: \`$OFFSET\`" >> "$REPORT"

run_kql "Headline KPIs" "
$DB_EVENTS
| where timestamp $WIN
| summarize
    UniqueUsers     = dcount(user_Id),
    UniqueSessions  = dcount(session_Id),
    TotalEvents     = count(),
    UniqueCountries = dcount(client_CountryOrRegion),
    UniqueCities    = dcount(strcat(client_CountryOrRegion, '/', client_City)),
    FirstEvent      = min(timestamp),
    LastEvent       = max(timestamp)
"

run_kql "Audience — page views" "
pageViews
| where timestamp $WIN
| summarize Views = count(), Visitors = dcount(user_Id), Sessions = dcount(session_Id), Countries = dcount(client_CountryOrRegion)
"

run_kql "Users by country (top 40)" "
$DB_EVENTS
| where timestamp $WIN and isnotempty(client_CountryOrRegion)
| summarize Users = dcount(user_Id), Sessions = dcount(session_Id), Events = count()
    by Country = client_CountryOrRegion
| order by Users desc
| take 40
"

run_kql "Feature usage (event counts)" "
$DB_EVENTS
| where timestamp $WIN
| summarize Events = count(), Users = dcount(user_Id), Sessions = dcount(session_Id)
    by Feature = name
| order by Events desc
"

run_kql "AI model usage (calls / tokens / latency)" "
customEvents
| where timestamp $WIN and name == 'AI_Model_Usage'
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

run_kql "Architecture generation — complexity by model" "
customEvents
| where timestamp $WIN and name == 'Architecture_Generated'
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
| where timestamp $WIN and name == 'Architecture_Validated'
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
| where timestamp $WIN and name == 'Diagram_Exported'
| extend fmt = tostring(customDimensions.format),
         background = iff(isempty(tostring(customDimensions.background)), 'legacy/unknown', tostring(customDimensions.background))
| summarize Exports = count(), Users = dcount(user_Id) by fmt, background
| order by Exports desc
"

run_kql "Template import formats" "
customEvents
| where timestamp $WIN and name in ('Template_Imported','ARM_Template_Imported')
| extend fmt = tostring(customDimensions.format)
| summarize Imports = count(), Users = dcount(user_Id) by fmt
| order by Imports desc
"

run_kql "Guided journey — steps and paths" "
customEvents
| where timestamp $WIN and name == 'Guided_Journey'
| extend Action = tostring(customDimensions.action),
     Step   = tostring(customDimensions.step),
     Path   = tostring(customDimensions.path),
     Source = tostring(customDimensions.source)
| summarize Events = count(), Users = dcount(user_Id), Sessions = dcount(session_Id)
  by Step, Action, Path, Source
| order by Step asc, Events desc
"

run_kql "Monthly active users + events" "
$DB_EVENTS
| where timestamp $WIN
| summarize Users = dcount(user_Id), Sessions = dcount(session_Id), Events = count()
    by Month = format_datetime(startofmonth(timestamp), 'yyyy-MM')
| order by Month asc
"

run_kql "Feedback — summary" "
customEvents
| where timestamp $WIN and name == 'User_Feedback'
| summarize Submissions = count(),
            Users       = dcount(user_Id),
            WithComment = countif(tobool(customDimensions.hasComment) == true),
            AvgRating   = round(avg(toint(customMeasurements.rating)), 2)
"

run_kql "Feedback — by category" "
customEvents
| where timestamp $WIN and name == 'User_Feedback'
| summarize Count = count(), Users = dcount(user_Id),
            AvgRating = round(avg(toint(customMeasurements.rating)), 2)
    by Category = tostring(customDimensions.category)
| order by Count desc
"

run_kql "Feedback — rating distribution" "
customEvents
| where timestamp $WIN and name == 'User_Feedback'
| summarize Count = count() by Rating = toint(customMeasurements.rating)
| order by Rating desc
"

run_kql "Power users (top 25 by event count)" "
$DB_EVENTS
| where timestamp $WIN and isnotempty(user_Id)
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

run_kql "Region (Azure pricing) preferences" "
customEvents
| where timestamp $WIN and name == 'Region_Changed'
| extend region = tostring(customDimensions.region)
| summarize Changes = count(), Users = dcount(user_Id) by region
| order by Changes desc
| take 20
"

run_kql "Deployment guide generation" "
customEvents
| where timestamp $WIN and name == 'DeploymentGuide_Generated'
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

run_kql "Monthly growth trend (events by feature × month)" "
$DB_EVENTS
| where timestamp $WIN
| summarize Events = count()
    by Feature = name, Month = format_datetime(startofmonth(timestamp), 'yyyy-MM')
| order by Feature asc, Month asc
"

echo ""
echo "✅ Report written to: $REPORT"
