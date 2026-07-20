
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('analytics API', () => {
  it('returns a typed overview using demo data when no workspace is configured', async () => {
    const response = await request(createApp()).get('/api/analytics/overview?range=30d');
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('demo');
    expect(response.body.metrics).toHaveLength(4);
    expect(response.body.features.length).toBeGreaterThan(0);
  });

  it('rejects unsupported time ranges', async () => {
    const response = await request(createApp()).get('/api/analytics/overview?range=365d');
    expect(response.status).toBe(400);
  });

  it('returns decision intelligence without exposing raw telemetry', async () => {
    const response = await request(createApp()).get('/api/analytics/insights?range=7d');
    expect(response.status).toBe(200);
    expect(response.body.funnel).toHaveLength(5);
    expect(response.body.cities[0]).toMatchObject({ city: 'Boydton', country: 'United States', users: 169 });
    expect(response.body.recommendations[0].evidence).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain('queryWorkspace');
  });

  it('reports unavailable feedback when Cosmos is not configured', async () => {
    const response = await request(createApp()).get('/api/feedback');
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('unavailable');
  });
});