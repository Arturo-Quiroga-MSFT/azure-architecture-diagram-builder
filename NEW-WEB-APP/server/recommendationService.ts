
import { DefaultAzureCredential } from '@azure/identity';
import type { InsightsResponse, Recommendation } from '../shared/contracts.js';

export async function enhanceRecommendations(insights: InsightsResponse): Promise<Recommendation[]> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !deployment) return insights.recommendations;

  const { token } = await new DefaultAzureCredential().getToken('https://cognitiveservices.azure.com/.default');
  const aggregate = {
    funnel: insights.funnel,
    models: insights.models,
    findings: insights.findings.slice(0, 10),
    reliability: insights.reliability,
    releases: insights.releases,
  };
  const response = await fetch(`${endpoint.replace(/\/$/, '')}/openai/v1/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: deployment,
      input: `Return JSON only: an array of at most 5 product recommendations with id, priority, title, evidence, and action. Use only this aggregate AADB telemetry; do not infer user identity or content.\n${JSON.stringify(aggregate)}`,
      text: { format: { type: 'json_object' } },
    }),
  });
  if (!response.ok) throw new Error(`Azure OpenAI recommendation request failed (${response.status})`);
  const payload = await response.json() as { output_text?: string };
  const parsed = JSON.parse(payload.output_text || '{}') as { recommendations?: Recommendation[] } | Recommendation[];
  const recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations;
  return (recommendations || []).slice(0, 5).map((item) => ({ ...item, source: 'azure-openai' }));
}