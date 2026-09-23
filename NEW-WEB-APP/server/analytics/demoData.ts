
import type { OverviewResponse, TimeRange } from '../../shared/contracts.js';

const featureNames = [
  'Architecture Generated', 'AI Model Usage', 'Diagram Exported', 'Architecture Validated',
  'Help Opened', 'Validation Findings', 'Template Imported', 'Recommendations Applied',
];

export function createDemoOverview(range: TimeRange): OverviewResponse {
  const days = range === '24h' ? 1 : Number.parseInt(range, 10);
  const now = new Date();
  const trend = Array.from({ length: Math.min(days, 30) }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - (Math.min(days, 30) - index - 1));
    return {
      bucket: date.toISOString(),
      events: 72 + ((index * 29) % 91),
      users: 9 + ((index * 7) % 18),
    };
  });

  return {
    generatedAt: now.toISOString(),
    source: 'demo',
    metrics: [
      { label: 'Active users', value: 184, previous: 157 },
      { label: 'Sessions', value: 612, previous: 548 },
      { label: 'Product events', value: 4287, previous: 3761 },
      { label: 'Countries', value: 28, previous: 24 },
    ],
    trend,
    features: featureNames.map((name, index) => ({
      name,
      count: 1180 - index * 123,
      users: 151 - index * 13,
    })),
    notices: ['Demo data is active. Configure LOG_ANALYTICS_WORKSPACE_ID to query AADB telemetry.'],
  };
}