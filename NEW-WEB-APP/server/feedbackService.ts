
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import type { FeedbackResponse } from '../shared/contracts.js';

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