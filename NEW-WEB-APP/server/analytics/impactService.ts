import { DefaultAzureCredential } from '@azure/identity';
import { LogsQueryClient, LogsQueryResultStatus } from '@azure/monitor-query-logs';
import type { ImpactMetric, ImpactResponse, TimeRange } from '../../shared/contracts.js';
import { getDurableImpactSummary } from '../feedbackService.js';
import { queries } from './queries.js';

const durationByRange: Record<TimeRange, string> = { '24h': 'P1D', '7d': 'P7D', '30d': 'P30D', '90d': 'P90D' };

function rows(result: Awaited<ReturnType<LogsQueryClient['queryWorkspace']>>) {
  if (result.status === LogsQueryResultStatus.Success) return result.tables[0]?.rows ?? [];
  if (result.status === LogsQueryResultStatus.PartialFailure) return result.partialTables[0]?.rows ?? [];
  throw new Error('Azure Monitor returned an unsupported impact query result');
}

function metric(row: Array<unknown>): ImpactMetric {
  return { label: String(row[1]), detail: String(row[2] || ''), count: Number(row[3]), users: Number(row[4]), sessions: Number(row[5]) };
}

export async function getImpact(range: TimeRange): Promise<ImpactResponse> {
  const durable = await getDurableImpactSummary();
  const workspaceId = process.env.LOG_ANALYTICS_WORKSPACE_ID;
  if (!workspaceId) return {
    generatedAt: new Date().toISOString(), source: 'demo',
    measured: [
      { label: 'Reach', detail: 'Anonymous product activity', count: 4287, users: 184, sessions: 612 },
      { label: 'Create or import', detail: 'Generated or imported architecture', count: 1180, users: 151, sessions: 418 },
      { label: 'Validate', detail: 'Architecture validation', count: 811, users: 112, sessions: 264 },
      { label: 'Produce artifact', detail: 'Export or deployment guidance', count: 934, users: 125, sessions: 203 },
    ],
    profiles: [], stories: [], registrations: [], attribution: [], durable,
    notices: ['Impact self-reporting is newly instrumented. Empty sections mean no records in the selected window, not zero organizational impact.'],
  };

  const client = new LogsQueryClient(new DefaultAzureCredential());
  const result = await client.queryWorkspace(workspaceId, queries.impactSummary, { duration: durationByRange[range] });
  const grouped = new Map<string, ImpactMetric[]>();
  for (const row of rows(result)) {
    const type = String(row[0]);
    grouped.set(type, [...(grouped.get(type) || []), metric(row)]);
  }
  return {
    generatedAt: new Date().toISOString(), source: 'azure-monitor',
    measured: grouped.get('measured') || [], profiles: grouped.get('profile') || [],
    stories: grouped.get('story') || [], registrations: grouped.get('registration') || [],
    attribution: grouped.get('attribution') || [], durable,
    notices: ['Measured, self-reported, registered, and verified populations are separate and must not be added together.'],
  };
}