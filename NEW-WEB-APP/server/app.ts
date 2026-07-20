
import compression from 'compression';
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { RANGE_VALUES } from '../shared/contracts.js';
import { getInsights, getOverview } from './analytics/queryService.js';
import { getFeedback } from './feedbackService.js';
import { enhanceRecommendations } from './recommendationService.js';

const querySchema = z.object({ range: z.enum(RANGE_VALUES).default('30d') });

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'healthy', sourceConfigured: Boolean(process.env.LOG_ANALYTICS_WORKSPACE_ID) });
  });

  app.get('/api/analytics/overview', async (request, response, next) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return response.status(400).json({ error: 'Invalid analytics query', details: parsed.error.flatten() });
    try {
      return response.json(await getOverview(parsed.data.range));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/analytics/insights', async (request, response, next) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return response.status(400).json({ error: 'Invalid analytics query', details: parsed.error.flatten() });
    try {
      return response.json(await getInsights(parsed.data.range));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/feedback', async (_request, response, next) => {
    try {
      return response.json(await getFeedback());
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/recommendations/enhance', async (request, response, next) => {
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) return response.status(400).json({ error: 'Invalid analytics query' });
    try {
      const insights = await getInsights(parsed.data.range);
      return response.json({ recommendations: await enhanceRecommendations(insights) });
    } catch (error) {
      return next(error);
    }
  });

  const root = path.dirname(fileURLToPath(import.meta.url));
  const staticPath = path.resolve(root, '../../dist');
  app.use(express.static(staticPath, { maxAge: '1h' }));
  app.get('/{*splat}', (_request, response) => response.sendFile(path.join(staticPath, 'index.html')));

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    console.error('[analytics-api]', error);
    response.status(500).json({ error: 'Analytics query failed' });
  });

  return app;
}