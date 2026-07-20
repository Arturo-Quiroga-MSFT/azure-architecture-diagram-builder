
export const RANGE_VALUES = ['24h', '7d', '30d', '90d'] as const;
export type TimeRange = (typeof RANGE_VALUES)[number];

export interface AnalyticsFilters {
  range: TimeRange;
  model?: string;
  operation?: string;
  country?: string;
  environment?: string;
  appVersion?: string;
}

export interface Metric {
  label: string;
  value: number;
  previous: number;
  unit?: 'count' | 'percent' | 'tokens' | 'milliseconds';
}

export interface TrendPoint {
  bucket: string;
  events: number;
  users: number;
}

export interface RankedItem {
  name: string;
  count: number;
  users: number;
}

export interface OverviewResponse {
  generatedAt: string;
  source: 'azure-monitor' | 'demo';
  metrics: Metric[];
  trend: TrendPoint[];
  features: RankedItem[];
  notices: string[];
}

export interface FunnelStep {
  name: string;
  sessions: number;
  conversion: number;
}

export interface ModelInsight {
  model: string;
  calls: number;
  totalTokens: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  validationScore: number;
  critiqueWins: number;
}

export interface FindingInsight {
  id: string;
  label: string;
  pillar: string;
  severity: string;
  occurrences: number;
}

export interface ReliabilityInsight {
  signal: string;
  count: number;
  failureRate: number;
  p95DurationMs: number;
}

export interface CohortPoint {
  cohort: string;
  week: number;
  retention: number;
}

export interface ReleaseInsight {
  version: string;
  users: number;
  events: number;
  exportsPerSession: number;
  validationAdoption: number;
}

export interface CityInsight {
  city: string;
  country: string;
  users: number;
  sessions: number;
  events: number;
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  evidence: string;
  action: string;
  source: 'rules' | 'azure-openai';
}

export interface InsightsResponse {
  generatedAt: string;
  source: 'azure-monitor' | 'demo';
  funnel: FunnelStep[];
  models: ModelInsight[];
  findings: FindingInsight[];
  reliability: ReliabilityInsight[];
  cohorts: CohortPoint[];
  releases: ReleaseInsight[];
  cities: CityInsight[];
  recommendations: Recommendation[];
}

export interface FeedbackItem {
  id: string;
  rating: number;
  category: string;
  comment: string;
  createdAt: string;
  model?: string;
}

export interface FeedbackResponse {
  source: 'cosmos' | 'unavailable';
  items: FeedbackItem[];
  message?: string;
}