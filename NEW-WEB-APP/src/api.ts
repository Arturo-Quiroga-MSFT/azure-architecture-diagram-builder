
import type { FeedbackResponse, InsightsResponse, OverviewResponse, Recommendation, TimeRange } from '../shared/contracts';

export async function fetchOverview(range: TimeRange, signal?: AbortSignal): Promise<OverviewResponse> {
  const response = await fetch(`/api/analytics/overview?range=${range}`, { signal });
  if (!response.ok) throw new Error(`Analytics request failed (${response.status})`);
  return response.json() as Promise<OverviewResponse>;
}

export async function fetchInsights(range: TimeRange, signal?: AbortSignal): Promise<InsightsResponse> {
  const response = await fetch(`/api/analytics/insights?range=${range}`, { signal });
  if (!response.ok) throw new Error(`Insights request failed (${response.status})`);
  return response.json() as Promise<InsightsResponse>;
}

export async function fetchFeedback(signal?: AbortSignal): Promise<FeedbackResponse> {
  const response = await fetch('/api/feedback', { signal });
  if (!response.ok) throw new Error(`Feedback request failed (${response.status})`);
  return response.json() as Promise<FeedbackResponse>;
}

export async function enhanceRecommendations(range: TimeRange): Promise<Recommendation[]> {
  const response = await fetch(`/api/recommendations/enhance?range=${range}`, { method: 'POST' });
  if (!response.ok) throw new Error(`Recommendation request failed (${response.status})`);
  const result = await response.json() as { recommendations: Recommendation[] };
  return result.recommendations;
}