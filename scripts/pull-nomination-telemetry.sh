#!/usr/bin/env bash
# Temporary: pull 120-day telemetry for the award nomination.
set -euo pipefail
APP="aq-app-insights-001"
RG="AQ-FOUNDRY-RG"
OFF="120d"
q() {
  echo ""
  echo "===== $1 ====="
  az monitor app-insights query --app "$APP" -g "$RG" --offset "$OFF" \
    --analytics-query "$2" --query 'tables[0].rows' -o tsv 2>&1
}

DB='let DB_EVENTS = customEvents | where name in ("Architecture_Generated","Architecture_Validated","DeploymentGuide_Generated","Diagram_Exported","Template_Imported","ARM_Template_Imported","Image_Imported","Models_Compared","Recommendations_Applied","Version_Operation","Region_Changed","Start_Fresh","AI_Model_Usage");'

q "ADOPTION: users / sessions / events / countries" \
  "${DB} DB_EVENTS | summarize ActiveUsers=dcount(user_Id), Sessions=dcount(session_Id), TotalEvents=count(), Countries=dcount(client_CountryOrRegion)"

q "COUNTRIES (by users)" \
  "${DB} DB_EVENTS | summarize Users=dcount(user_Id), Events=count() by client_CountryOrRegion | order by Users desc"

q "TOP CITIES (by events)" \
  "${DB} DB_EVENTS | summarize Events=count(), Users=dcount(user_Id) by client_City, client_CountryOrRegion | order by Events desc | take 12"

q "EVENT COUNTS by name" \
  "customEvents | summarize Count=count() by name | order by Count desc"

q "AI MODEL CALLS total + tokens" \
  "customEvents | where name == 'AI_Model_Usage' | extend tot=toint(customDimensions.totalTokens) | summarize Calls=count(), TotalTokens=sum(tot)"

q "AI MODEL CALLS by model (calls, avg latency, avg tokens)" \
  "customEvents | where name == 'AI_Model_Usage' | extend model=tostring(customDimensions.model), tot=toint(customDimensions.totalTokens) | join kind=leftouter (customMetrics | where name=='AI_Model_Latency') on \$left.session_Id == \$right.session_Id | summarize Calls=count(), AvgTokens=avg(tot) by model | order by Calls desc"

q "AI latency via duration on AI_Model_Usage (if present)" \
  "customEvents | where name == 'AI_Model_Usage' | extend model=tostring(customDimensions.model), dur=todouble(customDimensions.elapsedTimeMs) | summarize Calls=count(), AvgLatencySec=round(avg(dur)/1000,1), AvgTokens=round(avg(toint(customDimensions.totalTokens))) by model | order by Calls desc"

q "WAF validations + avg score by model" \
  "customEvents | where name == 'Architecture_Validated' | extend model=tostring(customDimensions.model), score=todouble(customDimensions.overallScore) | summarize Validations=count(), AvgScore=round(avg(score),1), MaxScore=max(score) by model | order by Validations desc"

q "WAF validations total" \
  "customEvents | where name == 'Architecture_Validated' | summarize Validations=count(), AvgScore=round(avg(todouble(customDimensions.overallScore)),1)"

q "Recommendations applied" \
  "customEvents | where name == 'Recommendations_Applied' | extend rc=toint(customDimensions.recommendationCount) | summarize Applies=count(), TotalRecs=sum(rc)"

q "Architectures generated" \
  "customEvents | where name == 'Architecture_Generated' | summarize Count=count()"

q "Deployment guides generated" \
  "customEvents | where name == 'DeploymentGuide_Generated' | summarize Count=count()"

q "Diagram exports by format" \
  "customEvents | where name == 'Diagram_Exported' | extend fmt=tostring(customDimensions.format) | summarize Count=count() by fmt | order by Count desc"

q "Diagram exports total" \
  "customEvents | where name == 'Diagram_Exported' | summarize Count=count()"

q "IaC template imports by format" \
  "customEvents | where name in ('Template_Imported','ARM_Template_Imported') | extend fmt=tostring(customDimensions.format) | summarize Count=count() by fmt | order by Count desc"

q "Models compared" \
  "customEvents | where name == 'Models_Compared' | summarize Count=count()"

q "Region selections" \
  "customEvents | where name == 'Region_Changed' | extend region=tostring(customDimensions.region) | summarize Count=count() by region | order by Count desc | take 10"

q "Distinct models used (AI_Model_Usage)" \
  "customEvents | where name == 'AI_Model_Usage' | extend model=tostring(customDimensions.model) | summarize Calls=count() by model | order by Calls desc"
