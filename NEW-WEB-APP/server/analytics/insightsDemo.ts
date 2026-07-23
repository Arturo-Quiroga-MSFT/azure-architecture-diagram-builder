
import type { InsightsResponse } from '../../shared/contracts.js';

export function createDemoInsights(): InsightsResponse {
  return {
    generatedAt: new Date().toISOString(),
    source: 'demo',
    funnel: [
      { name: 'Generate', sessions: 418, conversion: 100 },
      { name: 'Validate', sessions: 264, conversion: 63.2 },
      { name: 'Apply guidance', sessions: 131, conversion: 31.3 },
      { name: 'Export', sessions: 203, conversion: 48.6 },
      { name: 'Deployment guide', sessions: 74, conversion: 17.7 },
    ],
    validationHandoff: { shown: 0, started: 0, dismissed: 0, startRate: 0 },
    models: [
      { model: 'gpt-5.4', calls: 614, totalTokens: 4281000, averageLatencyMs: 12800, p95LatencyMs: 28100, validationScore: 86, critiqueWins: 42 },
      { model: 'gpt-5.4-mini', calls: 487, totalTokens: 2195000, averageLatencyMs: 6900, p95LatencyMs: 14400, validationScore: 78, critiqueWins: 19 },
      { model: 'gpt-5.2', calls: 322, totalTokens: 3042000, averageLatencyMs: 10300, p95LatencyMs: 22700, validationScore: 82, critiqueWins: 31 },
      { model: 'deepseek-v4', calls: 208, totalTokens: 1711000, averageLatencyMs: 9200, p95LatencyMs: 19400, validationScore: 75, critiqueWins: 11 },
    ],
    findings: [
      { id: 'no-private-endpoints', label: 'Public service endpoints', pillar: 'Security', severity: 'high', occurrences: 142 },
      { id: 'no-multi-region', label: 'No regional failover', pillar: 'Reliability', severity: 'high', occurrences: 118 },
      { id: 'missing-monitoring', label: 'Incomplete observability', pillar: 'Operational Excellence', severity: 'medium', occurrences: 91 },
      { id: 'no-cost-controls', label: 'Missing cost controls', pillar: 'Cost Optimization', severity: 'medium', occurrences: 64 },
    ],
    reliability: [
      { signal: 'Frontend exceptions', count: 23, failureRate: 0.5, p95DurationMs: 0 },
      { signal: 'Failed dependencies', count: 39, failureRate: 2.4, p95DurationMs: 18400 },
      { signal: 'Slow requests', count: 52, failureRate: 0.8, p95DurationMs: 26900 },
    ],
    cohorts: Array.from({ length: 6 }, (_, cohort) => Array.from({ length: 6 - cohort }, (_, week) => ({
      cohort: `2026-W${String(24 + cohort).padStart(2, '0')}`,
      week,
      retention: week === 0 ? 100 : Math.max(18, 62 - week * 9 - cohort * 2),
    }))).flat(),
    releases: [
      { version: '1.8.0', users: 178, events: 2891, exportsPerSession: 1.7, validationAdoption: 63 },
      { version: '1.7.0', users: 149, events: 2310, exportsPerSession: 1.4, validationAdoption: 52 },
      { version: '1.6.0', users: 121, events: 1904, exportsPerSession: 1.2, validationAdoption: 47 },
    ],
    cities: [
      { city: 'Boydton', country: 'United States', users: 169, sessions: 289, events: 2342 },
      { city: 'London', country: 'United Kingdom', users: 39, sessions: 52, events: 402 },
      { city: 'Amsterdam', country: 'Netherlands', users: 35, sessions: 54, events: 349 },
      { city: 'Sydney', country: 'Australia', users: 18, sessions: 21, events: 103 },
      { city: 'Chennai', country: 'India', users: 17, sessions: 23, events: 104 },
    ],
    recommendations: [
      { id: 'validation-dropoff', priority: 'high', title: 'Move validation into the generation finish state', evidence: 'Only 63.2% of generation sessions continue to validation.', action: 'Offer one-click validation after a successful generation and measure the conversion delta.', source: 'rules' },
      { id: 'private-endpoint-starter', priority: 'high', title: 'Add private endpoint defaults to starter architectures', evidence: 'Public service endpoints are the most frequent WAF finding (142 occurrences).', action: 'Ship secure networking variants for the top starter templates.', source: 'rules' },
      { id: 'model-routing', priority: 'medium', title: 'Route lightweight operations to the faster model', evidence: 'The mini model is 46% faster while retaining a 78 average validation score.', action: 'A/B route help and modification tasks, retaining the strongest model for final validation.', source: 'rules' },
    ],
  };
}