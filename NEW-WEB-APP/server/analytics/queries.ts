
import { AADB_EVENTS } from './events.js';

export type QueryName =
  | 'overviewMetrics' | 'activityTrend' | 'featureUsage' | 'journeyFunnel'
  | 'modelEfficiency' | 'validationFindings' | 'reliability' | 'retention'
  | 'releaseImpact' | 'cityUsage' | 'validationHandoff' | 'guidedJourney' | 'impactSummary';

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
  guidedJourney: `let JourneyEvents = AppEvents
| where Name == "Guided_Journey";
union
(JourneyEvents
 | summarize Events=count(), Users=dcount(UserId), Sessions=dcount(SessionId)
 | extend RowType="summary", Action="", Step="", Path="", Source="", HasDiagram=false),
(JourneyEvents
| extend Action=tolower(tostring(Properties.action)), Step=tolower(tostring(Properties.step)), Path=tolower(tostring(Properties.path)), Source=tolower(tostring(Properties.source)), HasDiagram=tolower(tostring(Properties.hasDiagram)) == "true"
| summarize Events=count(), Users=dcount(UserId), Sessions=dcount(SessionId) by Action, Step, Path, Source, HasDiagram
 | top 30 by Events desc
 | extend RowType="choice")
| project RowType, Action, Step, Path, Source, HasDiagram, Events, Users, Sessions
| order by RowType desc, Events desc`,
  modelEfficiency: `let NormalizeModel = (value:string) { replace_regex(tolower(trim(" ", value)), @"\\s+", "-") };
union
(AppEvents
 | where Name == "AI_Model_Usage"
 | extend Model=NormalizeModel(tostring(Properties.model)), Tokens=todouble(Measurements.totalTokens), Latency=todouble(Measurements.elapsedTimeMs)
 | summarize Calls=count(), TotalTokens=sum(Tokens), AvgLatency=avg(Latency), P95Latency=percentile(Latency, 95) by Model
 | extend ValidationCalls=long(0), AverageScore=real(null), CritiqueWins=long(0)),
(AppEvents
 | where Name == "Architecture_Validated"
 | extend Model=NormalizeModel(tostring(Properties.model)), Score=todouble(Measurements.overallScore)
 | summarize ValidationCalls=count(), AverageScore=round(avg(Score), 1) by Model
 | extend Calls=long(0), TotalTokens=real(0), AvgLatency=real(0), P95Latency=real(0), CritiqueWins=long(0)),
(AppEvents
 | where Name == "Validation_Critique_Ranked"
 | extend Model=NormalizeModel(tostring(Properties.winnerModel))
 | summarize CritiqueWins=count() by Model
 | extend Calls=long(0), TotalTokens=real(0), AvgLatency=real(0), P95Latency=real(0), ValidationCalls=long(0), AverageScore=real(null))
| summarize Calls=sum(Calls), TotalTokens=sum(TotalTokens), AvgLatency=max(AvgLatency), P95Latency=max(P95Latency), ValidationCalls=sum(ValidationCalls), AverageScore=max(AverageScore), CritiqueWins=sum(CritiqueWins) by Model
| where Calls > 0
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
| project Version, Users, Events, ExportsPerSession, ValidationAdoption
| top 10 by Events desc`,
  cityUsage: `${base}
| where isnotempty(ClientCity)
| extend City=tostring(ClientCity), Country=tostring(ClientCountryOrRegion)
| summarize Users=dcount(UserId), Sessions=dcount(SessionId), Events=count() by City, Country
| top 30 by Users desc
| project City, Country, Users, Sessions, Events`,
  impactSummary: `let ProductEvents = AppEvents
| where Name in (${eventList});
union
(ProductEvents
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId)
 | extend RowType="measured", Label="Reach", Detail="Anonymous product activity"),
(ProductEvents
 | where Name in ("Architecture_Generated", "Template_Imported", "Image_Imported")
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId)
 | extend RowType="measured", Label="Create or import", Detail="Generated or imported architecture"),
(ProductEvents
 | where Name == "Architecture_Validated"
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId)
 | extend RowType="measured", Label="Validate", Detail="Architecture validation"),
(ProductEvents
 | where Name in ("Diagram_Exported", "DeploymentGuide_Generated")
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId)
 | extend RowType="measured", Label="Produce artifact", Detail="Export or deployment guidance"),
(ProductEvents
 | where Name == "Adoption_Profile_Saved"
 | extend Label=tolower(tostring(Properties.organizationType)), Detail=strcat(tolower(tostring(Properties.role)), " | ", tolower(tostring(Properties.usageScenario)))
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId) by Label, Detail
 | extend RowType="profile"),
(ProductEvents
 | where Name == "Impact_Story_Submitted"
 | extend Label=tolower(tostring(Properties.audience)), Detail=strcat(tolower(tostring(Properties.outcome)), " | ", tolower(tostring(Properties.externalUse)))
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId) by Label, Detail
 | extend RowType="story"),
(ProductEvents
 | where Name == "Deployment_Registered"
 | extend Label=tolower(tostring(Properties.environmentType)), Detail=strcat(tolower(tostring(Properties.hosting)), " | customer=", tolower(tostring(Properties.customerDeployment)))
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId) by Label, Detail
 | extend RowType="registration"),
(ProductEvents
 | where Name == "Attribution_Observed"
 | extend Label=tolower(tostring(Properties.source)), Detail=tolower(tostring(Properties.campaign))
 | summarize Count=count(), Users=dcount(UserId), Sessions=dcount(SessionId) by Label, Detail
 | extend RowType="attribution")
| project RowType, Label, Detail, Count, Users, Sessions
| order by RowType asc, Count desc`,
};