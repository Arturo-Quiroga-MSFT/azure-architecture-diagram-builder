
import { AADB_EVENTS } from './events.js';

export type QueryName =
  | 'overviewMetrics' | 'activityTrend' | 'featureUsage' | 'journeyFunnel'
  | 'modelEfficiency' | 'validationFindings' | 'reliability' | 'retention'
  | 'releaseImpact' | 'cityUsage' | 'validationHandoff';

const eventList = AADB_EVENTS.map((name) => `"${name}"`).join(', ');
const base = `AppEvents | where Name in (${eventList})`;

export const queries: Record<QueryName, string> = {
  overviewMetrics: `${base}
| summarize ActiveUsers=dcount(UserId), Sessions=dcount(SessionId), Events=count(), Countries=dcount(ClientCountryOrRegion)`,
  activityTrend: `${base}
| summarize Events=count(), Users=dcount(UserId) by Bucket=bin(TimeGenerated, 1d)
| order by Bucket asc`,
  featureUsage: `${base}
| summarize Count=count(), Users=dcount(UserId) by Name
| top 12 by Count desc`,
  journeyFunnel: `${base}
| where Name in ("Architecture_Generated", "Architecture_Validated", "Recommendations_Applied", "Diagram_Exported", "DeploymentGuide_Generated")
| summarize Sessions=dcount(SessionId) by Name
| order by Sessions desc`,
  validationHandoff: `${base}
| where Name == "Validation_Handoff"
| extend Action=tolower(tostring(Properties.action))
| summarize Count=count() by Action
| project Action, Count`,
  modelEfficiency: `${base}
| where Name == "AI_Model_Usage"
| extend Model=tolower(tostring(Properties.model)), Tokens=todouble(Measurements.totalTokens), Latency=todouble(Measurements.elapsedTimeMs)
| summarize Calls=count(), TotalTokens=sum(Tokens), AvgLatency=avg(Latency), P95Latency=percentile(Latency, 95) by Model
| order by Calls desc`,
  validationFindings: `${base}
| where Name == "Validation_Findings"
| extend Topics=parse_json(tostring(Properties.topics))
| mv-expand Topic=Topics
| extend FindingId=tostring(Topic.id), Label=tostring(Topic.label), Pillar=tostring(Topic.pillar), Severity=tostring(Topic.severity)
| summarize Occurrences=count() by FindingId, Label, Pillar, Severity
| top 20 by Occurrences desc`,
  reliability: `union
  (AppExceptions
    | summarize Count=count()
    | extend Signal="Frontend exceptions", FailureRate=100.0, P95Duration=0.0),
  (AppDependencies
    | summarize Count=count(), Failures=countif(Success == false), P95Duration=percentile(DurationMs, 95)
    | extend Signal="Failed dependencies", FailureRate=round(100.0 * Failures / iff(Count == 0, 1, Count), 2)),
  (AppRequests
    | summarize Count=countif(DurationMs > 5000), Total=count(), P95Duration=percentile(DurationMs, 95)
    | extend Signal="Slow requests", FailureRate=round(100.0 * Count / iff(Total == 0, 1, Total), 2))
| project Signal, Count, FailureRate, P95Duration`,
  retention: `${base}
| where isnotempty(UserId)
| summarize FirstSeen=startofweek(min(TimeGenerated)) by UserId
| join kind=inner (${base} | where isnotempty(UserId) | project UserId, ActivityWeek=startofweek(TimeGenerated)) on UserId
| extend WeekOffset=datetime_diff('week', ActivityWeek, FirstSeen)
| where WeekOffset between (0 .. 8)
| summarize ActiveUsers=dcount(UserId) by Cohort=FirstSeen, WeekOffset
| join kind=inner (union (${base} | where isnotempty(UserId) | summarize CohortSize=dcount(UserId) by Cohort=startofweek(TimeGenerated))) on Cohort
| extend Retention=round(100.0 * ActiveUsers / CohortSize, 1)
| project Cohort, WeekOffset, Retention`,
  releaseImpact: `${base}
| extend Version=tostring(Properties.appVersion)
| where isnotempty(Version)
| summarize Users=dcount(UserId), Events=count(), Sessions=dcount(SessionId), Exports=countif(Name == "Diagram_Exported"), Validations=countif(Name == "Architecture_Validated") by Version
| extend ExportsPerSession=round(1.0 * Exports / Sessions, 2), ValidationAdoption=round(100.0 * Validations / Sessions, 1)
| top 10 by Events desc`,
  cityUsage: `${base}
| where isnotempty(ClientCity)
| extend City=tostring(ClientCity), Country=tostring(ClientCountryOrRegion)
| summarize Users=dcount(UserId), Sessions=dcount(SessionId), Events=count() by City, Country
| top 30 by Users desc
| project City, Country, Users, Sessions, Events`,
};