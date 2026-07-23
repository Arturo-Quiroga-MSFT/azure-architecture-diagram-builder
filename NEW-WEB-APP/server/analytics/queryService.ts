
import { DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query-logs';
import type { InsightsResponse, OverviewResponse, Recommendation, TimeRange } from '../../shared/contracts.js';
import { createDemoOverview } from './demoData.js';
import { createDemoInsights } from './insightsDemo.js';
import { queries } from './queries.js';

type Row = Array<string | number | boolean | Date | Record<string, unknown>>;

const durationByRange: Record<TimeRange, string> = {
  '24h': 'P1D',
  '7d': 'P7D',
  '30d': 'P30D',
  '90d': 'P90D',
};

interface CacheEntry { expiresAt: number; value: OverviewResponse }
const cache = new Map<string, CacheEntry>();
const cacheTtlMs = Number(process.env.ANALYTICS_CACHE_TTL_SECONDS || 120) * 1000;

function tableRows(result: Awaited<ReturnType<LogsQueryClient['queryWorkspace']>>): Row[] {
  if (result.status === LogsQueryResultStatus.Success) return result.tables[0]?.rows ?? [];
  if (result.status === LogsQueryResultStatus.PartialFailure) return result.partialTables[0]?.rows ?? [];
  throw new Error('Azure Monitor returned an unsupported query result');
}

export async function getOverview(range: TimeRange): Promise<OverviewResponse> {
  const workspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
  if (!workspaceId) return createDemoOverview(range);

  const cached = cache.get(range);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const client = new LogsQueryClient(new DefaultAzureCredential());
  const timespan = { duration: durationByRange[range] };
  const previousTimespan = { duration: durationByRange[range], endTime: new Date(Date.now() - rangeToMs(range)) };
  const [metrics, previous, trend, features] = await Promise.all([
    client.queryWorkspace(workspaceId, queries.overviewMetrics, timespan),
    client.queryWorkspace(workspaceId, queries.overviewMetrics, previousTimespan),
    client.queryWorkspace(workspaceId, queries.activityTrend, timespan),
    client.queryWorkspace(workspaceId, queries.featureUsage, timespan),
  ]);

  const current = tableRows(metrics)[0] ?? [0, 0, 0, 0];
  const prior = tableRows(previous)[0] ?? [0, 0, 0, 0];
  const labels = ['Active users', 'Sessions', 'Product events', 'Countries'];
  const value: OverviewResponse = {
    generatedAt: new Date().toISOString(),
    source: 'azure-monitor',
    metrics: labels.map((label, index) => ({ label, value: Number(current[index] || 0), previous: Number(prior[index] || 0) })),
    trend: tableRows(trend).map((row) => ({ bucket: new Date(String(row[0])).toISOString(), events: Number(row[1]), users: Number(row[2]) })),
    features: tableRows(features).map((row) => ({ name: String(row[0]), count: Number(row[1]), users: Number(row[2]) })),
    notices: [],
  };
  cache.set(range, { expiresAt: Date.now() + cacheTtlMs, value });
  return value;
}

export async function getInsights(range: TimeRange): Promise<InsightsResponse> {
  const workspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
  if (!workspaceId) return createDemoInsights();

  const client = new LogsQueryClient(new DefaultAzureCredential());
  const timespan = { duration: durationByRange[range] };
  const [funnel, handoff, models, findings, reliability, cohorts, releases, cities] = await Promise.all([
    client.queryWorkspace(workspaceId, queries.journeyFunnel, timespan),
    client.queryWorkspace(workspaceId, queries.validationHandoff, timespan),
    client.queryWorkspace(workspaceId, queries.modelEfficiency, timespan),
    client.queryWorkspace(workspaceId, queries.validationFindings, timespan),
    client.queryWorkspace(workspaceId, queries.reliability, timespan),
    client.queryWorkspace(workspaceId, queries.retention, timespan),
    client.queryWorkspace(workspaceId, queries.releaseImpact, timespan),
    client.queryWorkspace(workspaceId, queries.cityUsage, timespan),
  ]);

  const funnelOrder = ['Architecture_Generated', 'Architecture_Validated', 'Recommendations_Applied', 'Diagram_Exported', 'DeploymentGuide_Generated'];
  const funnelNames = ['Generate', 'Validate', 'Apply guidance', 'Export', 'Deployment guide'];
  const funnelCounts = new Map(tableRows(funnel).map((row) => [String(row[0]), Number(row[1])]));
  const handoffCounts = new Map(tableRows(handoff).map((row) => [String(row[0]), Number(row[1])]));
  const baseSessions = funnelCounts.get('Architecture_Generated') || 1;
  const handoffShown = handoffCounts.get('shown') || 0;
  const handoffStarted = handoffCounts.get('started') || 0;
  const result: InsightsResponse = {
    generatedAt: new Date().toISOString(),
    source: 'azure-monitor',
    funnel: funnelOrder.map((eventName, index) => {
      const sessions = funnelCounts.get(eventName) || 0;
      return { name: funnelNames[index], sessions, conversion: Number((sessions * 100 / baseSessions).toFixed(1)) };
    }),
    validationHandoff: {
      shown: handoffShown,
      started: handoffStarted,
      dismissed: handoffCounts.get('dismissed') || 0,
      startRate: handoffShown > 0 ? Number((handoffStarted * 100 / handoffShown).toFixed(1)) : 0,
    },
    models: tableRows(models).map((row) => ({
      model: String(row[0]), calls: Number(row[1]), totalTokens: Number(row[2]), averageLatencyMs: Number(row[3]),
      p95LatencyMs: Number(row[4]), validationScore: 0, critiqueWins: 0,
    })),
    findings: tableRows(findings).map((row) => ({
      id: String(row[0]), label: String(row[1] || row[0]), pillar: String(row[2]), severity: String(row[3]), occurrences: Number(row[4]),
    })),
    reliability: tableRows(reliability).map((row) => ({ signal: String(row[0]), count: Number(row[1]), failureRate: Number(row[2]), p95DurationMs: Number(row[3]) })),
    cohorts: tableRows(cohorts).map((row) => ({ cohort: new Date(String(row[0])).toISOString(), week: Number(row[1]), retention: Number(row[2]) })),
    releases: tableRows(releases).map((row) => ({ version: String(row[0]), users: Number(row[1]), events: Number(row[2]), exportsPerSession: Number(row[3]), validationAdoption: Number(row[4]) })),
    cities: tableRows(cities).map((row) => ({ city: String(row[0]), country: String(row[1]), users: Number(row[2]), sessions: Number(row[3]), events: Number(row[4]) })),
    recommendations: [],
  };
  result.recommendations = deriveRecommendations(result);
  return result;
}

function deriveRecommendations(insights: InsightsResponse): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const validate = insights.funnel.find((step) => step.name === 'Validate');
  if (validate && validate.conversion < 70) recommendations.push({
    id: 'validation-dropoff',
    priority: insights.validationHandoff.shown > 0 && insights.validationHandoff.startRate >= 40 ? 'medium' : 'high',
    title: insights.validationHandoff.shown > 0 ? 'Monitor validation handoff conversion' : 'Reduce the validation handoff',
    evidence: insights.validationHandoff.shown > 0
      ? `${insights.validationHandoff.startRate}% of ${insights.validationHandoff.shown} validation prompts were started; ${validate.conversion}% of generation sessions completed validation.`
      : `${validate.conversion}% of generation sessions continue to validation.`,
    action: insights.validationHandoff.shown > 0
      ? 'Compare prompt starts with completed validations and tune the success-moment copy or placement if the gap remains.'
      : 'Offer validation directly in the generation success state and compare conversion by release.',
    source: 'rules',
  });
  const topFinding = insights.findings[0];
  if (topFinding) recommendations.push({
    id: `finding-${topFinding.id}`, priority: topFinding.severity === 'high' || topFinding.severity === 'critical' ? 'high' : 'medium',
    title: `Address recurring ${topFinding.label.toLowerCase()}`,
    evidence: `${topFinding.occurrences} occurrences make this the leading ${topFinding.pillar} gap.`,
    action: 'Add a secure-default template or contextual guardrail for this finding.', source: 'rules',
  });
  const slowest = [...insights.models].sort((left, right) => right.averageLatencyMs - left.averageLatencyMs)[0];
  if (slowest) recommendations.push({
    id: `latency-${slowest.model}`, priority: 'medium', title: `Review ${slowest.model} routing`,
    evidence: `${Math.round(slowest.averageLatencyMs / 100) / 10}s average latency across ${slowest.calls} calls.`,
    action: 'Route low-complexity operations to a faster model and reserve this model for quality-sensitive work.', source: 'rules',
  });
  return recommendations;
}

function rangeToMs(range: TimeRange): number {
  const hours = range === '24h' ? 24 : Number.parseInt(range, 10) * 24;
  return hours * 60 * 60 * 1000;
}