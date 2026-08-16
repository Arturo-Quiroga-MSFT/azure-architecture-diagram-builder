
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import type { DurableImpactSummary, FeedbackResponse } from '../shared/contracts.js';

export async function getFeedback(): Promise<FeedbackResponse> {
  const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
  if (!endpoint) return { source: 'unavailable', items: [], message: 'Cosmos feedback is not configured.' };

  try {
    const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const container = client
      .database(process.env.COSMOS_DATABASE_ID || 'diagrams-db')
      .container(process.env.COSMOS_FEEDBACK_CONTAINER_ID || 'feedback');
    const { resources } = await container.items.query({
      query: 'SELECT TOP 100 c.id, c.rating, c.category, c.comment, c.createdAt, c.context.model FROM c WHERE c.type = @type ORDER BY c.createdAt DESC',
      parameters: [{ name: '@type', value: 'feedback' }],
    }).fetchAll();

    return {
      source: 'cosmos',
      items: resources.map((item) => ({
        id: String(item.id), rating: Number(item.rating), category: String(item.category), comment: String(item.comment || ''),
        createdAt: String(item.createdAt), model: item.model ? String(item.model) : undefined,
      })),
    };
  } catch (error) {
    console.error('[feedback-api]', error);
    return { source: 'unavailable', items: [], message: 'Feedback is temporarily unavailable.' };
  }
}

export async function getDurableImpactSummary(): Promise<DurableImpactSummary> {
  const endpoint = process.env.AZURE_COSMOS_ENDPOINT;
  if (!endpoint) return { source: 'unavailable', stories: 0, registrations: 0, verifiedOutcomes: 0, message: 'Cosmos impact storage is not configured.' };

  try {
    const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const container = client
      .database(process.env.COSMOS_DATABASE_ID || 'diagrams-db')
      .container(process.env.COSMOS_FEEDBACK_CONTAINER_ID || 'feedback');
    const { resources } = await container.items.query({
      query: 'SELECT c.type, c.verification.status AS verificationStatus FROM c WHERE c.type IN (@story, @registration)',
      parameters: [
        { name: '@story', value: 'impact-story' },
        { name: '@registration', value: 'deployment-registration' },
      ],
    }).fetchAll();
    return {
      source: 'cosmos',
      stories: resources.filter((item) => item.type === 'impact-story').length,
      registrations: resources.filter((item) => item.type === 'deployment-registration').length,
      verifiedOutcomes: resources.filter((item) => String(item.verificationStatus || '').startsWith('confirmed-')).length,
    };
  } catch (error) {
    console.error('[impact-api]', error);
    return { source: 'unavailable', stories: 0, registrations: 0, verifiedOutcomes: 0, message: 'Durable impact records are temporarily unavailable.' };
  }
}